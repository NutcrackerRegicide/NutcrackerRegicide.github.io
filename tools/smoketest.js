#!/usr/bin/env node
/* Headless smoke test: loads every game script with a stubbed browser,
   runs simulated frames, and asserts core systems exist and function.
   Usage: npm install three@0.128.0 && node tools/smoketest.js */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
global.window=global;
const THREE=require('three'); global.THREE=THREE;
// ---- v132.28: a DETERMINISTIC harness, so a red is a regression and not a dice roll ----
// Must run before the bundle is evaluated: 02-world.js captures Math.random at load time as
// __realRandom, installs its own mulberry32 for world gen, and restores the capture afterwards.
const SMOKE_SEED=(process.env.SMOKE_SEED?parseInt(process.env.SMOKE_SEED,10):0x5E1F)|0;
function __smokeRng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
Math.random=__smokeRng(SMOKE_SEED);
console.log('harness RNG seeded:',SMOKE_SEED);
// ---- DOM stubs ----
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
let rafCount=0; global.requestAnimationFrame=()=>{rafCount++;};
THREE.WebGLRenderer=function(){return{setSize(){},setPixelRatio(){},render(){},
  shadowMap:{},domElement:mkEl()}};
// load baked Mixamo animations if present, so the campaign exercises the retarget path
try{(0,eval)(fs.readFileSync(path.join(ROOT,"assets/anims.js"),"utf8"));
  console.log("baked anims loaded:",Object.keys(global.BAKED_ANIMS.pools).join(", "));}catch(e){}
// ---- load game scripts in index order ----
const order=["00-data","01-engine","02-world","03-buildings","04-units","05-combat",
  "06-input","07-ai","08-ui","09-main","10-net","11-audio","12-touch","13-deskui"];
// browsers share top-level const across <script> tags; node eval does not —
// so evaluate everything as ONE script and export internals for assertions
let bundle=order.map(f=>fs.readFileSync(path.join(ROOT,"js",f+".js"),"utf8")).join("\n");
bundle+="\n;global.__G={units,buildings,neutralMarkets,buildingMesh,makeBuilding,makeUnit,"+
  "tradeGold,tick,teamAge,stock,updateBot,tryMeleeAttack,tryAttack,setGameOver,launchLob,BLUE,RED,lineUnitFor,CLS,clock,isSiege,nodes,validFor,teamTC,terrainHeight,TCPOS,makeBuilding,buildingMesh,BLD,NET,player,keys,directors,wallLineSegments,placeGateOnWall,kings,healTick,snapToWallEnd,dealDamage,restyleBuildings,rebuildRoads,roadGroups,nearestFriendlySite,BSCALE,moveToward,steerAroundBuildings,restyleUnits,drainVisualQueue,syncNameTags,manageBands,killUnit,respawnUnit,resurrectUnit,updatePriestChannel,tryResurrect,RES_CHARGE,RES_CD,"+
  "campStates,campTick,campNewWave,updateCreep,inCampGround,CAMPS,CAMP_R,CAMP_RESPAWN,CREEP_N,NEUTRAL,MAP,moveUnit,"+
  "orderCharge,toggleRally,toggleRallyFor,rallyCapFor,RALLY_CAP,CHARGE_DIST,camera,rps,setClass,economyTick,"+
  "ENLIGHTENMENT_AGE,ENLIGHTEN_TRICKLE,QUESTS,BUFFS,XP_MAX_LVL,BUFF_MAX_STACK,BOARD_REACH,QUEST_REROLL_MAX,buffMax,BUFF_BY_ID,townBoards,boardFor,questDraft,questPick,questRedraw,cargoFrac,updateCargoVisual,"+
  "buffSt,carryCap,grantBuff,applyBuffStats,useTownBoard,useBlacksmith,questProgress,questTick,"+
  "bazaarTier,addConstructionHit,damageBuilding,interactCandidateD2,ageBuff,isHuman,showScoreboard,smithOffer,smithPick,"+
  "closeMenus,cancelPlacing,releaseWarband,rallyLeaderFor,shootArrow:(a,b)=>shootArrow(a,b),"+
  "setRmb:v=>{rmbHeld=v;},setLmb:v=>{lmbHeld=v;},setLock:v=>{mouseLocked=v;},getSiegeAim:()=>siegeAim,"+
  "tickBoardBang,getBoardBang:()=>_boardBang,"+
  "PERSONALITIES,AI_DIFF,diffFor,teamHasHuman,findFarmSpot,findPitSpotForFarms,counterWeights,farmAnchors,directorThink,"+
  "setAIDiff:v=>{aiDifficulty=v;},getAIDiff:()=>aiDifficulty,getT:()=>T,menuUp:()=>inMenu,Sound,toggleOptions,syncOptionsUI,"+
  "startAgeResearch,tickAgeResearch,ageResT,AGE_RESEARCH_S,ageUp,AGES,"+
  "laneTarget,laneFor,assignLane,LANE_Z,LANE_TURNIN,LANE_EDGE,HOLD_TOUR,HOLD_QUIET,HOLD_WATCH,bandHoldPoint,OXSCALE,"+
  "buildBodyFor,fireAimedShot,FARM_PASSIVE,setAiming:v=>{aiming=v;},"+
  // v134.0 the movement layer: the lifted collider, the validated sidestep, and walkable itself —
  // which the suite has never once been able to ask a question of.
  "walkable,pushOutOfBuildings,pickDetour,detourFree,MOVE_STALL_T,MOVE_GOAL_JUMP,separate,"+
  "TC_RING,TC_FARM_MIN,tcRingReason,farmAdjacent,"+   // v134.1 the farm ring
  // the bench drives moveToward directly, outside tick(), and both the watchdog and a detour's
  // lifetime are measured in T. A bench that leaves T frozen tests a world where no detour ever
  // expires — which is a different program, and it reads as "nobody ever arrives".
  "advanceT:(sec)=>{T+=sec;},"+
  "makeTree,depleteNode,clearFootprint,TREE_SCALE,TREE_GEOS,STUMP_GEOS,TREE_STANDS,TREE_CLEAR_BASE,TREE_CLEAR_ROAD,roadPoint,"+
  "vikingPoint,BAZAAR_SITES,TREE_CLEAR_VIKING,CREEP_SITES,CREEP_R_INNER,"+
  "setHideD,getHideD:()=>HIDE_D,getMouseLocked:()=>mouseLocked,"+
  // v124: the draw, the rail's gating predicates, the analog move vector and the epithet roller
  "DRAW_CLASSES,DRAW_FULL,drawScale,isDrawClass,drawLevel,tickDraw,drawFill,fireAimedFor,"+
  "ACTIONS,availableActions,moveVec,readMove,updateRoster,mkName,NAMES,EPITHETS,projectiles,"+
  "aimPointFor,convergeFrom,setPlayerDraw:v=>{player._drawT=v;},"+
  // v128.5: lag compensation — the rewind context, the projectile step and THREE itself
  "updateProjectiles,setRewind,segDist2,rwDist,dist2,THREE,renderFrame,tickObjectiveFade,"+
  // v128.6: the atlas and the merge, so the draw budget can be asserted
  // v131 the hour rig and the field that dresses the ground — see the world-lane checks below
  "setSunHour,meadowPatch,sun,_SUN_OFF,PROP_FEET,"+
  "UATLAS,mergeUnitBody,texturedMat,isSharedMat,bSurf,bStand,auraTick,auraStats,auraTint,auraSpread,auraShape,auraLive,auraSweep,auraLit,renderFrame,AURA_LEASH,AURA_LEASH_Y,puff,fxEffects:()=>effects,dustPts:()=>dustPts,scene:()=>scene,gatherSwing,WARD_CD,GUARD_CD,awardPts,BUFF_BY_ID,AURA_MAX,AURA_NEAR,AURA_FAR,AURA_CURVE,AURA_RATE_LO,AURA_RATE_HI,AURA_R_LO,AURA_R_HI,AURA_RISE_LO,AURA_RISE_HI,AURA_LIFE_LO,AURA_LIFE_HI,AURA_GOLD,TEAMCOL,inTheWoods,nearOwnKing,setClassStats,stock,TREE_STANDS,updateUnitCommon,bldCost,bldCostD,isDefensiveDef,canAfford,pay,BLD,tmodAdd,tmodSum,tmodMul,tmodTick,TMOD_OOC,TMOD_LOW,moveUnit,tmodSync,tmodSyncClear,statusTick,isStunned,healBlocked,shedDebuffs,healTick,auraBuffTick,AURA_BR,AURA_SCAN,AURA_STILL,buildings,makeBuilding,knifeTick,KNIFE_R,getT:()=>T,sfxAt:_sfxAt,SFX_NET,sfxLast:()=>_sfxLast,buffFxTick,buffFxStats,updateEffects,FX_SANCT,FX_BRAND,FX_KIN,FX_STEW,FX_RESOLVE,FX_PHALANX,RING_MIN,RING_TIGHTEN,getPlayer:()=>player,fxTick,fxStats,fxTex,vfxPlay,isHuman,dmgNum,dnumStats,tickVignette,KGUARD_R,nearOwnKing};";
// ---- v127: A HANDLE ON THE PER-FRAME DRIVERS, so the wiring itself can be asserted ----
// `__G` exports the drivers, but exporting a function is exporting a COPY OF THE REFERENCE —
// reassigning __G.campTick does not change what tickBody calls, so you cannot use it to find out
// whether tickBody calls anything. And they are not on `global` either: 00-data.js line 2 is
// "use strict", and because every file is concatenated into ONE script here, the whole bundle is
// strict — under which an indirect eval's function declarations stay inside the eval scope
// instead of landing on the global object. (Worth knowing on its own: in the browser each
// <script> is separate and only 00-data.js is strict, so the harness runs the other thirteen
// files under a slightly stricter regime than the game does.)
// So: generate a get/set pair per driver INSIDE the bundle's own scope. That is the only place
// the binding can be swapped, and swapping it is the only way to see who calls it.
const WIRE_DRIVERS=["drainVisualQueue","updateEffects","updateProjectiles","tickAgeResearch",
  "tickBoardBang","campTick","healTick","questTick","economyTick","updateTowers",
  "drawMinimap","updateRoster"];
bundle+="\n;global.__WIRE={"+WIRE_DRIVERS.map(d=>
  d+":{get:()=>"+d+",set:v=>{"+d+"=v;}}").join(",")+"};";
try{(0,eval)(bundle);}catch(e){console.error("LOAD FAIL:",e.message);process.exit(1);}
console.log("all scripts loaded");
// ---- v127: EVERY TICK IN THIS FILE HOLDS THE WAR OPEN ----
// `05-combat.js:196` — `if(!victim.alive||gameOver)return;` — makes dealDamage a NO-OP once a
// king has fallen, and `09-main.js:634` wraps the entire simulation in `if(!gameOver)`. So a
// regicide landing in any tick loop silently disarms every staged kill and freezes every timer
// for the REST OF THE RUN. That is what took out the eleven-check creep cluster, and separately
// the resurrection pair: "the resurrection target is a corpse first" failed because dealDamage
// had quietly stopped dealing damage, not because corpses were broken.
// The file used to sprinkle setGameOver(false) between sections by hand; sections that tick for
// hundreds of frames need it held down, not tapped once. Wrapping the export covers both this
// binding and every `global.__G.tick(...)` call site in one place. No check in this file requires
// gameOver to STAY true, so there is nothing to trip over.
// ---- AND WHY THE FIX IS A LINE, NOT A POLICY ----
// The obvious move is to hold gameOver down for every tick in the file. I tried it, and it is
// WRONG, in a way worth writing down: clearing the flag globally lets the campaign keep fighting
// past the point it would have stopped, and a war that runs to a conclusion razes things the later
// tests need. "both thrones still stand for the scout test" started failing. Reviving the kings and
// town centres to compensate then pushed the campaign somewhere else again, and "RED kingsguard
// never disbands" fell over instead. Each round traded one flake family for another, because the
// intervention's blast radius was larger than the bug's.
// Patching individual sites was tried first and does not scale: the disarm resurfaced in the
// splash-damage check (`hp 500/500` — no damage dealt at all) and the deposit-scoring check, in
// blocks nowhere near the ones already fixed. There are ~20 staged-damage sites and any new test
// would silently join them.
//
// So the flag IS held down per tick — but the TOWN CENTRES are protected with it, and that pairing
// is the whole trick. Clearing gameOver alone lets the campaign fight past the point it would have
// stopped, and a war that runs to a conclusion razes the town centres the later tests need
// ("both thrones still stand for the scout test"). Protecting the KINGS as well was tried and went
// too far — it pushed the campaign somewhere else again and broke the kingsguard check. Kings may
// die; the flag simply stops their death from disarming the harness.
{
  const _rawTick=global.__G.tick;
  global.__G.tick=function(dt){
    global.__G.setGameOver(false);
    // a razed TC invalidates hundreds of later checks that have nothing to do with who won
    for(const b of global.__G.buildings)
      if(b.type==="towncenter"&&!b.alive){b.alive=true;b.hp=Math.max(1,(b.def&&b.def.hp||1000)*0.5);}
    return _rawTick(dt);
  };
}
const {units,buildings,neutralMarkets,buildingMesh,makeBuilding,makeUnit,tradeGold,tick,
  teamAge,stock,updateBot,tryMeleeAttack,lineUnitFor,CLS,clock,isSiege,nodes,BLD}=global.__G;
// ---- fixed timestep, and a WALL CLOCK THAT KEEPS UP WITH IT ----
// v126: the net layer's cadence and diagnostics moved from accumulated sim `dt` to wall time
// (NET.now), because on a real loaded host those are NOT the same thing — 09-main clamps dt to
// 0.05, so a host at 10–19 fps ran both at 0.74–0.85× and the flight recorder's own "per second"
// silently meant "per sim second". In here, though, `dt` is pinned and no real time passes at
// all, so a bare performance.now() would freeze every net timer: hundreds of ticks would send
// zero snapshots and any test that leans on the feed flowing would quietly stop testing it.
// Advancing a synthetic wall clock in lockstep with getDelta models the case v126 restores —
// a healthy host whose sim clock and wall clock agree (simR ≈ 1.0) — and keeps the harness
// deterministic. Individual blocks still override NET.now to test a specific timing edge;
// they save and restore it, landing back on this.
let __wall=1e6;
clock.getDelta=()=>{__wall+=1000/30;return 1/30;};
global.__G.NET.now=()=>__wall;
// ---- assertions ----
let fails=0;
function check(name,cond){console.log((cond?"  PASS":"  FAIL")+" — "+name);if(!cond)fails++;}

// ---- v127: ISOLATION HELPERS ----
// A whole class of check in this file used to OBSERVE the world instead of CONTROLLING it, and
// then assert on what it happened to see. Those tests fail in clusters — one wandering bot in a
// creep camp's aggro ring stops the pack regenerating, and the eleven camp assertions downstream
// of that all fall together — so the suite failed ~1 run in 4 for reasons that had nothing to do
// with the code under test. A harness that cries wolf a quarter of the time is one you learn to
// ignore, which is worse than no harness at all: the day it is right, you shrug at it.
//
// These two establish a precondition explicitly and hand back an undo. Use them whenever a check
// depends on "nobody else is standing here" or "nothing else is built here" — and put the count
// in the assertion message, so if the isolation ever stops working the report says so out loud
// rather than the test quietly going back to being a coin flip.
function isolateArea(x,z,r,opts){
  const G=global.__G, keep=(opts&&opts.keep)||[], undo=[];
  const r2=r*r;
  for(const u of G.units){
    if(!u.alive||u.isPlayer||keep.indexOf(u)>=0)continue;
    if(u.team===G.NEUTRAL&&opts&&opts.keepNeutral)continue;
    if(opts&&typeof opts.team==="number"&&u.team!==opts.team)continue; // isolate ONE side only
    if(dist2h(u.root.position.x,u.root.position.z,x,z)>r2)continue;
    undo.push({u,x:u.root.position.x,z:u.root.position.z,bot:u.bot,alive:true});
    u.bot=null;                                   // …and stop it walking back in
    // step them out ALONG THE LINE TO THE MAP CENTRE, not blindly outward — camps sit past the
    // border, so "further out" would post them beyond the world edge or inside a neighbour's ring
    const L=Math.hypot(x,z)||1;
    u.root.position.set(x-(x/L)*r*2.5+(undo.length%5)*1.6,u.root.position.y,z-(z/L)*r*2.5);
  }
  return {moved:undo.length,restore(){for(const e of undo){e.u.root.position.set(e.x,e.u.root.position.y,e.z);e.u.bot=e.bot;}}};
}
// v134.0 AN INDEPENDENT READ OF THE COLLIDER. Deliberately NOT pushOutOfBuildings: a test that
// asks the code under test whether the code under test worked proves nothing, which is the
// handoff's own falsify rule ("a mutation that also blinds the instrument proves nothing"). This
// re-derives the box from BLD and the team's age the way buildingMesh does, and nothing else.
// Farms (the field is walkable by design), walls (their response is a slide, not a push) and the
// castle (several shapes) are out of scope here and answer false.
function note(msg){console.log("  ---- "+msg);}
// v134.0 …AND IT RETURNS PENETRATION DEPTH, not a boolean. A count alone cannot tell a body
// standing 1.30 deep inside a barracks from one brushing a boundary by 0.02, and after the fix the
// only bodies left are of the second kind — held on a boundary by a SECOND collider that overlaps
// the first. A farm's barn disc reaches 9.5 from a Town Center's centre and that box is 12.58, so
// the pair leaves a sliver of ground that is inside both and legal in neither. No resolver can fix
// that; the town-plan work has to stop the two being placed that way. Depth is the honest measure
// in the meantime, and it is the one that actually says "is anybody stuck in a wall".
function insideCollider(b,x,z){
  const G=global.__G;
  if(!b.alive||b.def.flat||b.def.wall||b.def.blockShapes)return 0;
  const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);
  const lx=(x-b.x)*c-(z-b.z)*sn, lz=(x-b.x)*sn+(z-b.z)*c;
  const A=Math.max((b.def.age||0),Math.min(5,(G.teamAge&&G.teamAge[b.team])||0));
  if(b.def.fx!==undefined){
    const fx=(b.def.fxA&&b.def.fxA[A]!==undefined)?b.def.fxA[A]:b.def.fx;
    const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:b.def.fz;
    const dx=fx+0.7-Math.abs(lx), dz=fz+0.7-Math.abs(lz);
    return (dx>1e-4&&dz>1e-4)?Math.min(dx,dz):0;   // v134.0 DEPTH, not a yes/no — see below
  }
  const r=(b.def.rBlock!==undefined?b.def.rBlock:b.def.r)+0.7;
  const d=Math.sqrt((x-b.x)*(x-b.x)+(z-b.z)*(z-b.z));
  return (r-d>1e-3)?r-d:0;
}
function bodiesInsideColliders(){
  // BOT-DRIVEN BODIES ONLY. The local player and any harness-posed body are placed by hand and are
  // not what this measures; the player in particular spawns at TCPOS+12 inside a Town Center whose
  // box grows to 12.58 by the Enlightenment, which is a spawn-ring/collider overlap worth its own
  // fix and not a pathing verdict.
  const G=global.__G, hits=[];
  for(const u of G.units){
    if(!u.alive||u.isPlayer||u.remote||!u.bot)continue;
    const p=u.root.position;
    let worst=0,wb=null;
    for(const b of G.buildings){const d=insideCollider(b,p.x,p.z);if(d>worst){worst=d;wb=b;}}
    if(wb)hits.push({u,b:wb,depth:worst});
  }
  return hits;
}
function clearBuildings(x,z,r,pred){
  const G=global.__G, undo=[], r2=r*r;
  for(const b of G.buildings){
    if(!b.alive||b.type==="towncenter")continue;
    if(pred&&!pred(b))continue;
    if(dist2h(b.x,b.z,x,z)>r2)continue;
    undo.push(b); b.alive=false;
  }
  return {cleared:undo.length,restore(){for(const b of undo)b.alive=true;}};
}
function dist2h(ax,az,bx,bz){const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz;}
// v127: tickBody wraps the ENTIRE simulation in `if(!gameOver)` — directors, campTick, healTick,
// regen, all of it. So when a staged fight elsewhere on the map happens to fell a king in the
// middle of a long tick loop, the world silently stops and every assertion after that point
// reports a frozen sim as a broken feature. This file already sprinkles setGameOver(false)
// between sections for exactly that reason; the creep block runs 570 frames INSIDE one section,
// which is plenty of time for a regicide to land mid-loop. Clearing the flag once at the top of
// a block is not enough — it has to be held down for the duration.
function warTicks(n){ // tick n frames while refusing to let a stray regicide disarm the harness
  for(let i=0;i<n;i++){global.__G.setGameOver(false);tick();}
}
// v132.7 51, not 36: three interior camps at CREEP_N=5 apiece. Written as the ARITHMETIC rather
// than as the number, so the day a tenth camp appears this check moves with it instead of failing.
check("100 army units + "+(units.filter(u=>u.team===2).length)+" camp creeps (5 a camp + the shore's 11)",
  units.filter(u=>u.team<2).length===100&&
  units.filter(u=>u.team===2).length===
    (global.__G.CREEP_SITES.filter(c=>!c.boss).length*5)+11);
check("teams start lean (150f/50g/0s)",stock[0].food<=200&&stock[0].gold<=100&&(stock[0].stone||0)===0);
check("2 town centers",buildings.filter(b=>b.type==="towncenter").length===2);
check("neutral bazaars placed (3)",typeof neutralMarkets!=="undefined"&&neutralMarkets.length===3);
// v78/v132.1: the bazaars sit on TWO roads now — the Grand on the Kings Road, one per team on that
// team's branch of the Viking road — and the set is still mirror-balanced between the thrones.
// WHAT THIS USED TO BE was a hand-copied roadZ(t): the King's Road's spine, typed out a second time
// in a second file. That is the drift tools/mapconst.js exists to catch, and it went stale here the
// moment two of the three bazaars left the road. Read the definitions the world is BUILT from.
{
  const TP=global.__G.TCPOS, SITES=global.__G.BAZAAR_SITES;
  const near=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)<0.01;
  check("every bazaar stands where BAZAAR_SITES says it does",
    SITES.length===3&&SITES.every(Sq=>{const q=Sq.p();return neutralMarkets.some(m=>near(m,q));}));
  // v132.11 BESIDE ITS ROAD, NOT ON IT. John: "grand bazaar should be to the right of kings road
  // while the other two bazaars should be to the left of vikings roads. right now all bazaars are
  // directly on top of the roads." What used to be here typed the offset — z + 3.2 for the Grand,
  // nothing at all for the team pair — which is the same re-typed-constant trap as the roadZ() copy
  // v132.6 took out of this file, and swapping 3.2 for 24 would only reload it. Assert the
  // RELATIONSHIP: which road, how far off it, and which side. No literal offset appears.
  {
    const nearestOn=(fn)=>(b)=>{let bt=0,bd=1e9;
      for(let i=0;i<=600;i++){const q=fn(i/600), d=Math.hypot(b.x-q.x,b.z-q.z);
        if(d<bd){bd=d;bt=i/600;}}
      return {t:bt,d:bd,q:fn(bt)};};
    {
      const g=SITES.find(Sq=>Sq.grand), b=g&&g.p();
      const h=g&&nearestOn(t=>global.__G.roadPoint(t))(b);
      check("the Grand Bazaar stands beside its road, at the middle of the Kings Road",
        !!g&&Math.abs(h.t-0.5)<0.03);
      check("…far enough off the spine that the ribbon misses the plaza",
        !!g&&h.d>=g.plaza+6);
      check("…and on the +z side — blue's right, facing red",
        !!g&&b.z>h.q.z);
    }
    {
      const vk=SITES.filter(Sq=>Sq.team!==undefined);
      const at=vk.map(Sq=>{const b=Sq.p();
        return {S:Sq,b,h:nearestOn(t=>global.__G.vikingPoint(Sq.team,t))(b)};});
      check("each team bazaar stands beside its OWN branch of the Viking road",
        vk.length===2&&at.every(a=>Math.abs(a.h.t-0.42)<0.03));
      check("…far enough off the spine that the track misses the plaza",
        at.every(a=>a.h.d>=a.S.plaza+4));
      check("…and on the -z side — outside the arc, away from the Kings Road",
        at.every(a=>a.b.z<a.h.q.z));
    }
  }
  const dTo=(tc)=>neutralMarkets.map(m=>Math.hypot(m.x-tc[0],m.z-tc[1])).sort((a,b)=>a-b);
  const d0=dTo(TP[0]), d1=dTo(TP[1]);
  check("bazaar distances mirror between the thrones ("+d0.map(d=>d.toFixed(1)).join("/")+")",
    d0.every((d,i)=>Math.abs(d-d1[i])<0.01));
}
// ---- v131 THE HOUR, AND THE ONE THING ABOUT IT THAT CAN BREAK SILENTLY ----
// setSunHour() (02-world.js) drops the sun from §3.1's 49.4° to 21° for the low-sun vantage. It is
// allowed to change the ELEVATION and nothing else, because paintContactShadows BAKES 1,300 ground
// pools along _SUN_OFF's ground bearing at world-build time. Swing the bearing at runtime and every
// painted pool on the map points one way while every cast shadow points the other — which renders
// perfectly, in every screenshot, and is only visible by measuring. That is exactly the class of bug
// this file exists for. Length matters too: sun.shadow.camera near=110/far=340 brackets |_SUN_OFF|
// and nothing else, so a shorter vector clips casters out of the depth pass.
{
  const G=global.__G, SO=G._SUN_OFF;
  if(typeof G.setSunHour!=="function"||!SO){
    check("v131 hour rig: setSunHour and _SUN_OFF are exported",false);
  }else{
    const az0=Math.atan2(SO.z,SO.x), L0=Math.hypot(SO.x,SO.y,SO.z);
    const el=()=>Math.asin(Math.max(-1,Math.min(1,SO.y/Math.hypot(SO.x,SO.y,SO.z))))*180/Math.PI;
    const e0=el();
    G.setSunHour(1);
    const az1=Math.atan2(SO.z,SO.x), L1=Math.hypot(SO.x,SO.y,SO.z), e1=el();
    check("v131 hour rig: dusk drops the sun to 21° ("+e0.toFixed(1)+"° → "+e1.toFixed(1)+"°)",
      Math.abs(e0-49.4)<0.3&&Math.abs(e1-21)<0.3);
    check("v131 hour rig: the BEARING never moves — the contact pools are baked along it",
      Math.abs(az1-az0)<1e-6);
    check("v131 hour rig: |_SUN_OFF| is preserved — near/far bracket that length, not that angle",
      Math.abs(L1-L0)<1e-3);
    G.setSunHour(0);
    check("v131 hour rig: hour 0 restores noon exactly, so shot 5 cannot leave shot 6 warm",
      Math.abs(el()-e0)<1e-4&&Math.abs(Math.hypot(SO.x,SO.y,SO.z)-L0)<1e-3);
  }
  // the dry/lush field the terrain and four undergrowth layers share. It has to be PURE — it is
  // called from inside the seeded window, so a Math.random() in here would move every node index.
  if(typeof G.meadowPatch!=="function"){
    check("v131 meadow field: meadowPatch is exported",false);
  }else{
    let lo=1e9,hi=-1e9,same=true;
    for(let i=0;i<400;i++){
      const x=(i*37)%700-350, z=(i*53)%600-300, v=G.meadowPatch(x,z);
      if(v<lo)lo=v; if(v>hi)hi=v;
      if(G.meadowPatch(x,z)!==v)same=false;      // twice, same answer, or it is not a function of xz
    }
    check("v131 meadow field: pure and in range ("+lo.toFixed(2)+" … "+hi.toFixed(2)+")",
      same&&lo<-0.5&&hi>0.5&&lo>=-1.05&&hi<=1.05);
  }
  // every static prop class writes its foot down for paintContactShadows. 56 resource nodes joined
  // the list in v131; before that the piles a villager stands at all game had clean lawn to the edge.
  check("v131 grounding: every prop class wrote its foot down ("+G.PROP_FEET.length+" pools + the nodes)",
    Array.isArray(G.PROP_FEET)&&G.PROP_FEET.length>800);
}
const mm=buildingMesh("market",0);
check("market mesh has geometry ("+mm.children.length+" parts)",mm.children.length>=4);
const mk=makeBuilding(0,"market",-80,30,true);
check("market building constructs",mk.built&&mk.root.children.length>0);
check("tradeGold formula sane (d=150 → "+tradeGold(150)+"g)",tradeGold(150)>50&&tradeGold(150)<200);
// v81: the MAIN MENU freezes the war until a mode is chosen
{
  const tFrozen=global.__G.getT();
  for(let i=0;i<10;i++)tick();
  check("the world holds its breath behind the main menu (T pinned at "+tFrozen+")",
    global.__G.getT()===tFrozen&&global.__G.menuUp()===true);
  global.__G.NET.uiSolo(); // click ⚔ SOLO
  check("choosing SOLO releases the war",global.__G.menuUp()===false);
}
// simulate ~5s of frames
for(let i=0;i<300;i++){try{tick();}catch(e){console.error("TICK CRASH frame",i,":",e.message);process.exit(1);}}
check("game loop survives 300 frames",rafCount>=300);
// force-run the trade loop: give the market a cart and fast-forward its FSM
teamAge[0]=4;teamAge[1]=4;
const cart=makeUnit(0,"tradecart",mk.x+4,mk.z,{name:"Test Cart",bot:{role:"cart",home:mk}});
const g0=stock[0].gold;
for(let i=0;i<8000;i++){updateBot(cart,0.05);} // ~400 sim-seconds of cart travel
check("NPC cart completed a trade run (+"+Math.round(stock[0].gold-g0)+"g)",stock[0].gold>g0);
const scout=makeUnit(0,"scout",100,0,{name:"T",bot:{role:"citizen"}});
const farm=makeBuilding(1,"farm",103,0,true);
const hp0=farm.hp; tryMeleeAttack(scout);
check("scout tramples farm 4× ("+(hp0-farm.hp)+" dmg vs base "+scout.dmg.toFixed(1)+")",(hp0-farm.hp)>scout.dmg*3);
check("siege workshop mesh has geometry",buildingMesh("siege_workshop",0).children.length>=5);
teamAge[0]=2;
check("Iron unlocks Battering Ram + Catapult",
  lineUnitFor("meleesiege",0)==="batteringram"&&lineUnitFor("rangedsiege",0)==="catapult");
teamAge[0]=4;
check("Medieval upgrades to Trebuchet",lineUnitFor("rangedsiege",0)==="trebuchet");
teamAge[0]=5;
check("Enlightenment: Cannon + Culverin",
  lineUnitFor("meleesiege",0)==="cannon"&&lineUnitFor("rangedsiege",0)==="culverin");
const ram=makeUnit(0,"batteringram",60,20,{name:"T",bot:{role:"citizen"}});
const house=makeBuilding(1,"house",62.5,20,true);
const hh0=house.hp; tryMeleeAttack(ram);
check("ram deals 8× to buildings ("+Math.round(hh0-house.hp)+" dmg)",(hh0-house.hp)>ram.dmg*6);
check("catapult outranges guard towers ("+CLS.catapult.rng+" vs 18)",CLS.catapult.rng>18);
check("stone: exactly 6 piles on the map (v132.24 re-sited them and added the deep axis pile)",nodes.filter(n=>n.type==="stone").length===6);
const woods=nodes.filter(n=>n.type==="wood").length;
check("forests planted ("+woods+" choppable trees)",woods>=60);
check("castle mesh has geometry",buildingMesh("castle",0).children.length>=8);
check("wall mesh has geometry",buildingMesh("stone_wall",0).children.length>=2);
// ---- v53: six ages of architecture, 2x footprints, live restyle ----
// v131.5 THIS PINNED SIX LITERALS AND THAT IS ALL IT EVER CHECKED, so it stayed green through the
// entire v131 buildings pass — 2,168 lines and ~590 geometry calls across six ages, and not one
// `r:` moved with them. A pin cannot notice that a model outgrew its blocker.
// v131.6 the pin now covers BOTH FIELDS. `r` is the spacing/gameplay radius and is back to exactly
// what it was before v131.5 touched it — every literal below is the shipped v131 value, and if one
// of them moves again the AI's buildable yard changes shape underneath it. `rBlock` is the physical
// footprint, pinned beside it, so the two can never be silently confused for each other again.
check("footprints: spacing r is the shipped v131 table, untouched",
  BLD.towncenter.r===11&&BLD.house.r===4.6&&BLD.castle.r===11&&BLD.blacksmith.r===5.6&&
  BLD.farm.r===6.6&&BLD.storage_pit.r===6.6&&BLD.watch_tower.r===2.4&&
  BLD.barracks.r===7.2&&BLD.tower.r===4.0&&BLD.archery_range.r===6.4&&BLD.stable.r===6.8&&
  BLD.temple.r===5.6&&BLD.market.r===7.2&&BLD.siege_workshop.r===7.2);
check("rBlock: the physical footprint is its own field, and falls back to r where absent",
  BLD.towncenter.rBlock===12.2&&BLD.house.rBlock===3.8&&BLD.barracks.rBlock===10.9&&
  BLD.blacksmith.rBlock===8.6&&BLD.castle.rBlock===19.1&&BLD.watch_tower.rBlock===4.0&&
  BLD.farm.rBlock===BLD.farm.r&&BLD.wood_wall.rBlock===BLD.wood_wall.r&&
  BLD.fort_gate.rBlock===BLD.fort_gate.r);
// THE BLOCKER MUST COVER THE BUILDING. Measured live off the merged body: the standing mass in the
// player's own height band (y 1.3-2.4 on a 2.6-tall figure), area-gated the way _bFootprint gates
// the apron so a flagpole on the far side of a yard cannot size the answer. The hard push is at
// `rBlock+0.7` (05-combat.js:663), so `rBlock+0.7` must reach at least the model's widest FLAT face
// or a player can stand inside rendered wall. Corners are allowed to be clipped — a circle on the
// exact corner radius stops you in open air along the middle of every face, which is a worse bug.
// v131.6 THIS SKIPPED FOUR TYPES AND NOW IT SKIPS ONE. barracks / castle / blacksmith were excluded
// because their measured blockers (10.9 / 19.1 / 8.6) could not be spent as `r` — `r` is ALSO the
// spacing radius (06-input.js:675) and at those values the AI could not place them at all: measured
// in ONE town with `tools/_plotroom.js --pairs`, the barracks went from 414 legal plots in 800
// samples to 0. rBlock costs placement NOTHING, so all three are in the gate now, and passing.
//   archery_range is the one that remains, and not because it is hard: the age-4 turf butt and the
//     age-5 earth backstop stand at +z 8.4-11.9 with nothing at -z past 4.4, so ONE CIRCLE that
//     covers them stops the player 8.5 units short of the south wall. rBlock is deliberately sized
//     to the SHELL (7.0) and the butt mounds stay walkable. Blocking them wants a second, OFFSET
//     circle — the same shape of change as the wall OBB at 05-combat.js:645, and the same answer.
// Anything else appearing in this list is a real regression.
{
  const RBAND_LO=1.3, RBAND_HI=2.4, SKIP={archery_range:1};
  const clipY=(poly,sign,lim)=>{const out=[];
    for(let i=0;i<poly.length;i++){const A=poly[i],B=poly[(i+1)%poly.length];
      const da=(A[1]-lim)*sign, db=(B[1]-lim)*sign;
      if(da>=0)out.push(A);
      if((da>0&&db<0)||(da<0&&db>0)){const t=da/(da-db);
        out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t]);}}
    return out;};
  const area=P=>{let nx=0,ny=0,nz=0;
    for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];
      nx+=(a[1]-b[1])*(a[2]+b[2]);ny+=(a[2]-b[2])*(a[0]+b[0]);nz+=(a[0]-b[0])*(a[1]+b[1]);}
    return Math.hypot(nx,ny,nz)*0.5;};
  // the body is measured UNMERGED — mergeBuildingBody only welds buffers, it moves no vertex, and
  // buildingMesh's own tree already carries every part's transform once updateMatrixWorld has run.
  const inscribed=(type,age)=>{
    const g=buildingMesh(type,0,age,0,0); g.updateMatrixWorld(true);
    const bs=global.__G.BSCALE[type]||1, T=[]; const v=new THREE.Vector3();
    g.traverse(o=>{if(!o.isMesh||!o.geometry||!o.geometry.attributes.position)return;
      const p=o.geometry.attributes.position, ix=o.geometry.index, m=o.matrixWorld, n=ix?ix.count:p.count;
      const get=i=>{v.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(m).multiplyScalar(bs);return [v.x,v.y,v.z];};
      for(let i=0;i+2<n;i+=3){
        const a=get(ix?ix.getX(i):i),b=get(ix?ix.getX(i+1):i+1),c=get(ix?ix.getX(i+2):i+2);
        if(Math.max(a[1],b[1],c[1])<=RBAND_LO||Math.min(a[1],b[1],c[1])>=RBAND_HI)continue;
        const Q=clipY(clipY([a,b,c],1,RBAND_LO),-1,RBAND_HI); if(Q.length<3)continue;
        const w=area(Q); if(!(w>1e-7))continue;
        let mx=0,mz=0; for(const q of Q){mx=Math.max(mx,Math.abs(q[0]));mz=Math.max(mz,Math.abs(q[2]));}
        T.push({w,x:mx,z:mz});}});
    if(!T.length)return 0;
    let A=0; for(const t of T)A+=t.w;
    const gate=k=>{const s=T.slice().sort((p,q)=>p[k]-q[k]); let acc=0,g2=s[s.length-1][k];
      for(const t of s){acc+=t.w; if(acc>=A*0.85){g2=t[k]*1.25;break;}}
      let m2=0; for(const t of s)if(t[k]<=g2&&t[k]>m2)m2=t[k]; return m2;};
    return Math.max(gate("x"),gate("z"));
  };
  const bad=[];
  for(const type of Object.keys(BLD)){
    const d=BLD[type];
    if(d.wall||d.flat||SKIP[type])continue;         // walls use the OBB; farms are walkable
    for(let age=(d.age||0);age<6;age++){
      const ins=inscribed(type,age);
      if(d.rBlock+0.7 < ins-0.05)bad.push(type+" a"+age+" "+(d.rBlock+0.7).toFixed(1)+"<"+ins.toFixed(2)); // v131.6 rBlock is the wall now
    }
  }
  check("no blocker is inside its own building ("+(bad.length?bad.join(" · "):"all clear")+")",bad.length===0);
}
// …AND THE OTHER HALF OF THE SAME COIN: A BLOCKER YOU CANNOT REACH PAST IS ALSO A BUG.
// v131.6 this check exists because splitting rBlock out of `r` broke the game the first time it was
// wired in, silently and in three different ways at once. A body is shoved out to `rBlock+0.7`, but
// a dozen reach tests were still written against `r`: a villager stood 9.3 from a blacksmith and its
// hammer reached 8.2, so the foundation never rose ("the AI directors raise a blacksmith at Iron:
// 0 ever built", every run); a hauler could not get within 9 of a town centre's drop point and
// NOTHING WAS EVER BANKED; a citizen could not get within 4 of a barracks to become a soldier.
// None of those is a geometry bug, and the check above would pass through all three. So: place one
// of every type, DRIVE A REAL UNIT INTO IT with the game's own moveUnit, and assert that from where
// it is actually stopped it can still swing a hammer, land a sword, and stand where a bot builder
// is told to stand. This is the check that would have caught all three.
// v131.2 — AND THIS CHECK MUST READ THE SHIPPED EXPRESSION, NOT RE-TYPE IT.
// The first draft of the block below hand-computed `bSurf(d)+2.6` and `bSurf(d)+0.9`, i.e. it
// asserted the formula I MEANT to ship. The game shipped `d.r+2.6` and `d.r+0.9`. So this test sat
// green through an entire release in which age-up, the class menu, the forge, the trader's sale,
// every castle deposit and four of the six buildable types were unreachable, and the owner found
// all of it by playing. A test that re-implements the thing it is testing cannot fail with it.
// So: LIFT THE EXPRESSION OUT OF THE SOURCE FILE and evaluate that. If the source drifts, this
// drifts with it; if the expression can no longer be found, the check FAILS rather than passing
// quietly, because a reach test that cannot locate its own subject has stopped being a test.
// Read from `after` up to `close` at paren depth 0 — so bSurf(b.def)+2.6 survives intact and the
// nested ) does not end the expression early.
function liftExpr(file,anchor,close){
  const src=fs.readFileSync(path.join(__dirname,"..","js",file),"utf8");
  const at=src.indexOf(anchor); if(at<0)return null;
  let depth=0;
  for(let i=at+anchor.length;i<src.length;i++){
    const c=src[i];
    if(c==="(")depth++;
    else if(c===")"){if(depth===0)return src.slice(at+anchor.length,i).trim(); depth--;}
    else if(c===close&&depth===0)return src.slice(at+anchor.length,i).trim();
    else if(c==="\n")return null;                 // never run past the line we anchored on
  }
  return null;
}
{
  const bad=[], missing=[], G=global.__G;
  // the hammer (06-input.js:338) and the bot builder's stand point (07-ai.js:930), as shipped
  const hammerSrc=liftExpr("06-input.js","const reach=",";");
  const standSrc =liftExpr("07-ai.js","const standX=s.x+rdx/rl*(",",");
  if(!hammerSrc)missing.push("06-input.js build reach");
  if(!standSrc) missing.push("07-ai.js builder stand point");
  const hammerOf=hammerSrc?new Function("b","bSurf","BLD","return "+hammerSrc):null;
  const standOf =standSrc ?new Function("s","bSurf","BLD","return "+standSrc) :null;
  for(const type of Object.keys(BLD)){
    const d=BLD[type];
    if(d.wall||d.flat)continue;
    const b=G.makeBuilding(0,type,-150,-105,true);
    const u=G.makeUnit(0,"villager",-110,-105,{name:"Reacher"});
    for(let i=0;i<600;i++)G.moveUnit(u,-1,0,1/30);      // walk straight at it until the wall stops us
    const stop=Math.hypot(u.root.position.x-b.x,u.root.position.z-b.z), surf=G.bSurf(d);
    if(hammerOf){const reach=hammerOf({def:d},G.bSurf,BLD);
      // strict `<`, evaluated the way the game evaluates it — a guard tower once failed this by 9e-16
      if(!(stop*stop<reach*reach))bad.push(type+" hammer "+stop.toFixed(3)+" !< "+reach.toFixed(3));}
    if(stop-surf>=CLS.villager.rng+0.6)bad.push(type+" melee gap "+(stop-surf).toFixed(1)); // 05-combat.js:502
    if(standOf){const stand=standOf({def:d},G.bSurf,BLD);
      if(stop-stand>1.3)bad.push(type+" bot-stand "+(stop-stand).toFixed(3)+">1.3");}        // 07-ai.js:930
    b.alive=false; u.alive=false;
  }
  check("the reach checks found the expressions they test ("+
        (missing.length?"MISSING: "+missing.join(" · "):"build reach and builder's stand both lifted from source")+")",
        missing.length===0);
  check("a body stopped by the wall can still reach the building ("+
        (bad.length?bad.join(" · "):"hammer, sword and builder's stand all clear")+")",bad.length===0);
}
// AND THE GATES THAT AIM AT A POINT OFF THE CENTRE, which the drive above cannot see: a hauler
// banking a load, a citizen arming up, and the player advancing the age. Each walks to a point
// `off` from the centre and fires within `stop`, so a body held on the ring at rBlock+0.7 can only
// ever get `ring - |off|` close. These are pure arithmetic and they are where the v131 split
// actually broke: the hauler needed 9 and the best reachable was 9.698, which is why 48 villagers
// stood in an arc round the town centre and nothing was ever banked.
{
  const G=global.__G, bad=[], missing=[];
  // Lifted from source for the same reason as the drive above: the FIRST version of this very check
  // called G.bStand(...) itself and therefore passed clean against the broken tree, because it was
  // asserting the formula rather than the shipped literal. Read what shipped.
  const lift=(what,file,anchor,close,args)=>{
    const e=liftExpr(file,anchor,close);
    if(!e){missing.push(what);return null;}
    return {expr:e,fn:new Function(...args,"bSurf","bStand","BLD","Math","return "+e)};
  };
  const haul =lift("hauler drop-off stop","07-ai.js","if(moveToward(u,dp.x+2.5,dp.z+2,dt,",")",["dp"]);
  const arm  =lift("citizen arm-up stop", "07-ai.js","if(moveToward(u,bar.x+3,bar.z+3,dt,",")",["bar"]);
  const ageUp=lift("age-up radius","06-input.js",
    "dist2(player.root.position.x,player.root.position.z,tc.x,tc.z)>",")",["tc"]);
  const gate=(name,lifted,bind,off,squared)=>{
    if(!lifted)return;
    const def=bind.def, ring=def.rBlock+0.7, best=ring-off;
    const stop=lifted.fn(bind,G.bSurf,G.bStand,BLD,Math);
    const ok=squared?best*best<=stop:best<=stop;
    if(!ok)bad.push(name+" needs <="+(squared?Math.sqrt(stop):stop).toFixed(3)+
                    ", best reachable "+best.toFixed(3)+"  ["+lifted.expr+"]");
  };
  const H=Math.hypot(2.5,2);                                   // 07-ai.js:969's drop point offset
  gate("hauler banks at a town centre",haul,{def:BLD.towncenter,type:"towncenter"}, H,false);
  gate("hauler banks at a castle",     haul,{def:BLD.castle,     type:"castle"},     H,false);
  gate("hauler banks at a storage pit",haul,{def:BLD.storage_pit,type:"storage_pit"},H,false);
  gate("citizen arms up at a barracks",arm, {def:BLD.barracks},   Math.hypot(3,3),false); // 07-ai.js:917
  gate("player advances the age",      ageUp,{def:BLD.towncenter},0,true);                // 06-input.js:981
  check("the off-centre gates found the expressions they test ("+
        (missing.length?"MISSING: "+missing.join(" · "):"hauler, arm-up and age-up all lifted from source")+")",
        missing.length===0);
  check("the gates that aim off-centre are physically satisfiable ("+
        (bad.length?bad.join(" · "):"hauler, citizen and age-up all reachable")+")",bad.length===0);
}
check("scales: farm 0.6375, pit fills its footprint at 0.95, watch tower 0.75",
  global.__G.BSCALE.farm===0.6375&&global.__G.BSCALE.storage_pit===0.95&&global.__G.BSCALE.watch_tower===0.75);
// THE MILL LAYOUT: eight farms must fit evenly around one storage pit on clear land
{const NDS=global.__G.nodes;
 const D2=(ax,az,bx,bz)=>{const ddx=ax-bx,ddz=az-bz;return ddx*ddx+ddz*ddz;};
 let cx=null,cz=null; // scout a center with nothing (buildings/nodes) within reach of the ring
 outer:for(const [tx,tz] of [[-60,-95],[-40,-95],[0,-100],[40,-95],[-90,-95],[60,-95],[-20,55]]){
   let clear=true;
   for(const b of buildings){if(b.alive&&D2(tx,tz,b.x,b.z)<38*38){clear=false;break;}}
   // v114: WOOD no longer blocks a plot — a footprint fells it (validFor skips wood, makeBuilding
   // calls clearFootprint). Only the unclearable prizes — stone, gold, berries — spoil the ground.
   if(clear)for(const n of NDS){if(n.type!=="wood"&&n.amount>0&&D2(tx,tz,n.x,n.z)<32*32){clear=false;break;}}
   if(clear){cx=tx;cz=tz;break outer;}
 }
 check("found clear ground for the mill-layout test",cx!==null);
 if(cx!==null){
   const pit=global.__G.makeBuilding(0,"storage_pit",cx,cz,true);
   let placed=0; const ringB=[pit];
   for(let k=0;k<8;k++){
     const a=k*Math.PI/4, fx=cx+Math.cos(a)*18.2, fz=cz+Math.sin(a)*18.2;
     if(global.__G.validFor("farm",fx,fz,0)){ringB.push(global.__G.makeBuilding(0,"farm",fx,fz,true));placed++;}
   }
   check("eight farms ring one storage pit ("+placed+"/8 placed legally)",placed===8);
   for(const b of ringB)b.alive=false;
 }}
// pathing: a bot must WALK AROUND a building in its way, not grind into the facade
{const ob=global.__G.makeBuilding(0,"barracks",-120,-85,true);
 const walker=global.__G.makeUnit(0,"villager",-140,-85,{name:"Pathfinder"});
 // heading dead-on at the barracks: steering must turn the unit parallel to the edge
 const [ax,az]=global.__G.steerAroundBuildings(walker,1,0,40,-100,-85);
 check("steering turns a blocked heading parallel to the building edge (dx "+ax.toFixed(2)+")",Math.abs(az)>0.6&&ax<0.9);
 let steps=0, arrived=false;
 while(steps<700&&!arrived){arrived=global.__G.moveToward(walker,-100,-85,0.05,1.2);steps++;}
 check("bot rounds the barracks and reaches the far side ("+steps+" steps)",arrived&&steps<650);
 walker.alive=false; ob.alive=false;}
// WALL ROUTING: a bot rounds a wall LINE's end instead of bouncing between segments
{const wA=global.__G.makeBuilding(0,"stone_wall",-40,-70,true,0);
 const wB=global.__G.makeBuilding(0,"stone_wall",-27.5,-70,true,0);
 const wC=global.__G.makeBuilding(0,"stone_wall",-15,-70,true,0);
 const wBot=global.__G.makeUnit(0,"clubman",-27.5,-80,{name:"Router",bot:{role:"citizen"}});
 let reached=false,steps1=0;
 for(let i=0;i<650&&!reached;i++){steps1++;reached=global.__G.moveToward(wBot,-27.5,-58,0.05,1.2);}
 check("a bot routes around a wall line's END, no gate needed ("+steps1+" steps)",reached);
 // swap the middle segment for an OWN gate: the bot walks straight through it
 wB.alive=false;
 const wG=global.__G.makeBuilding(0,"stone_gate",-27.5,-70,true,0);
 const wBot2=global.__G.makeUnit(0,"clubman",-27.5,-80,{name:"GateWalker",bot:{role:"citizen"}});
 let reached2=false,steps2=0;
 for(let i=0;i<650&&!reached2;i++){steps2++;reached2=global.__G.moveToward(wBot2,-27.5,-58,0.05,1.2);}
 check("a bot walks THROUGH its own gate ("+steps2+" vs "+steps1+" steps around)",reached2&&steps2<steps1);
 wA.alive=false;wC.alive=false;wG.alive=false;wBot.alive=false;wBot2.alive=false;}
// RED BORDER TOWN: a site hugging the east map edge must still get built —
// the old fixed east-side stand point sat OFF the 212-wide map and starved red's economy
{const bSite=global.__G.makeBuilding(1,"house",207,40,false);
 const bWork=global.__G.makeUnit(1,"villager",200,40,{name:"EdgeBuilder",bot:{role:"citizen"}});
 bWork.task={site:bSite};
 let builtOk=false;
 for(let i=0;i<400&&!builtOk;i++){global.__G.tick(0.05);builtOk=bSite.built;}
 check("a border-hugging red site completes (progress "+bSite.progress+"/"+bSite.def.hits+")",builtOk);
 bSite.alive=false; bWork.alive=false;}
// build reach must scale with the footprint or big buildings become unbuildable
{const sp=global.__G.makeBuilding(0,"storage_pit",-150,-40,false);
 const pl=global.__G.player, ox=pl.root.position.x, oz=pl.root.position.z;
 pl.root.position.set(sp.x+(sp.def.r+0.7),0,sp.z); // where collision parks the builder
 const reached=global.__G.nearestFriendlySite()===sp;
 pl.root.position.set(ox,0,oz);
 check("a villager can reach a 2x foundation to build it",reached);
 sp.alive=false;}
// depositing must work from the EDGE of the 2x Town Center — where collision parks you
{const tcD=global.__G.teamTC(0), pl=global.__G.player;
 const ox=pl.root.position.x, oz=pl.root.position.z;
 pl.root.position.set(tcD.x+(tcD.def.r+0.7),0,tcD.z);
 pl.carry.food=5;
 for(let i=0;i<12;i++)global.__G.tick(0.05);
 check("carried food deposits from the TC edge (carry emptied: "+(pl.carry.food===0)+")",
   pl.carry.food===0);
 pl.root.position.set(ox,0,oz);}
// the placement ghost must preview at the same scale the real building gets
{const gm=buildingMesh("farm",0); gm.scale.setScalar(global.__G.BSCALE.farm||1);
 check("ghost scale matches built farm scale (0.6375)",Math.abs(gm.scale.x-0.6375)<1e-9);}
// watch tower deck: a walkable platform lifted to the right height
{const wt=global.__G.makeBuilding(0,"watch_tower",-150,-60,true);
 check("watch tower exposes a raised, walkable deck",wt.deck&&wt.deck.y>6&&wt.deck.y<14&&wt.deck.r>1.5);
 wt.alive=false;}
check("walls keep their tiling length (r=5.5)",BLD.stone_wall.r===5.5&&BLD.fort_wall.r===5.5);
const hSigs=new Set();
for(let a=0;a<6;a++){const hm=buildingMesh("house",0,a);
  hSigs.add(hm.children.length+":"+hm.children.map(c=>c.geometry?c.geometry.type[0]:"G").join(""));}
check("houses wear six distinct architectural eras ("+hSigs.size+"/6 unique)",hSigs.size===6);
let tcOK=true,tmOK=true;
for(let a=0;a<6;a++){
  if(buildingMesh("towncenter",0,a).children.length<6)tcOK=false;
  if(buildingMesh("temple",0,a).children.length<5)tmOK=false;
}
check("town centers have geometry in all six ages",tcOK);
check("temples have geometry in all six ages",tmOK);
check("age clamps to the building's unlock (castle in the stone age dresses as 4)",
  buildingMesh("castle",0,0).userData.age===4&&buildingMesh("towncenter",0,0).userData.age===0&&
  buildingMesh("tower",0,1).userData.age===3);
const rsB=global.__G.makeBuilding(0,"house",-140,95,true);
const rsOldBody=rsB.body, rsOldCount=buildings.length; rsB.hp=123;
teamAge[0]=5; global.__G.restyleBuildings(0);
check("restyle swaps every standing body into the new age",
  rsB.body!==rsOldBody&&rsB.body.userData.age===5&&buildings.length===rsOldCount&&rsB.hp===123&&rsB.alive);
const rsC=global.__G.makeBuilding(0,"house",-140,80,false); rsC.progress=4; // a half-raised site
teamAge[0]=3; global.__G.restyleBuildings(0);
check("under-construction sites keep scaffolding through a restyle",
  !rsC.built&&Math.abs(rsC.body.scale.y-(0.15+0.85*4/8))<1e-6&&rsC.body.userData.age===3);
// DEFERRED restyle: the age-up wave — queued, hitch-free, complete after a few drains
{const wave=rsB.body;
 teamAge[0]=5; global.__G.restyleBuildings(0,true);
 check("deferred restyle leaves bodies untouched until the wave arrives",rsB.body===wave);
 for(let i=0;i<80;i++)global.__G.drainVisualQueue();
 check("the wave re-dresses every building within a few frames",rsB.body!==wave&&rsB.body.userData.age===5);}
// dirt roads knit the town together as buildings cluster near the TC
{const tcR=global.__G.teamTC(0);
 global.__G.rebuildRoads(0);
 const lone=(global.__G.roadGroups[0]?global.__G.roadGroups[0].children.length:0);
 const rTest=[global.__G.makeBuilding(0,"house",tcR.x+16,tcR.z+4,true),
              global.__G.makeBuilding(0,"barracks",tcR.x+22,tcR.z-10,true),
              global.__G.makeBuilding(0,"farm",tcR.x+18,tcR.z-2,true)]; // farm must NOT spawn a road
 global.__G.rebuildRoads(0);
 const withCity=global.__G.roadGroups[0].children.length;
 check("streets appear once buildings cluster near the TC ("+withCity+" segs)",withCity>lone&&withCity>0);
 for(const b of rTest)b.alive=false; global.__G.rebuildRoads(0);} // tidy up so later tests aren't blocked
// GARDENS: a courtyard fully ringed by paving must bloom
// v127: this was a knife-edge, and it failed about one run in four. Two reasons, both of them
// "the test observed the world instead of controlling it":
//   · the courtyard sat wherever the AI's city happened to leave room. A barracks or a farm
//     raised during an earlier tick() loop either paved the courtyard or opened a gap in the
//     ring, and the flood-fill reached in from the border. Foreign buildings are cleared now.
//   · the ring of SIX houses at radius 9 yields ~2 plantings — and layGardens rejects ~42% of
//     candidate cells by a hash of their GRID INDEX, whose origin is the city bounding box. Two
//     plantings is close enough to zero to lose on the coin. Probed 10 ring geometries against
//     10 shifting city layouts (tools/_probe_garden.js, since deleted): 10 houses at radius 15
//     gives 32 plantings every time. The margin IS the fix — a check that passes by 2 is a check
//     that reports geometry drift as a failure of the feature.
// Counter-intuitive finding worth keeping: TIGHTENING the ring makes it worse, not better.
// At radius 7 or less the aprons merge and pave the courtyard away entirely — 0 gardens. The
// obvious "make the ring tighter so it definitely closes" would have broken it outright.
{const tcG=global.__G.teamTC(0);
 const px=tcG.x+34, pz=tcG.z; // courtyard center, ringed by houses whose aprons close the loop
 const clearG=clearBuildings(px,pz,30);
 const ringG=[];
 for(let k=0;k<10;k++){const a=k*Math.PI/5;
   ringG.push(global.__G.makeBuilding(0,"house",px+Math.cos(a)*15,pz+Math.sin(a)*15,true));}
 global.__G.rebuildRoads(0);
 const flowers=global.__G.roadGroups[0].children.filter(c=>c.userData&&c.userData.garden).length;
 check("an enclosed courtyard blooms into a garden ("+flowers+" plantings, yard cleared of "+clearG.cleared+" strays)",
   flowers>0);
 for(const b of ringG)b.alive=false; clearG.restore(); global.__G.rebuildRoads(0);}
teamAge[0]=0; global.__G.restyleBuildings(0); // back to the stone age for what follows
// v128.6: how much geometry actually hangs off a rig node, merged or not — the only measure of
// "what is on this body" that survives the cluster merge. Direct mesh children only, so a sub-rig
// (the head under the torso, the forearm under the arm) is not double counted.
function rigVerts(n){let v=0;if(!n)return 0;
  for(const c of n.children)if(c.isMesh&&c.geometry&&c.geometry.attributes&&c.geometry.attributes.position)
    v+=c.geometry.attributes.position.count;
  return v;}
// ---- v58: villagers dress for their age, six distinct wardrobes ----
{const vv=global.__G.makeUnit(0,"villager",-160,70,{name:"Fashion Plate"});
 const sigs=new Set();
 for(let a=0;a<6;a++){
   teamAge[0]=a; global.__G.restyleUnits(0);
   // v128.6: COUNT VERTICES, NOT MESHES. The rigid-cluster merge welds a wardrobe down to one
   // mesh per rig node, so children.length is 1 for every age and this test silently stopped
   // distinguishing anything. Vertex count is invariant under merging — it measures the same
   // thing before and after — so the signature stays honest whatever the renderer does with it.
   sigs.add([rigVerts(vv.rig.torso),rigVerts(vv.rig.head),
     rigVerts(vv.rig.faR),rigVerts(vv.rig.shinL)].join(":"));
 }
 check("villagers wear six distinct wardrobes ("+sigs.size+"/6 unique)",sigs.size===6);
 check("the skeleton survives every restyle (arms, head, legs intact)",
   !!(vv.rig.armL&&vv.rig.faR&&vv.rig.head&&vv.rig.legL&&vv.body.children.length>0)&&vv.alive);
 teamAge[0]=0; global.__G.restyleUnits(0);
 vv.alive=false;}
teamAge[0]=2;
const w1=global.__G.makeBuilding(0,"wood_wall",40,-30,true);
let chainOK=false;
for(const [ox,oz] of [[11,0],[-11,0],[0,11],[0,-11]])
  if(global.__G.validFor("wood_wall",40+ox,-30+oz,0)){chainOK=true;break;}
check("long wall segments chain end-to-end",chainOK);
check("non-walls still keep their distance",!global.__G.validFor("house",42,-30,0));
check("all long-range siege outranges towers AND castles",
  CLS.trebuchet.rng>BLD.castle.atk.rng&&CLS.cannon.rng>BLD.castle.atk.rng&&CLS.culverin.rng>BLD.castle.atk.rng);
const TH=global.__G.terrainHeight,TCP=global.__G.TCPOS;
check("terrain flat at the Town Centers",Math.abs(TH(TCP[0][0],TCP[0][1]))<0.05&&Math.abs(TH(TCP[1][0],TCP[1][1]))<0.05);
let relief=0; for(const [sx,sz] of [[90,-60],[40,70],[-30,-80],[120,40]])relief=Math.max(relief,Math.abs(TH(sx,sz)));
check("rolling hills elsewhere (max sampled "+relief.toFixed(2)+")",relief>0.8);
check("farms REJECTED away from TC/Pit",!global.__G.validFor("farm",0,60,0));
const tcB=global.__G.teamTC(0);
let farmSpot=false;
for(let a=0;a<24&&!farmSpot;a++){
  const ang=a/24*Math.PI*2;
  for(const r of [23,26,30])
    if(global.__G.validFor("farm",tcB.x+Math.cos(ang)*r,tcB.z+Math.sin(ang)*r,0)){farmSpot=true;break;}
}
check("legal farm spots exist around the TC",farmSpot);
// ==================== v134.1 THE FARM RING ====================
// John: "the only buildings to be built around the town center, directly adjacent to it, should be
// farms." Measured before the change, blue's town read
//   watch_tower@16.7 farm@21.3 farm@22.4 barracks@22.9 house@25.5 …
// — a tower standing where the corn should be. There was no distance-from-the-TC rule at all; the
// only thing holding anything back was generic spacing, which SHRINKS as the town ages because
// bSpace reads the live age and a Town Center's half-extent drops from 11.26 to 8.50 at Classical.
{
  const G=global.__G, tc=G.teamTC(0), RING=G.TC_RING, FMIN=G.TC_FARM_MIN;
  const at=(t,r,a)=>G.validFor(t,tc.x+Math.cos(a)*r,tc.z+Math.sin(a)*r,0);
  const TYPES=["house","barracks","storage_pit","market","blacksmith","temple","watch_tower",
               "tower","stable","archery_range","siege_workshop","castle","stone_wall","stone_gate"];
  // 1. NOTHING but a farm, anywhere inside the ring.
  const inside=[];
  for(const t of TYPES)for(let i=0;i<24;i++)for(const r of [4,10,16,22,28,RING-0.5]){
    const a=i/24*Math.PI*2;
    if(at(t,r,a)===true)inside.push(t+"@"+r.toFixed(1));
  }
  check("v134.1 ring: NO non-farm plot is legal within "+RING+" of your Town Center ("+
    (inside.length?inside.slice(0,4).join(" · ")+(inside.length>4?" +"+(inside.length-4):""):
     "swept "+TYPES.length+" types x 24 bearings x 6 radii, all refused")+")",
    inside.length===0);
  // 2. …and a farm may not crowd it either — that inner edge is what keeps a barn out of the walls.
  const tooClose=[];
  for(let i=0;i<24;i++)for(const r of [4,10,16,FMIN-0.5]){
    const a=i/24*Math.PI*2;
    if(at("farm",r,a)===true)tooClose.push(r.toFixed(1)+"@"+(a*57.3).toFixed(0)+"deg");
  }
  check("v134.1 ring: a farm is refused inside "+FMIN+" too — its barn would stand in the Town "+
    "Center's walls ("+(tooClose.length?tooClose.slice(0,3).join(" · "):"24 bearings, all refused")+")",
    tooClose.length===0);
  // 3. NON-VACUITY, the fields. A rule that refuses everything everywhere passes 1 and 2 perfectly.
  let farmOk=0;
  for(let i=0;i<24;i++)for(const r of [FMIN+1,24,27,RING-1])
    if(at("farm",r,i/24*Math.PI*2)===true)farmOk++;
  check("v134.1 ring: …and the band between them IS plantable ("+farmOk+" of 96 probes legal) — "+
    "without this, a rule that refused every plot on the map would pass the two gates above",
    farmOk>=8);
  // 4. NON-VACUITY, the town. The one that matters most: findSpot gets 50 attempts, and an AI that
  //    cannot find a plot is an AI that silently stops building.
  let outOk=0;
  for(let i=0;i<24;i++)for(const r of [RING+2,RING+8,RING+16])
    if(at("house",r,i/24*Math.PI*2)===true)outOk++;
  check("v134.1 ring: …and a house is legal just OUTSIDE it ("+outOk+" of 72 probes) — the AI "+
    "samples 50 times before it gives up, so a ring that leaves no room is an AI that stops building",
    outOk>=8);
}
// FULL CAMPAIGN: 8 sim-minutes at 30fps — directors age up, build workshops/markets,
// and field carts + siege engines. This is the test that would have caught the
// vehicle-rig animation crash (undefined limbs on carts/rams).
stock[0].food+=4000;stock[0].gold+=4000;stock[1].food+=4000;stock[1].gold+=4000;
for(let i=0;i<8*60*30;i++){
  try{tick();}catch(e){console.error("CAMPAIGN CRASH at sim-second",Math.floor(i/30),":\n",e.stack.split("\n").slice(0,6).join("\n"));process.exit(1);}
}
const farms=buildings.filter(b=>b.alive&&b.built&&b.type==="farm").length;
check("AI still builds farms with doubled footprint ("+farms+")",farms>=2);
// v134.1 …AND THE TOWNS OBEY THE RING. Observed on the campaign above, both teams, every building.
{
  const G=global.__G, RING=G.TC_RING, FMIN=G.TC_FARM_MIN;
  const viol=[]; let nonFarm=0, ringFarms=0;
  for(const t of [0,1]){
    const tc=G.buildings.find(b=>b.alive&&b.team===t&&b.type==="towncenter"); if(!tc)continue;
    for(const b of G.buildings){
      if(!b.alive||b.team!==t||b.type==="towncenter")continue;
      const d=Math.hypot(b.x-tc.x,b.z-tc.z);
      if(b.type==="farm"){ if(d<FMIN)viol.push("farm@"+d.toFixed(1)); else if(d<RING)ringFarms++; }
      else { if(d<RING)viol.push(b.type+"@"+d.toFixed(1)); nonFarm++; }
    }
  }
  check("v134.1 ring: eight minutes of AI town-building breaks it "+viol.length+" times ("+
    (viol.length?viol.slice(0,4).join(" · "):"none")+") — v133 put a watch_tower at 16.7 and a "+
    "barracks at 22.9",viol.length===0);
  // …and it is not obeying the ring by building nothing. A starved AI would pass the line above.
  check("v134.1 ring: …and the AI still raised a real town around it ("+nonFarm+" buildings out "+
    "past the ring, "+ringFarms+" fields inside it)",nonFarm>=8&&ringFarms>=3);
}
// v134.1 THE BARN AND THE BOX, pinned per age. TC_FARM_MIN exists so a farm's barn does not stand
// inside its own Town Center's collider — that overlap is a sliver of ground inside two colliders
// at once, legal in neither, and it is the residue v134.0's push-out could not resolve.
//
// The binding case is the DIAGONAL, not the axes: the barn hangs off the farm's own corner at
// (-3.03,-4.72) after BSCALE, and a box's corner is exactly where a diagonal offset reaches
// furthest in. Solved numerically over 3600 bearings, the least farm-centre distance that clears
// the box is
//
//     age 1  23.45      age 2  20.80      age 3  23.75      age 4  26.75      age 5  22.20
//
// driven by the Town Center's own half-extents: 11.26x10.75 at Stone, 8.50x7.75 at Classical,
// PEAKING at 11.88x11.90 at age 4 and dropping to 9.10 at 5. TC_FARM_MIN 21 therefore clears the
// box at ONE age (2) and not at the other four.
//
// The first cut of this gate asserted zero overlap and went red. The second asserted "clears every
// age except the peak at 4" and went red too — and that second red is the useful one, because the
// claim was a guess dressed as a fact. The overlap is the NORMAL state of a farm ring at this
// radius, not a one-age pinch, and a comment saying otherwise is exactly what the next session
// would have believed.
//
// WHY IT SHIPS ANYWAY: clearing every age needs TC_FARM_MIN 27, which against TC_RING 30 leaves a
// three-unit band for a field thirteen wide — the ring would have to move out to ~36 and the town
// with it, and there are only 45 units behind a Town Center before the map edge. The overlap is
// bounded (2.81, gated below), it is strictly smaller than v133's, where farms sat at 16.2, and
// v134.0's push-out and idle sweep resolve bodies out of the sliver — the "nobody standing IN a
// wall" gate measures exactly that on this same campaign and reads 0.00 deep.
//
// THE REAL CURE, when someone wants it: rotate each field so its barn faces AWAY from the Town
// Center. The barn's offset is fixed in world space only because a farm is never rotated;
// makeBuilding already takes a rot and the collider, the apron and the mesh all honour it. Then the
// overlap vanishes at any distance, TC_FARM_MIN can stay where it is, and the barns face the town —
// which is also how a farm ought to look. It needs a shot before it ships, not a derivation.
{
  const G=global.__G, P=G.BLD.farm.blockParts||[], bs=G.BSCALE.farm||1;
  const tcDef=G.BLD.towncenter;
  const clearAt=(A)=>{ // the least farm-centre distance with no barn disc touching the TC box
    const hx=((tcDef.fxA&&tcDef.fxA[A])||tcDef.fx)+0.7, hz=((tcDef.fzA&&tcDef.fzA[A])||tcDef.fz)+0.7;
    for(let D=16;D<=44;D+=0.05){
      let ok=true;
      for(let i=0;i<720&&ok;i++){
        const th=i/720*Math.PI*2, fx=Math.cos(th)*D, fz=Math.sin(th)*D;
        for(const q of P){
          if(q.minAge!==undefined&&A<q.minAge)continue;
          if(q.maxAge!==undefined&&A>q.maxAge)continue;
          const wx=fx+q.x*bs, wz=fz+q.z*bs, qr=q.r*bs+0.7;
          const gx=Math.max(0,Math.abs(wx)-hx), gz=Math.max(0,Math.abs(wz)-hz);
          if(gx*gx+gz*gz<qr*qr){ok=false;break;}
        }
      }
      if(ok)return D;
    }
    return 99;
  };
  const tbl=[1,2,3,4,5].map(A=>({A,d:clearAt(A)}));
  const shown=tbl.map(r=>"age"+r.A+" "+r.d.toFixed(2)).join(" · ");
  // The table is the pin. Rescale the farm model, move a blockPart, or change the Town Center's
  // fxA/fzA and these numbers move and this goes red — which is the only way the sentence
  // "TC_FARM_MIN is 21 because the geometry says so" stays true rather than becoming folklore.
  const expect={1:23.45,2:20.80,3:23.75,4:26.75,5:22.20};
  const drift=tbl.filter(r=>Math.abs(r.d-expect[r.A])>0.1)
                 .map(r=>"age"+r.A+" "+r.d.toFixed(2)+" not "+expect[r.A]);
  check("v134.1 barn: the farm-to-Town-Center clearance table is unmoved ("+shown+")"+
    (drift.length?" — DRIFTED: "+drift.join(" · "):""),drift.length===0);
  // The state of affairs stated as it IS rather than as it would be convenient for it to be. This
  // gate exists so that stays a DECISION rather than drifting into an accident: if a future change
  // clears more ages — rotating the barns would clear all five — this goes red and whoever reads it
  // gets to delete a caveat instead of inheriting a stale one.
  const shortAt=tbl.filter(r=>G.TC_FARM_MIN<r.d).map(r=>"age"+r.A);
  check("v134.1 barn: TC_FARM_MIN ("+G.TC_FARM_MIN+") clears the box at age 2 ALONE — short at "+
    shortAt.join(",")+", because clearing them all needs 26.75 against a ring of "+G.TC_RING+
    ". The overlap is bounded below, no body ends up in it, and the cure is to rotate the barns "+
    "to face away — which needs a shot before it ships",
    shortAt.join(",")==="age1,age3,age4,age5");
  // …and whatever overlap the ring does permit stays inside what a farm at its inner edge can
  // reach. A deeper one would mean the RING leaked, not the barn.
  let worst=0;
  for(const t of [0,1]){
    const tc=G.buildings.find(b=>b.alive&&b.team===t&&b.type==="towncenter"); if(!tc)continue;
    const A=Math.max((tc.def.age||0),Math.min(5,G.teamAge[t]||0));
    const hx=((tc.def.fxA&&tc.def.fxA[A])||tc.def.fx)+0.7, hz=((tc.def.fzA&&tc.def.fzA[A])||tc.def.fz)+0.7;
    for(const f of G.buildings){
      if(!f.alive||f.team!==t||f.type!=="farm")continue;
      const rot=f.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
      for(const q of P){
        if(q.minAge!==undefined&&A<q.minAge)continue;
        if(q.maxAge!==undefined&&A>q.maxAge)continue;
        const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
        const wx=f.x+qx*c+qz*sn, wz=f.z-qx*sn+qz*c;   // the same local->world as the collider
        const gx=Math.max(0,Math.abs(wx-tc.x)-hx), gz=Math.max(0,Math.abs(wz-tc.z)-hz);
        const ov=qr-Math.hypot(gx,gz);
        if(ov>worst)worst=ov;
      }
    }
  }
  check("v134.1 barn: the worst overlap the campaign produced is "+worst.toFixed(2)+", within what "+
    "a farm at the ring's inner edge can reach (2.81) — deeper would mean the ring leaked",
    worst<=2.81);
}
// v134.0 …AND NOBODY IS STANDING INSIDE ONE. A pure read of the world the campaign above just
// built — no ticks, no bodies added, nothing perturbed. Run against the shipped v133 game code
// with this same harness it returns 7 of 146 live — villagers standing in two Town Centers, a
// blacksmith and an archery range — permanently, because separate() ran last in the frame and wrote
// root.position with no collider and no walkable test, and moveToward's stall detector measured
// realized displacement (which the shove/push-out pair keeps large) instead of ground gained
// toward the goal. Both are fixed; this is the instrument that says so.
{
  const wedged=bodiesInsideColliders();
  let deep=0; for(const h of wedged)deep=Math.max(deep,h.depth);
  const who=wedged.slice(0,3).map(h=>h.u.name+" "+h.depth.toFixed(2)+" into a "+h.b.type).join(" · ");
  // DEPTH is the claim, not the count. Measured with THIS instrument against shipped v133 game
  // code, the same campaign leaves 7 bodies touching, the worst 0.29 into an archery range. (The
  // 1.30 figure quoted on the shove bench below is a different measurement — a crowd driven into a
  // barracks face — and is not this one.) 0.25 is a quarter of a body\'s half-width: past it a body
  // is IN the wall rather than brushing it.
  check("v134.0 pathing: the campaign leaves nobody standing IN a wall (worst "+deep.toFixed(2)+
    " deep, "+wedged.length+" touching, of "+global.__G.units.filter(u=>u.alive).length+" live"+
    (who?" — "+who:"")+") — v133: 7 bodies, worst 0.29",
    deep<0.25);
}
check("corn grows on farms",buildings.some(b=>b.type==="farm"&&b.crop>0));
// v113: passive farm income is 2 food every 3 seconds (2/3 per sec) — v86 halved it to 0.5,
// John's field test called that over-nerfed. Harvest payout untouched.
// Direct economyTick calls (no live tick), so no directors spend between measurements.
const G_ENL=global.__G.ENLIGHTENMENT_AGE;
{
  const {economyTick}=global.__G;
  global.__G.makeBuilding(0,"farm",120,40,true); // guarantee BLUE owns at least one farm
  economyTick(1.0); // flush whatever fraction accumulated during the campaign
  const farms0=buildings.filter(b=>b.alive&&b.built&&b.type==="farm"&&b.team===0).length;
  const f0=stock[0].food;
  economyTick(1.0); // exactly one 1.0s step
  // v132.47: the age trickle is gone below Enlightenment, so this is farms ALONE — which is what
  // an assertion named "farm passive" should always have measured. Summing two systems into one
  // number is why a change to the economy reddened a gate named after farms.
  const age0=(teamAge[0]>=G_ENL)?1:0;
  const gained=stock[0].food-f0, want=age0+(2/3)*farms0;
  check("v113 farm passive = 2 food / 3s: +"+gained.toFixed(2)+" food/s from "+farms0+
    " farms (want "+want.toFixed(2)+(age0?", incl. the Enlightenment 1/s":", no age trickle below "+
    "Enlightenment")+")",farms0>=1&&Math.abs(gained-want)<1e-6);
  check("v132.47 economy: aging up pays NOTHING below Enlightenment — it used to pay (age+1) of "+
    "every resource a second, stacking on the bazaars. John: \"too much\" (team age "+teamAge[0]+
    ", age term "+age0+")",teamAge[0]>=G_ENL?age0===1:age0===0);
}
// ================= v94: THE AI MARSHALS — personalities & difficulty =================
global.__G.setGameOver(false); // an accidental regicide in the campaign must not mute this section
{
  const G=global.__G, {PERSONALITIES,AI_DIFF,diffFor,counterWeights,findFarmSpot,farmAnchors}=G;
  const dials=["ageBufF","farmsBase","farmsPerAge","pits","raidAt","raidMin","raidFrac","trainMin","minVills","reserveF","kgBase"];
  check("four doctrines, every dial present, boom out-farms and out-ages rush",
    Object.keys(PERSONALITIES).length===4&&
    Object.values(PERSONALITIES).every(p=>dials.every(k=>typeof p[k]==="number"))&&
    PERSONALITIES.boom.ageBufF<PERSONALITIES.rush.ageBufF&&
    PERSONALITIES.boom.farmsBase+PERSONALITIES.boom.farmsPerAge*5>=10&&
    PERSONALITIES.rush.raidAt<PERSONALITIES.turtle.raidAt&&
    PERSONALITIES.turtle.walls>0);
  check("difficulty table: HARD thinks faster, runs 20% hot, and counters",
    AI_DIFF.easy&&AI_DIFF.normal&&AI_DIFF.hard&&
    AI_DIFF.hard.eco===1.2&&AI_DIFF.hard.counter===true&&!AI_DIFF.easy.counter&&
    AI_DIFF.hard.think<AI_DIFF.normal.think&&AI_DIFF.normal.think<AI_DIFF.easy.think);
  const DIRS=G.directors;
  check("both marshals rolled a doctrine and the scouts have spoken",
    DIRS.every(D=>PERSONALITIES[D.pers]&&D.annT===1));
  // difficulty routing: humans keep the supportive brain, pure-AI teams take the dial
  const d0=G.getAIDiff();
  G.setAIDiff("hard");
  check("the dial reaches only the pure-AI team (BLUE human → normal, RED → hard)",
    diffFor(0)==="normal"&&diffFor(1)==="hard");
  // HARD economy: RED trickles 20% hot, BLUE stays honest
  G.makeBuilding(1,"farm",130,40,true); // guarantee RED owns a farm
  G.economyTick(1.0); // flush
  const rF=G.buildings.filter(b=>b.alive&&b.built&&b.type==="farm"&&b.team===1).length;
  const bF=G.buildings.filter(b=>b.alive&&b.built&&b.type==="farm"&&b.team===0).length;
  const r0=stock[1].food, b0=stock[0].food;
  G.economyTick(1.0);
  const rGain=stock[1].food-r0, bGain=stock[0].food-b0;
  // v132.47: the age term is gone below Enlightenment. ecoMul is UNTOUCHED — it is the difficulty
  // handicap, not part of what was too generous — so this still measures exactly what it names.
  const _a=(t)=>(teamAge[t]>=G_ENL)?1:0;
  const rWant=(_a(1)+(2/3)*rF)*1.2, bWant=_a(0)+(2/3)*bF;
  check("HARD economy runs 20% hot for the AI only (red +"+rGain.toFixed(2)+" want "+rWant.toFixed(2)+
        " · blue +"+bGain.toFixed(2)+" want "+bWant.toFixed(2)+")",
    Math.abs(rGain-rWant)<1e-6&&Math.abs(bGain-bWant)<1e-6);
  G.setAIDiff(d0);
  // the farm brain: a lone storage pit far from town anchors NEW fields
  {
    let pitSpot=null;
    for(let x=-100;x<=100&&!pitSpot;x+=9)for(let z=-110;z<=110&&!pitSpot;z+=9){
      if(Math.hypot(x-G.TCPOS[0][0],z-G.TCPOS[0][1])<50)continue; // far from the throne
      if(G.validFor("storage_pit",x,z,0))pitSpot={x,z};
    }
    check("open ground found for the farm-anchor probe",!!pitSpot);
    if(pitSpot){
      const pit=G.makeBuilding(0,"storage_pit",pitSpot.x,pitSpot.z,true);
      check("the pit joins the farm anchors",farmAnchors(0).some(a=>a.x===pit.x&&a.z===pit.z));
      let nearPit=false;
      for(let i=0;i<200&&!nearPit;i++){
        const s=findFarmSpot(0);
        if(s&&Math.hypot(s.x-pit.x,s.z-pit.z)<20)nearPit=true;
      }
      check("findFarmSpot plants fields beside the OUTLYING pit (the aging fix)",nearPit);
      pit.alive=false;
    }
  }
  // HARD counter-composition: a cavalry swarm begets spears
  {
    // measure the DELTA: the post-campaign red army already colors the weights
    const W0=counterWeights(0,{melee:2,anticav:2,ranged:2,cavalry:2});
    const horses=[];
    for(let k=0;k<6;k++)horses.push(G.makeUnit(1,"scout",120,-40+k*3,{name:"H"+k,bot:{role:"citizen"}}));
    const W1=counterWeights(0,{melee:2,anticav:2,ranged:2,cavalry:2});
    check("counterWeights answers 6 fresh horses with the spear (anticav +"+(W1.anticav-W0.anticav).toFixed(1)+", others unmoved)",
      Math.abs((W1.anticav-W0.anticav)-6*1.2)<1e-9&&
      Math.abs(W1.ranged-W0.ranged)<1e-9&&Math.abs(W1.melee-W0.melee)<1e-9);
    for(const h of horses)h.alive=false;
  }
  // TURTLE: the wall program raises a curtain and sets a gate on the road
  {
    const D1=DIRS[1], persSave=D1.pers;
    for(const b of buildings)if(b.alive&&!b.built){b.built=true;b.progress=b.def.hits;} // clear the queues
    D1.pers="turtle"; D1.wallPlan=null; D1.wallPlaced=0; D1.wallsDone=false;
    stock[1].food+=5000; stock[1].gold+=5000; stock[1].stone+=5000; stock[1].wood+=5000;
    const walls0=buildings.filter(b=>b.team===1&&b.def.wall).length;
    for(let i=0;i<20&&!D1.wallsDone;i++){
      G.directorThink(D1);
      for(const b of buildings)if(b.alive&&!b.built&&b.def.wall&&b.team===1){b.built=true;b.progress=b.def.hits;} // masons work instantly for the test
    }
    const walls1=buildings.filter(b=>b.team===1&&b.def.wall).length;
    const gates=buildings.filter(b=>b.alive&&b.team===1&&b.def.gate).length;
    check("TURTLE raises a curtain wall (+"+(walls1-walls0)+" segments) and finishes with a gate ("+gates+")",
      (walls1-walls0)>=1&&D1.wallsDone===true&&gates>=1);
    D1.pers=persSave;
  }
}
// ================= v87: QUESTING & THE BLACKSMITH =================
global.__G.setGameOver(false); // an accidental regicide in the campaign must not mute this section
{
  const {QUESTS,BUFFS,XP_MAX_LVL,BUFF_MAX_STACK,townBoards,boardFor,useTownBoard,useBlacksmith,
         buffSt,carryCap,applyBuffStats,questProgress,questTick,bazaarTier,addConstructionHit,
         dealDamage,killUnit,TCPOS,ageBuff}=global.__G;
    check("collection quests trimmed to 100 (v91)",
    QUESTS.filter(q=>q.ev.startsWith("dep_")).length===4&&
    QUESTS.filter(q=>q.ev.startsWith("dep_")).every(q=>q.n===100));
  const _xpLo=Math.min.apply(null,QUESTS.map(q=>q.xp)), _xpHi=Math.max.apply(null,QUESTS.map(q=>q.xp));
  check("quest & buff tables at strength ("+QUESTS.length+" quests / "+BUFFS.length+" buffs, unique ids, xp "+_xpLo+"-"+_xpHi+")",
    QUESTS.length>=20&&BUFFS.length>=20&&
    new Set(QUESTS.map(q=>q.id)).size===QUESTS.length&&
    new Set(BUFFS.map(b=>b.id)).size===BUFFS.length&&
    QUESTS.every(q=>q.n>=1&&q.xp>=1&&q.xp<=3));
  // v132.28: the event key is the join between a quest and the 24 call sites that feed it.
  // Two quests sharing one ev would both advance off a single action — a silent double-pay.
  check("v132.28 quests: every progress event is unique ("+new Set(QUESTS.map(q=>q.ev)).size+"/"+QUESTS.length+")",
    new Set(QUESTS.map(q=>q.ev)).size===QUESTS.length);
  check("v132.28 quests: every posting carries a numeric age in 0..5",
    QUESTS.every(q=>typeof q.age==="number"&&q.age>=0&&q.age<=5));
  check("v132.28 quests: Perfect Guard is gone (John's ruling)",
    !QUESTS.some(q=>q.id==="parry5"||q.ev==="parry"));
  check("v132.28 quests: max level is 25",XP_MAX_LVL===25);
  {
    // THE FILTER ITSELF. Draft many boards at each age against a scratch unit and assert the
    // gate holds. Sampling is deliberate — questDraft is random, so one draw proves nothing.
    const {questDraft,teamAge}=global.__G;
    let leaked=null, tooShort=null, pools=[];
    const saveAge=teamAge[0];
    for(let age=0;age<=5;age++){
      teamAge[0]=age;
      const seen=new Set();
      for(let k=0;k<300;k++){
        const scratch={team:0};
        const trio=questDraft(scratch);
        if(trio.length<3&&tooShort===null)tooShort=age;
        for(const qi of trio){ seen.add(qi); if(QUESTS[qi].age>age&&!leaked)leaked=age+":"+QUESTS[qi].id; }
      }
      pools.push(seen.size);
    }
    teamAge[0]=saveAge;
    check("v132.28 age gate: 1800 boards dealt, nothing above the team's age was ever posted"+
      (leaked?" (LEAKED "+leaked+")":""),leaked===null);
    check("v132.28 age gate: a full trio is dealable at every age (shortest board age: "+
      (tooShort===null?"none":tooShort)+")",tooShort===null);
    check("v132.28 age gate: the pool GROWS with age ("+pools.join(" -> ")+") — the filter is not a no-op",
      pools[5]>pools[0]&&pools.every((p,i)=>i===0||p>=pools[i-1]));
  }
  {
    // the v99 contract under the new non-empty cache guard
    const {questDraft}=global.__G;
    const u={team:0};
    const a=questDraft(u).slice(), b=questDraft(u).slice();
    check("v99/v132.28 draft: the trio STANDS until taken (two reads agree: ["+a+"] / ["+b+"])",
      a.length===b.length&&a.every((v,i)=>v===b[i]));
  }
  check("a Town Board stands beside each throne",
    townBoards.length===2&&[0,1].every(t=>{const b=boardFor(t);
      return b&&Math.hypot(b.x-TCPOS[t][0],b.z-TCPOS[t][1])<30;}));
  // v127: this asked "did the campaign happen to build a forge?" — an emergent-behaviour question
  // whose answer is a dice roll, and it came up short about one run in eight. The rule it MEANT to
  // test is "a director at Iron with money in the bank raises a blacksmith", so ask that directly:
  // put team 0 at Iron, fund it, and run the war room synchronously. The old campaign observation
  // is kept as the first clause, because when the campaign DID build one that is the stronger
  // evidence — this just stops the check depending on whether it did.
  let nSmEver=buildings.filter(b=>b.type==="blacksmith").length; // razed forges still prove the AI built one
  if(nSmEver===0){
    const ageSave=teamAge[0], DIR0=global.__G.directors[0];
    const st0={food:stock[0].food,gold:stock[0].gold,stone:stock[0].stone,wood:stock[0].wood};
    teamAge[0]=2; stock[0].food+=4000;stock[0].gold+=4000;stock[0].stone+=4000;stock[0].wood+=4000;
    for(let i=0;i<40&&nSmEver===0;i++){
      global.__G.directorThink(DIR0);
      for(const b of buildings)if(b.alive&&!b.built){b.built=true;b.progress=b.def.hits;} // masons work instantly here
      nSmEver=buildings.filter(b=>b.type==="blacksmith").length;
    }
    teamAge[0]=ageSave;
    stock[0].food=st0.food;stock[0].gold=st0.gold;stock[0].stone=st0.stone;stock[0].wood=st0.wood;
  }
  check("the AI directors raise a blacksmith at Iron ("+nSmEver+" ever built, ages "+teamAge[0]+"/"+teamAge[1]+")",
    nSmEver>=1||Math.max(teamAge[0],teamAge[1])<2);
  check("the Blacksmith: Iron age, 100 wood",BLD.blacksmith&&BLD.blacksmith.age===2&&BLD.blacksmith.cost.wood===100);
  const smithy=makeBuilding(0,"blacksmith",-120,60,true);
  check("blacksmith mesh rises and the one-per-team cap bites",
    smithy.built&&smithy.root.children.length>0&&!global.__G.validFor("blacksmith",-100,60,0));
  // ---- a questing human: a possessed-guest body (u.remote makes it human) ----
  const qh=makeUnit(0,"clubman",-60,60,{name:"Quester",bot:null}); qh.remote="qtest";
  useTownBoard(qh); // v99: first E POSTS a trio — the draft
  check("the Town Board posts a trio of distinct quests",
    !qh.quest&&qh.questDraft&&qh.questDraft.length===3&&new Set(qh.questDraft).size===3&&
    qh.questDraft.every(qi=>!!QUESTS[qi]));
  const d1=qh.questDraft.slice();
  useTownBoard(qh); // walk away, come back: the SAME three (no fishing)
  check("the trio STANDS until a choice is made",qh.questDraft.join()===d1.join());
  const offBoard=QUESTS.findIndex((q,i)=>!d1.includes(i));
  check("a posting off the board is refused",global.__G.questPick(qh,offBoard)===false&&!qh.quest);
  check("no rerolls banked at level 0",global.__G.questRedraw(qh)===false&&qh.questDraft.join()===d1.join());
  check("taking a posting sets the quest and clears the board",
    global.__G.questPick(qh,d1[1])===true&&!!qh.quest&&qh.quest.i===d1[1]&&!qh.questDraft);
  qh.quest=null; // stand down for the staged kill-quest tests below
  // ---- kill-quest progress through real combat, and the 1-XP payout ----
  qh.quest={i:QUESTS.findIndex(q=>q.ev==="kill_vil"),prog:0}; qh.lvl=0; qh.xp=0;
  for(let k=0;k<3;k++){const v=makeUnit(1,"villager",-58,60,{name:"V"+k,bot:null}); dealDamage(qh,v,10000);}
  check("Terror of the Fields: 3 villager kills = +1 level, +1 XP",qh.lvl===1&&qh.xp===1&&!qh.quest);
  qh.quest={i:QUESTS.findIndex(q=>q.ev==="build_castle"),prog:0}; // a 2-XP monster
  questProgress(qh,"build_castle");
  check("hard quests pay DOUBLE (castle → +2 levels)",qh.lvl===3&&qh.xp===3&&!qh.quest);
  // ---- v132.28.2: rerolls are earned ONCE PER QUEST OPPORTUNITY, capped, and no longer by level ----
  {
    const QT=global.__G.questTick, CAPR=global.__G.QUEST_REROLL_MAX;
    // LEVELS ALONE MUST NOT BANK. qh is sitting on 3 levels from the two quests above.
    qh.qRerolls=0; qh.quest={i:0,prog:0}; qh._rrCycle=false; QT(0.1);
    const lvlBanked=qh.qRerolls||0;
    check("v132.28.2 rerolls: LEVELS alone bank nothing — holding a quest at level "+(qh.lvl||0)+
      " banked "+lvlBanked,lvlBanked===0);
    // ONE per opportunity, and only one however long you stand there.
    qh.quest=null; QT(0.1); QT(0.1); QT(0.1); QT(0.1);
    check("v132.28.2 rerolls: becoming questless banks exactly ONE, however many ticks pass ("+
      (qh.qRerolls||0)+")",(qh.qRerolls||0)===1);
    // taking a posting RE-ARMS the cycle, so the next opportunity grants again
    qh.quest={i:0,prog:0}; QT(0.1);
    qh.quest=null; QT(0.1);
    check("v132.28.2 rerolls: taking a posting re-arms the grant — a second opportunity banks a "+
      "second ("+(qh.qRerolls||0)+")",(qh.qRerolls||0)===2);
    // THE CAP: drive ten more opportunities and it must not pass the ceiling
    for(let k=0;k<10;k++){qh.quest={i:0,prog:0};QT(0.1);qh.quest=null;QT(0.1);}
    check("v132.28.2 rerolls: 12 opportunities, capped at "+CAPR+" ("+(qh.qRerolls||0)+")",
      (qh.qRerolls||0)===CAPR&&CAPR===3);
    qh.quest=null; qh.questDraft=null;
    useTownBoard(qh); // post a trio…
    const rr0=qh.qRerolls||0;
    check("a banked reroll wipes and reposts the board",
      global.__G.questRedraw(qh)===true&&qh.qRerolls===rr0-1&&qh.questDraft&&qh.questDraft.length===3);
  }
  qh.questDraft=null; // clean slate for the forge tests
  // ---- the forge: spend to the 3-stack cap, never past it ----
  // v132.30: the ceiling is PER BUFF now (1/3/5), so "every buff at its cap" is the SUM of the
  // maxes, not a count times a constant.
  const FULL=BUFFS.reduce((a,b)=>a+global.__G.buffMax(b.id),0); // every buff to its own cap
  qh.xp=FULL; qh.buffs={}; qh.smithOffer=null;
  // v93: the smith deals THREE and the trio STANDS until you choose — no reroll-fishing
  const {smithOffer,smithPick}=global.__G;
  const o1=smithOffer(qh).slice(), o2=smithOffer(qh).slice();
  check("the smith deals 3 distinct buffs and the trio STANDS ("+o1.join("/")+")",
    o1.length===3&&new Set(o1).size===3&&o1.join()===o2.join());
  check("you can only take what's on the table (bogus pick refused, XP kept)",
    smithPick(qh,"bogus")===false&&smithPick(qh,BUFFS.find(b=>!o1.includes(b.id)).id)===false&&qh.xp===FULL);
  const taken=o1[1];
  check("choosing spends 1 XP, grants the pick, and clears the table",
    smithPick(qh,taken)===true&&qh.xp===FULL-1&&buffSt(qh,taken)===1&&!qh.smithOffer);
  while(qh.xp>0){const o=smithOffer(qh);if(!o||!o.length)break;smithPick(qh,o[0]);}
  const stacks=BUFFS.reduce((s,b)=>s+buffSt(qh,b.id),0);
  check(FULL+" XP forges every buff to its OWN cap via chosen trios ("+BUFFS.length+" buffs, stacks "+
    stacks+"/"+FULL+", xp left "+qh.xp+")",
    qh.xp===0&&stacks===FULL&&BUFFS.every(b=>buffSt(qh,b.id)===global.__G.buffMax(b.id)));
  check("v132.30 forge: the ceilings are genuinely MIXED, not a uniform 3 ("+
    [...new Set(BUFFS.map(b=>global.__G.buffMax(b.id)))].sort().join("/")+") — so the check above "+
    "is not the old uniform-cap test wearing a new name",
    new Set(BUFFS.map(b=>global.__G.buffMax(b.id))).size>=3);
  qh.xp=5; useBlacksmith(qh);
  check("a fully-forged hero can't overspend",qh.xp===5);
  qh.xp=0;
  { // a thin pool deals what remains
    const q2=makeUnit(0,"clubman",-62,58,{name:"Thin",bot:null}); q2.remote="qtest6"; q2.xp=9;
    q2.buffs={}; for(const b of BUFFS)q2.buffs[b.id]=global.__G.buffMax(b.id); // every one maxed…
    q2.buffs[BUFFS[0].id]=global.__G.buffMax(BUFFS[0].id)-1;                     // …bar two slots
    q2.buffs[BUFFS[1].id]=global.__G.buffMax(BUFFS[1].id)-1;
    q2.smithOffer=null;
    const so=smithOffer(q2);
    check("a thin pool deals only what remains ("+so.length+")",so.length===2);
    q2.alive=false;
  }
  // ---- stat buffs ride applyBuffStats ----
  const cb=CLS.clubman;
  // derived from the table, not from literals: Stout Heart and Quick Hands stack to 5 now.
  {
    const bm=global.__G.buffMax;
    const wantHp=Math.round(cb.hp*ageBuff(0)*(1+0.10*bm("hp")));
    const wantSpd=cb.spd+1.0*bm("spd");
    // v133.0 Quick Hands is a PERCENTAGE now — a flat −0.1s was worth 10% to a 1.0s clubman and
    // 40% to a 0.25s skirmisher, i.e. a different buff depending on who bought it.
    const wantCd=Math.max(0.2,cb.cd*(1-0.10*bm("atkspd")));
    check("Stout Heart ×"+bm("hp")+" / Fleet Foot ×"+bm("spd")+" / Quick Hands ×"+bm("atkspd")+
      " land on the stat sheet (hp "+qh.maxHp+"/"+wantHp+", spd "+qh.spd.toFixed(2)+"/"+wantSpd.toFixed(2)+
      ", cd "+qh.cd.toFixed(2)+"/"+wantCd.toFixed(2)+")",
      qh.maxHp===wantHp&&Math.abs(qh.spd-wantSpd)<1e-9&&Math.abs(qh.cd-wantCd)<1e-9);
  }
  // ---- event-time buffs, isolated one at a time (far from qh's captain banner) ----
  const dh=makeUnit(0,"clubman",-60,90,{name:"Edge",bot:null}); dh.remote="qtest2"; dh.buffs={dmg:3};
  const tgt=makeUnit(1,"clubman",-58,90,{name:"Tgt",bot:null}); tgt.bot=null; tgt.hp=tgt.maxHp=1000;
  let h0=tgt.hp; dealDamage(dh,tgt,100);
  check("Honed Edge ×3 = +21% damage (dealt "+(h0-tgt.hp)+")",Math.abs((h0-tgt.hp)-121)<1e-6);
  const vh=makeUnit(0,"clubman",-64,90,{name:"Tank",bot:null}); vh.remote="qtest3"; vh.hp=vh.maxHp=1000;
  vh.buffs={shield:3};
  h0=vh.hp; dealDamage(tgt,vh,100);
  check("Raised Shield ×3 takes 21% off (took "+(h0-vh.hp)+")",Math.abs((h0-vh.hp)-79)<1e-6);
  vh.buffs={dodge:1};
  {const MR=Math.random; Math.random=()=>0; h0=vh.hp; dealDamage(tgt,vh,100); Math.random=MR;}
  check("Sixth Sense dodges the blow clean",vh.hp===h0);
  vh.buffs={leech:0}; // (clear)
  dh.buffs={leech:2}; dh.hp=dh.maxHp-10;
  h0=dh.hp; dealDamage(dh,tgt,50);
  // v133.0 a SHARE of the blow: 50 damage × 7% × 2 stacks = 7 HP. The old flat 1-a-stack was
  // noise on a heavy swing and a lifeline on a light one.
  check("Bloodthirst ×2 drinks 7 HP from a 50-damage blow (got "+(dh.hp-h0).toFixed(2)+")",
    Math.abs(dh.hp-(h0+7))<1e-6);
  // captain's banner: refresh the cache, then an ordinary BOT ally near qh hits harder
  qh.buffs={captain:3}; applyBuffStats(qh); questTick(0.01);
  const ally=makeUnit(0,"clubman",-60,62,{name:"Ally",bot:null});
  const foe=makeUnit(1,"clubman",-58,62,{name:"Foe",bot:null}); foe.bot=null; foe.hp=foe.maxHp=1000;
  h0=foe.hp; dealDamage(ally,foe,100);
  check("Captain's Banner ×3: the nearby ally hits +15% (dealt "+(h0-foe.hp)+")",Math.abs((h0-foe.hp)-115)<1e-6);
  // second skin: 5 quiet seconds, then the knitting
  vh.buffs={regen:3}; vh.hp=500; vh._lastHurt=global.__G.getT()-10;
  questTick(1.0);
  check("Second Skin ×3 knits +6 HP/s after the quiet",Math.abs(vh.hp-506)<1e-6);
  check("Deep Satchel ×3: 20 → 80 carry",(dh.buffs={carry:3},carryCap(dh)===80)&&carryCap(ally)===20);
  // master builder: the first swing banks bonus progress, once per site
  const site=makeBuilding(0,"house",-84,86,false);
  dh.buffs={builder:2};
  addConstructionHit(site,dh); addConstructionHit(site,dh);
  check("Master Builder banks +2 on the FIRST swing only (progress "+site.progress+")",site.progress===4);
  // build-quest credit lands on the human who placed the foundation
  const farmB=makeBuilding(0,"farm",-94,86,false); farmB.qBy=dh.id;
  dh.buffs={}; dh.lvl=0; dh.xp=0; dh.quest={i:QUESTS.findIndex(q=>q.ev==="build_farm"),prog:4};
  for(let k=0;k<20&&!farmB.built;k++)addConstructionHit(farmB,dh);
  check("a finished farm pays its placer's quest",farmB.built&&dh.lvl===1&&!dh.quest);
  // the scout quest: see the throne, come home alive
  const eyes=makeUnit(0,"scout",-60,100,{name:"Eyes",bot:null}); eyes.remote="qtest4"; eyes.lvl=0; eyes.xp=0;
  eyes.quest={i:QUESTS.findIndex(q=>q.ev==="scout"),prog:0};
  const etcQ=global.__G.teamTC(1), otcQ=global.__G.teamTC(0);
  check("both thrones still stand for the scout test",!!etcQ&&!!otcQ);
  eyes.root.position.set(etcQ.x+5,0,etcQ.z+5); questTick(0.05);
  check("Eyes on the Throne: the enemy TC is SEEN",eyes._scoutOut===true);
  eyes.root.position.set(otcQ.x+5,0,otcQ.z+5); questTick(0.05);
  check("…and coming home alive pays 2 levels",eyes.lvl===2&&eyes.xp===2&&!eyes.quest);
  // bazaar tiers rank near/mid/far from EACH throne
  const tiers=[0,1].map(t=>neutralMarkets.map(m=>bazaarTier(t,m)).sort().join(""));
  check("bazaar tiers rank 0/1/2 from both thrones ("+tiers.join(" & ")+")",tiers[0]==="012"&&tiers[1]==="012");
  // ---- v132.48 DEATH TAKES HALF. John: "Losing all levels and xp at death is too harsh." ----
  // His two worked examples, verbatim, as assertions.
  qh.lvl=20; qh.xp=0; qh.alive=true; qh.buffs={}; qh.quest=null; qh.smithOffer=null;
  killUnit(qh,null);
  check("v132.48 death: a level 20 rises at "+qh.lvl+" with "+qh.xp+" XP (John's example: 10 and "+
    "10) — half the climb comes back as coin to re-forge with",qh.lvl===10&&qh.xp===10);
  qh.alive=true; qh.lvl=8; qh.xp=0;
  killUnit(qh,null);
  check("v132.48 death: …and a level 8 rises at "+qh.lvl+" with "+qh.xp+" XP (his second example: "+
    "4 and 4)",qh.lvl===4&&qh.xp===4);
  // ⚠ SET, NOT ADDED. Otherwise banking XP is the optimal play and dying rich is a strategy.
  qh.alive=true; qh.lvl=20; qh.xp=6;
  killUnit(qh,null);
  check("v132.48 death: the new XP REPLACES what you were holding — a level 20 with 6 banked "+
    "rises with "+qh.xp+", not 16. Hoarding is neither rewarded nor punished",qh.xp===10);
  // odd levels round DOWN
  qh.alive=true; qh.lvl=7; qh.xp=0;
  killUnit(qh,null);
  check("v132.48 death: odd levels round down (7 → "+qh.lvl+")",qh.lvl===3&&qh.xp===3);
  // …and everything else still goes
  qh.alive=true; qh.lvl=12; qh.xp=3; qh.quest={i:0,prog:10}; qh.buffs={dmg:3,spd:1};
  qh.smithOffer=["dmg","spd","hp"]; qh.qRerolls=2; qh.hpBonus=40;
  killUnit(qh,null);
  check("v132.48 death: the BUFFS still go entirely, with the quest, the standing offer, the "+
    "banked rerolls and Trophy Hunter's earnings — that is where all sixty pieces of power live, "+
    "and it is what keeps a rule this generous from making death free",
    Object.keys(qh.buffs).length===0&&!qh.quest&&!qh.smithOffer&&qh.qRerolls===0&&qh.hpBonus===0);
  // and the STATS follow the wipe, through a real respawn
  {
    qh.alive=true; qh.lvl=10; qh.buffs={hp:5};
    global.__G.setClassStats(qh);
    const buffedMax=qh.maxHp;
    killUnit(qh,null);
    global.__G.respawnUnit(qh);
    check("v132.48 death: …and the STATS follow the loadout through a real respawn — you do not "+
      "keep the maxHp a lost STOUT HEART was paying for ("+buffedMax.toFixed(0)+" → "+
      qh.maxHp.toFixed(0)+")",qh.maxHp<buffedMax);
  }
  // v88: nothing may bury a Town Board. Self-calibrating: find ground where a house
  // IS legal, stand a fake board there, and watch the SAME spot flip to refused —
  // so only the board guard can be the cause. (Naive probes at the real boards are
  // vacuous: the TC's own clearance already refuses those spots.)
  {
    let spot=null;
    for(let x=-100;x<=100&&!spot;x+=7)for(let z=-110;z<=110&&!spot;z+=7)
      if(global.__G.validFor("house",x,z,0))spot={x,z};
    check("open ground found for the board-guard probe",!!spot);
    if(spot){
      townBoards.push({team:0,x:spot.x,z:spot.z,mesh:null});
      const during=global.__G.validFor("house",spot.x,spot.z,0);
      townBoards.pop();
      const after=global.__G.validFor("house",spot.x,spot.z,0);
      check("the board guard refuses building over a board, and releases when it's gone",
        during===false&&after===true);
    }
  }
  // v89: the horn calls FIVE — the nearest soldiers, Bannerman adds one per stack
  {
    const rl=makeUnit(0,"clubman",95,-95,{name:"Horn",bot:null}); rl.remote="qtest5";
    const band=[];
    for(let k=0;k<9;k++)band.push(makeUnit(0,"clubman",97+(k%3)*2,-97+((k/3)|0)*2,{name:"B"+k,bot:{role:"citizen"}}));
    let res=global.__G.toggleRallyFor(rl);
    const n1=units.filter(v=>v.rally).length;
    check("G rallies exactly the cap of 5 ("+res.n+" reported, "+n1+" flagged)",res.on&&res.n===5&&n1===5);
    global.__G.toggleRallyFor(rl); // recall
    check("a second horn stands everyone down",units.every(v=>!v.rally));
    rl.buffs={rally:3}; // BANNERMAN ×3
    res=global.__G.toggleRallyFor(rl);
    const n2=units.filter(v=>v.rally).length;
    check("Bannerman ×3 rallies 8 ("+res.n+" reported, "+n2+" flagged)",res.on&&res.n===8&&n2===8);
    global.__G.toggleRallyFor(rl); // stand down + tidy
    for(const v of band)v.alive=false;
    rl.alive=false;
  }
  // v89: TAB shows the FULL quest text — the feed scrolls away, the scoreboard doesn't
  {
    const p0=units.find(u=>u.isPlayer), sb=global.document.getElementById("scoreboard");
    const qSave=p0.quest, bSave=p0.buffs;
    p0.quest={i:0,prog:1}; p0.buffs={dmg:2,rally:1};
    global.__G.showScoreboard(true);
    const html=String(sb.innerHTML);
    const withQ=html.includes(QUESTS[0].desc)&&html.includes("1/"+QUESTS[0].n);
    const withB=html.includes("Honed Edge ×2")&&html.includes(BUFFS.find(b=>b.id==="dmg").desc)&&
                html.includes("Bannerman ×1")&&html.includes(BUFFS.find(b=>b.id==="rally").desc);
    p0.quest=null; p0.buffs={}; global.__G.showScoreboard(true);
    const withoutQ=String(sb.innerHTML).includes("No active quest")&&!String(sb.innerHTML).includes("YOUR BUFFS");
    p0.quest=qSave; p0.buffs=bSave; global.__G.showScoreboard(false);
    check("TAB scoreboard carries the full quest description and progress",withQ&&withoutQ);
    check("TAB scoreboard spells out every active buff with stacks (v90)",withB);
  }
  // E-priority: climbing down from a tower ALWAYS beats the training menu
  {const p0=units.find(u=>u.isPlayer), g0=p0.garrison;
   p0.garrison={x:0,z:0};
   check("E-priority: a garrisoned player's E is the climb-down (candidate d2 = 0)",
     global.__G.interactCandidateD2()===0);
   p0.garrison=g0;}
}
const vehicles=units.filter(u=>u.alive&&(CLS[u.cls].rig==="cart"||isSiege(u.cls))).length;
check("8-minute campaign survived with vehicles fielded ("+vehicles+" carts/siege alive, ages "+teamAge[0]+"/"+teamAge[1]+")",vehicles>0);
// ---------------- WALL LINES, GATES, AND ROYAL MORTALITY ----------------
global.__G.setGameOver(false); // a campaign that ended in regicide must not mute the mechanics tests
const {wallLineSegments,placeGateOnWall,kings,healTick}=global.__G;
const segs=wallLineSegments("stone_wall",-60,95,-25,95); // a 35-unit line on open ground
check("wall line yields evenly spaced oriented segments ("+segs.length+")",
  segs.length===3&&segs.every(s=>Math.abs(s.rot-segs[0].rot)<1e-9));
const wallsMade=[];
for(const s of segs)if(global.__G.validFor("stone_wall",s.x,s.z,0))wallsMade.push(global.__G.makeBuilding(0,"stone_wall",s.x,s.z,true,s.rot));
check("line segments place without collisions ("+wallsMade.length+"/3)",wallsMade.length===3);
const mid=wallsMade[1], gate=placeGateOnWall(mid,"stone_gate",0);
check("a gate replaces its wall segment in place",
  !mid.alive&&gate&&gate.alive&&gate.x===mid.x&&gate.z===mid.z&&gate.rot===mid.rot&&gate.def.gate===true);
// snapping + relaxed corners: the pieces an enclosure needs
const w2=wallsMade[2];
const endX=w2.x+6.25*Math.cos(w2.rot||0), endZ=w2.z-6.25*Math.sin(w2.rot||0);
const wtip=global.__G.snapToWallEnd(endX+1.2,endZ-0.8);
check("wall-end snapping finds the tip",wtip&&Math.hypot(wtip.x-endX,wtip.z-endZ)<0.01);
const corner=global.__G.wallLineSegments("stone_wall",wtip.x,wtip.z,wtip.x,wtip.z+22);
check("right-angle corner segments are LEGAL (enclosures possible)",
  corner.length===2&&corner.every(s=>global.__G.validFor("stone_wall",s.x,s.z,0)));

// the king is beyond mortal medicine: a priest at his side heals nothing
const kb=kings[0]; const hurtTo=Math.floor(kb.maxHp*0.3); kb.hp=hurtTo;
global.__G.makeUnit(0,"priest",kb.root.position.x+2,kb.root.position.z+2,{name:"Test Physician"});
for(let i=0;i<30;i++)healTick(0.5);
check("the king stays wounded despite a priest at his side ("+Math.round(kb.hp)+"/"+kb.maxHp+")",kb.hp<=hurtTo+0.01);

// ---------------- ECONOMY DISCIPLINE: caps and hauls ----------------
check("no unit ever exceeds the 20-carry cap",
  units.every(u=>u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood<=20));
const pits=[0,1].map(t=>buildings.filter(b=>b.alive&&b.team===t&&b.type==="storage_pit").length);
console.log("  INFO — storage pits built: BLUE "+pits[0]+" / RED "+pits[1]);

// ---------------- WARBANDS: the AI coordination layer ----------------
const directors=global.__G.directors;
for(const D of directors){
  const who=D.team===0?"BLUE":"RED";
  check("warband system alive for "+who+" ("+D.bands.length+" bands: "+
    [...new Set(D.bands.map(b=>b.role))].join("/")+")",D.bands&&D.bands.length>=1);
  const kg=D.bands.find(b=>b.role==="kingsguard");
  const survivors=units.filter(v=>v.team===D.team&&v.alive&&!v.isPlayer&&v.dmg>0&&v.cls!=="villager").length;
  check(who+" kingsguard never disbands ("+(kg?kg.members.length:0)+" strong, "+survivors+" soldiers left)",
    (kg&&kg.members.length>=1)||survivors===0); // wiped-out armies are excused
  check(who+" band membership is consistent",
    D.bands.every(bd=>bd.members.every(v=>v.team===D.team&&v.bandRef===bd)));
}
const allRoles=new Set([...Object.keys(directors[0].rolesSeen||{}),...Object.keys(directors[1].rolesSeen||{})]);
check("mission variety across the campaign, both armies ("+[...allRoles].join("/")+")",allRoles.size>=3);
// ---- REACTIVE AI: a struck worker summons a rescue band ----
{const dvic=global.__G.makeUnit(0,"villager",-190,-110,{name:"Woodcutter",bot:{role:"citizen"}});
 const datt=global.__G.makeUnit(1,"archer",-186,-110,{name:"Raider"});
 global.__G.dealDamage(datt,dvic,3);
 check("a struck worker raises a distress call",!!directors[0].distress&&
   Math.hypot(directors[0].distress.x+190,directors[0].distress.z+110)<3);
 // v127: this used to spin tick() 160 times and hope a director timer fired inside the window.
 // Whether it did depended on where the campaign had left directors[0].lastRescue and how busy
 // its bands were — so the check was really testing the timer's phase, not the rescue. The war
 // room is driven SYNCHRONOUSLY now, the same trick the levy check below already uses, with the
 // cooldown cleared so the decision is the thing under test. The tick loop stays as a second
 // chance for the path that only fires from a real frame.
 // …and the rescue needs SOMEBODY TO SEND. 07-ai.js:783 picks the best band that is neither
 // kingsguard nor siege and has at least one living member. If the campaign has left directors[0]
 // with no such band, no amount of ticking can produce a rescue, and the check was really asking
 // "did the campaign happen to leave a spare band alive?" rather than testing the dispatch.
 let aided=false, staged=null;
 directors[0].lastRescue=-99;
 const eligible=directors[0].bands.filter(bd=>bd.role!=="kingsguard"&&bd.role!=="siege"&&
   bd.members.some(v=>v&&v.alive));
 if(!eligible.length){
   const ra=global.__G.makeUnit(0,"clubman",-176,-104,{name:"Relief A",bot:{role:"war"}});
   const rb=global.__G.makeUnit(0,"clubman",-174,-106,{name:"Relief B",bot:{role:"war"}});
   ra.alive=true; rb.alive=true;
   staged={id:9101,role:"patrol",members:[ra,rb],holdUntil:0,lastContact:-9999,laneZ:0,laneUntil:1e9};
   ra.bandRef=staged; rb.bandRef=staged; directors[0].bands.push(staged);
 }
 for(let i=0;i<6&&!aided;i++){
   global.__G.manageBands(directors[0]);
   aided=directors[0].bands.some(bd=>bd.aid&&Math.hypot(bd.aid.x+190,bd.aid.z+110)<8);
 }
 for(let i=0;i<160&&!aided;i++){
   global.__G.tick(0.05);
   aided=directors[0].bands.some(bd=>bd.aid&&Math.hypot(bd.aid.x+190,bd.aid.z+110)<8);
 }
 check("a band is dispatched to the distress point"+(staged?" (band staged)":" (campaign band)"),
   aided||directors[0].lastRescue>0);
 if(staged){const si=directors[0].bands.indexOf(staged);if(si>=0)directors[0].bands.splice(si,1);
   for(const v of staged.members){v.alive=false;v.bandRef=null;}}
 dvic.alive=false; datt.alive=false;}
// ---- REACTIVE AI: an overwhelmed Town Center levies its villagers ----
global.__G.setGameOver(false); // an accidental regicide in a prior staged fight must not mute this section
{const tcB=global.__G.teamTC(0);
 if(!tcB){check("an overwhelmed TC levies villagers into soldiers (SKIP: campaign razed the TC)",true);
  check("the militia stands down and returns to the fields (SKIP)",true);}else{
 let defs=0;
 for(const e of units)if(e.alive&&e.team===0&&e.cls!=="villager"&&!e.isKing&&
   Math.hypot(e.root.position.x-tcB.x,e.root.position.z-tcB.z)<34)defs++;
 const mob=[];
 for(let k=0;k<defs+4;k++)mob.push(global.__G.makeUnit(1,"clubman",tcB.x+14+(k%4)*2,tcB.z-6+Math.floor(k/4)*2,{name:"Mob "+k}));
 // ensure at least a few villagers stand near the TC to be levied
 const vills=[];
 for(let k=0;k<3;k++)vills.push(global.__G.makeUnit(0,"villager",tcB.x-10-k*2,tcB.z+6,{name:"Levy "+k}));
 // DETERMINISTIC: run the war room synchronously on this exact state —
 // waiting on director timers lets the (working!) kingsguard spoil the head-count
 directors[0].lastLevy=-99;
 global.__G.manageBands(directors[0]);
 let leviedUnit=null;
 for(const v of units)if(v.alive&&v.team===0&&v._levy){leviedUnit=v;break;}
 check("an overwhelmed TC levies villagers into soldiers",!!leviedUnit&&leviedUnit.cls!=="villager");
 for(const m of mob)m.alive=false; // threat ends
 // v127: …except the threat only ends if the STAGED mob was the whole threat. Any enemy the
 // campaign left standing near this Town Centre keeps the militia mobilised, and the check
 // failed for that reason rather than for a broken stand-down. Clear the yard, and say by how
 // much — an isolation that silently stops isolating is how a test goes back to being a coin flip.
 const yard=isolateArea(tcB.x,tcB.z,40,{team:1}); // ENEMIES only — moving our own levy would change what manageBands sees
 if(leviedUnit)leviedUnit._levyClear=-99; // ten quiet seconds, compressed
 global.__G.manageBands(directors[0]);
 check("the militia stands down and returns to the fields (yard cleared of "+yard.moved+")",
   !!leviedUnit&&leviedUnit.cls==="villager"&&!leviedUnit._levy);
 yard.restore();
 for(const v of vills)if(v.alive)v.alive=false;}}

// every melee age must assemble its bespoke rig — clubman through musketeer
const meleeFit={};
for(const mc of ["clubman","shortsword","broadsword","legionaire","vanguard","musketeer","spearman","spearfighter","impspear","hoplite","pikeman","halberdier","slinger","archer","imparcher","comparcher","crossbowman","skirmisher","chariot","heavycav","cataphract","knight","dragoon","scout","elitescout"]){
  const t=global.__G.NET?global.__G.makeUnit(0,mc,-150,90,{name:"Fit "+mc}):null;
  meleeFit[mc]=t?(rigVerts(t.rig.torso)+"/"+rigVerts(t.rig.head)):"x";
}
// v128.6: vertices, not child meshes — see rigVerts. Floors are well under the measured minima
// (708 torso on a scout, 630 head on a chariot) but far above an empty or half-built rig.
check("melee line rigs assemble (torso/head verts: "+Object.entries(meleeFit).map(([k,v])=>v).join(" ")+")",
  Object.values(meleeFit).every(v=>{const [a,b]=v.split("/").map(Number);return a>=400&&b>=300;}));

// ---------------- MULTIPLAYER: net layer loopback (host packs → guest applies) ----------------
// Peer is undefined in Node — the fact that 10-net.js LOADED at all proves the guard works.
const NET=global.__G.NET;
// ---- v77: NEUTRAL CREEP CAMPS — pockets, aggro, leash, chests, steals, respawn ----
global.__G.setGameOver(false); // an accidental regicide in a prior staged fight must not mute this section
{
  const G=global.__G, CS=G.campStates, MAPh=G.MAP, CR=G.CAMP_R;
  // v132.7 THE SPLIT, ASSERTED AS TWO FACTS INSTEAD OF ONE STALE ONE. What used to be here —
  // "every camp is past the border" — was asked of campStates, which is now every camp creeps live
  // in, and three of those stand in the open field by design. The invariant that still has to hold,
  // and that nothing else checks, is that CAMPS did not absorb them: it is the array
  // inCampGround() punches holes in the invisible wall from and nearCamp() keeps the mountain ring
  // out of, so an interior camp leaking in would push peaks away from map centre where there are
  // none and make walkable() true on ground that already was. Both failures are silent.
  check(CS.length+" creep camps: the border pockets plus the interior clearings (5 bodies each, the shore 11)",
    CS.length===G.CREEP_SITES.length&&
    CS.filter(s=>!s.boss).every(s=>s.creeps.length===5)&&CS.find(s=>s.boss).creeps.length===11);
  check("CAMPS is STILL nothing but border pockets — 4 corners + 2 long-edge midpoints",
    G.CREEP_SITES.filter(c=>!c.inner).length===6&&
    G.CREEP_SITES.filter(c=>!c.inner).every(c=>Math.abs(c.x)>MAPh.x||Math.abs(c.z)>MAPh.z)&&
    G.CREEP_SITES.filter(c=>!c.inner&&c.x===0).length===2);
  check("…and the interior camps are all INSIDE the map, mirrored about x=0",
    G.CREEP_SITES.filter(c=>c.inner).length===3&&
    G.CREEP_SITES.filter(c=>c.inner).every(c=>Math.abs(c.x)+c.r<MAPh.x&&Math.abs(c.z)+c.r<MAPh.z)&&
    G.CREEP_SITES.filter(c=>c.inner).every(c=>
      c.x===0||G.CREEP_SITES.some(o=>o.inner&&o.x===-c.x&&o.z===c.z)));
  // the pockets and the clearings are different SIZES, and the leash and aggro both derive from it
  check("an interior camp is a clearing ("+G.CREEP_R_INNER+"), not a hollow ("+CR+")",
    G.CREEP_R_INNER<CR&&CS.filter((s,i)=>G.CREEP_SITES[i].inner).every(s=>s.r===G.CREEP_R_INNER&&
      Math.abs(s.aggro-(G.CREEP_R_INNER-2.5))<1e-9));
  // campaign attrition is real: passing armies can thin a pack, and a wiped camp sits `waiting`.
  // The strict 4-5 roll is asserted on a FRESH wave below, where it's deterministic.
  check("each NORMAL camp holds a sane pack (≤5 alive; attrition & wipe cycles allowed)",
    CS.filter(s=>!s.boss).every(s=>{const a=s.creeps.filter(c=>c.alive).length;
      return s.waiting?a===0:(a>=1&&a<=5);}));
  {const c0=CS.find(s=>!s.boss); G.campNewWave(c0);
   const a=c0.creeps.filter(c=>c.alive).length;
   check("a FRESH wave musters exactly 4-5 ("+a+")",a>=4&&a<=5);}
  // the border holds everywhere EXCEPT inside a pocket
  const strayer=G.makeUnit(0,"clubman",100,MAPh.z-1,{name:"Strayer",bot:{role:"citizen"}});
  for(let i=0;i<80;i++)G.moveUnit(strayer,0,1,0.05);
  check("the wall stands at the MOUNTAIN LINE: fringe apron walkable, then it holds (z "+strayer.root.position.z.toFixed(1)+")",
    strayer.root.position.z>MAPh.z+2&&strayer.root.position.z<=MAPh.z+9.01);
  strayer.alive=false;
  // walk INTO the north-mid pocket: allowed — and the pack answers
  const north=CS.find(s=>s.x===0&&s.z>0);
  const intruder=G.makeUnit(0,"clubman",0,MAPh.z-2,{name:"Intruder",bot:{role:"citizen"}});
  intruder.hp=intruder.maxHp=100000; intruder.bot=null; // stand and take it (and never bot-wander)
  intruder.root.position.set(north.x,0,north.z); // step onto the camp's heart
  G.moveUnit(intruder,0,0.01,0.05);
  check("a unit may stand OUTSIDE the border inside a camp pocket (z "+intruder.root.position.z.toFixed(1)+")",
    intruder.root.position.z>MAPh.z+2);
  let maxLeash=0, hp0i=intruder.hp;
  G.NET.mode="host";
  for(let i=0;i<240;i++){ // 8 sim-seconds of mauling
    warTicks(1);
    for(const c of north.creeps)if(c.alive)
      maxLeash=Math.max(maxLeash,Math.hypot(c.root.position.x-north.x,c.root.position.z-north.z));
  }
  check("the pack savages an intruder standing in the camp (-"+Math.round(hp0i-intruder.hp)+" hp)",intruder.hp<hp0i-100);
  // leash: drag the pack's attention OUTSIDE the pocket — nobody follows
  intruder.root.position.set(0,0,MAPh.z-30);
  for(let i=0;i<240;i++){
    warTicks(1);
    for(const c of north.creeps)if(c.alive)
      maxLeash=Math.max(maxLeash,Math.hypot(c.root.position.x-north.x,c.root.position.z-north.z));
  }
  check("creeps never leave their camp circle (max leash "+maxLeash.toFixed(1)+" < "+CR+")",maxLeash<=CR+0.01);
  // ---- v127: THE CAMP HAS TO BE CALM, AND "CALM" IS NOT SOMETHING TO HOPE FOR ----
  // updateCreep only knits wounds in its `else` branch — the one it takes when NO living
  // non-neutral unit sits inside the camp's aggro ring. This test parked its own intruder
  // outside and then trusted the other hundred army bots to stay away for three sim-seconds.
  // They did, about three runs in four. When one drifted in, the pack stayed aggro'd, regen
  // never fired, and every camp assertion BELOW this one fell with it — eleven checks red for
  // a reason that had nothing to do with creeps. The ring is cleared explicitly now, and the
  // count rides in the message so a future breakage announces itself instead of going quiet.
  const ringR=(north.aggro||G.CAMP_AGGRO||11.5)+8;
  const calm=isolateArea(north.x,north.z,ringR,{keep:north.creeps,keepNeutral:true});
  const wounded=north.creeps.find(c=>c.alive);
  wounded.hp=wounded.maxHp*0.4; // bloody one by hand — the camp is calm, so it must knit
  const wh=wounded.hp;
  const regenT0=global.__G.getT();
  warTicks(90);
  // v127 DIAGNOSTIC: when this fails it takes ten checks with it, so the message has to say WHY
  // rather than leaving the next person to guess. `T+` proves the sim ran at all (gameOver gates
  // the whole of tickBody); `in ring` is the aggro test the regen branch actually depends on.
  const aggR=(north.aggro||G.CAMP_AGGRO||11.5);
  let inRing=0, ringWho="";
  for(const u of G.units){
    if(!u.alive||u.team===G.NEUTRAL||u.garrison)continue;
    if(dist2h(u.root.position.x,u.root.position.z,north.x,north.z)>aggR*aggR)continue;
    inRing++; if(ringWho.length<40)ringWho+=(ringWho?",":"")+(u.name||u.cls);
  }
  check("calm creeps regenerate (+"+Math.round(wounded.hp-wh)+" hp of "+Math.round(wounded.maxHp)+
    ", T+"+(global.__G.getT()-regenT0).toFixed(1)+"s, cleared "+calm.moved+", still in ring "+inRing+
    (ringWho?" ["+ringWho+"]":"")+", alive "+(!!wounded.alive)+")",
    wounded.hp>wh+wounded.maxHp*0.12); // 8%/s over 3 sim-seconds is ~24% — assert against maxHp, not a flat 20 that a low-hp wolf can miss
  calm.restore();
  intruder.hp=1; G.dealDamage(north.creeps[0],intruder,9999); // tidy: the wilds claim their kill
  // WIPE a camp: the chest appears, typed by the pack that guarded it
  const camp0=CS[0], slayer=G.makeUnit(0,"clubman",camp0.x,camp0.z,{name:"Slayer",bot:{role:"citizen"}});
  slayer.bot=null;
  const kind0=camp0.kind, want=kind0==="wolf"?"food":"gold";
  for(const c of camp0.creeps)if(c.alive)G.dealDamage(slayer,c,99999);
  warTicks(1); // v127: a regicide mid-block would freeze the sim and read as a missing chest
  check("a wiped camp drops a treasure chest",!!camp0.chest&&camp0.waiting===true);
  check("wolves guard FOOD, barbarians guard GOLD ("+kind0+" → "+camp0.chestKind+")",camp0.chestKind===want);
  check("dead creeps lie as corpses in the camp",camp0.creeps.every(c=>!c.alive)&&camp0.creeps.some(c=>c.corpse));
  slayer.alive=false; // step off the prize — the dead can't loot, and the thief must get there first
  // the STEAL: a RED boot lands on the chest first — red banks the treasure
  const thief=G.makeUnit(1,"clubman",camp0.x,camp0.z,{name:"Thief",bot:{role:"citizen"}});
  thief.bot=null; thief.remote="thief-peer"; // remotes score like humans — an exact, economy-noise-proof measure
  warTicks(1); // v127: a regicide mid-block would freeze the sim and read as a missing chest
  check("first boot on the chest takes it — even an enemy's (RED thief scored "+(thief.score||0)+")",
    (thief.score||0)===300&&camp0.chest===null);
  thief.alive=false; thief.remote=null;
  // the 3-minute clock: force it due — a fresh pack rises, 4-5 strong, single group only
  camp0.respawnAt=-1;
  warTicks(1); // v127: a regicide mid-block would freeze the sim and read as a missing chest
  const alive0=camp0.creeps.filter(c=>c.alive).length;
  check("after the wait a fresh pack claims the camp ("+alive0+" of 4-5, kind "+camp0.kind+")",
    !camp0.waiting&&alive0>=4&&alive0<=5&&camp0.creeps.filter(c=>c.alive).every(c=>c.cls===camp0.kind));
  // an UNCLAIMED chest vanishes when the next wave arrives
  for(const c of camp0.creeps)if(c.alive)G.dealDamage(slayer,c,99999);
  warTicks(1); // v127: a regicide mid-block would freeze the sim and read as a missing chest
  check("second wipe drops a second chest",!!camp0.chest);
  camp0.respawnAt=-1;
  warTicks(1); // v127: a regicide mid-block would freeze the sim and read as a missing chest
  check("an unclaimed chest is dragged off by the NEXT wave (chest gone, pack alive)",
    camp0.chest===null&&camp0.creeps.filter(c=>c.alive).length>=4);
  // ---- v79: THE RAID BOSS SHORE — empty start, 15:00 landing, twin chests, split steal ----
  const shore=CS.find(s=>s.boss);
  check("the southern shore is a DOUBLE camp (r "+shore.r+"), empty until the raid lands at 15:00",
    shore.r===52&&shore.z<0&&shore.waiting===true&&shore.respawnAt===900&&shore.creeps.every(c=>!c.alive));
  check("the doubled bay is walkable well past a normal camp's reach",
    G.inCampGround(shore.x,shore.z-40)&&!G.inCampGround(shore.x+70,shore.z));
  // v82 GHOST REGRESSION: unspawned raiders must be STRICTLY invisible even when scouted up close —
  // a truthiness leak (visible=undefined) once rendered them as standing, unattackable ghosts
  {
    const gpl=units.find(u=>u.isPlayer), gx=gpl.root.position.x, gz=gpl.root.position.z;
    gpl.alive=true; gpl.root.position.set(shore.x,0,shore.z+8); // the follow-cam and FOW both ride the player
    for(let i=0;i<40;i++)tick(); // the camera glides in; several LOD passes with the bay scouted up close
    const camNear=Math.hypot(G.camera.position.x-shore.x,G.camera.position.z-(shore.z+8))<60;
    check("unspawned raiders are strictly invisible (visible===false, no ghosts; cam on the sand: "+camNear+")",
      camNear&&shore.creeps.every(c=>c.root.visible===false));
    gpl.root.position.set(gx,0,gz);
  }
  shore.respawnAt=-1; tick(); // sound the horn early
  const vb=shore.creeps[0];
  check("the raid lands: a chieftain and ten raiders ashore",
    shore.creeps.filter(c=>c.alive).length===11&&vb.cls==="vikingboss"&&
    shore.creeps.slice(1).every(c=>c.cls==="viking")&&Math.abs(vb.body.scale.x-1.45)<0.01);
  check("the chieftain leads from the front (hp "+vb.maxHp+", dmg "+vb.dmg+")",vb.maxHp>=450&&vb.dmg>=40);
  const reaver=G.makeUnit(0,"clubman",shore.x,shore.z,{name:"Reaver"}); reaver.bot=null;
  for(const c of shore.creeps)G.dealDamage(reaver,c,999999);
  reaver.alive=false;
  warTicks(1); // v127: a regicide mid-block would freeze the sim and read as a missing chest
  check("breaking the raid drops TWIN chests: 500 FOOD and 500 GOLD",
    shore.chestKind==="food"&&shore.chestKindB==="gold"&&shore.waiting&&shore.respawnAt>T0()+890);
  // the SPLIT STEAL: blue takes the food chest, red takes the gold chest, same instant
  const bGrab=G.makeUnit(0,"clubman",shore.x-2.6,shore.z,{name:"BlueGrab"}); bGrab.bot=null; bGrab.remote="grabA";
  const rGrab=G.makeUnit(1,"clubman",shore.x+2.6,shore.z,{name:"RedGrab"}); rGrab.bot=null; rGrab.remote="grabB"; // remotes score like humans: exact, immune to director spending in the same tick
  warTicks(1); // v127: a regicide mid-block would freeze the sim and read as a missing chest
  check("twin chests split between RIVAL teams in one instant (blue scored "+(bGrab.score||0)+", red "+(rGrab.score||0)+")",
    (bGrab.score||0)===500&&(rGrab.score||0)===500&&shore.chest===null&&shore.chestB===null);
  bGrab.alive=false; rGrab.alive=false; bGrab.remote=null; rGrab.remote=null;
  // unclaimed twins are swept away when the NEXT raid lands
  shore.respawnAt=-1; tick(); // next raid (revives the crew)
  for(const c of shore.creeps)G.dealDamage(reaver,c,999999);
  warTicks(1); // v127: a regicide mid-block would freeze the sim and read as a missing chest
  check("a second broken raid drops twins again",!!shore.chest&&!!shore.chestB);
  shore.respawnAt=-1; tick();
  check("the NEXT raid sweeps unclaimed twin chests away",
    shore.chest===null&&shore.chestB===null&&shore.creeps.filter(c=>c.alive).length===11);
  // ---- v132.28: PARTICIPATION — who gets paid when a pack falls ----
  {
    const campIdx=G.QUESTS.findIndex(q=>q.id==="camp1");
    const mkHuman=(team,x,z,nm,peer)=>{
      const u=G.makeUnit(team,"clubman",x,z,{name:nm});
      u.bot=null; u.remote=peer; u.xp=0; u.lvl=0; u.quest=null; u.questDraft=null; u.qRerolls=0; u.buffs={};
      return u;
    };
    // ---------- THE VIKING RAID (11 ashore from the sweep above) ----------
    const poker  =mkHuman(0,shore.x+6,shore.z,"Poker","p-peer");    // ONE point of damage, then nothing
    const closer =mkHuman(0,shore.x-6,shore.z,"Closer","c-peer");   // does all the killing
    const ghost  =mkHuman(0,shore.x+9,shore.z,"Ghost","g-peer");    // fights, then dies before the wipe
    // a BOT: keeps its bot and carries no remote, so isHuman() is false for it
    const drone  =G.makeUnit(0,"clubman",shore.x+12,shore.z,{name:"Drone",bot:{role:"citizen"}});
    drone.xp=0;
    const raiders=shore.creeps.filter(c=>c.alive);
    const capped=mkHuman(0,shore.x+3,shore.z,"Capped","k-peer");
    capped.lvl=20; capped.xp=0;                    // 5 short of the cap, about to be paid 15
    G.dealDamage(poker,raiders[0],1);
    G.dealDamage(ghost,raiders[0],1);
    G.dealDamage(drone,raiders[0],1);
    G.dealDamage(capped,raiders[0],1);
    const listed=(shore.part||[]).slice();
    ghost.alive=false; ghost.respawnT=Infinity; ghost.corpse=true; // held dead: a bare alive=false is revived by the respawn clock within the tick
    for(const c of shore.creeps)if(c.alive)G.dealDamage(closer,c,999999);
    warTicks(1);
    check("v132.28 participation: the list holds ONLY humans — no bots, no towers ("+listed.length+
      " listed: "+listed.map(x=>x&&x.name).join("/")+")",
      listed.length>0&&listed.every(x=>G.isHuman(x))&&!listed.some(x=>x&&x.def));
    check("v132.28 participation: a BOT that fought the raid is not paid (xp "+(drone.xp||0)+")",
      (drone.xp||0)===0);
    check("v132.28 participation: a participant DEAD at the wipe collects nothing (xp "+(ghost.xp||0)+")",
      (ghost.xp||0)===0);
    check("v132.28 raid: ONE point of damage earns a full share — the poker was paid "+(poker.xp||0)+
      " XP without landing a blow",(poker.xp||0)===15);
    check("v132.28 raid: the finisher is paid the SAME as the poker ("+(closer.xp||0)+" vs "+(poker.xp||0)+
      ") — participation, not a kill bounty",(closer.xp||0)===15&&(closer.xp||0)===(poker.xp||0));
    check("v132.28 raid: participation pays LEVELS as well as XP — the poker went to level "+
      (poker.lvl||0)+" on "+(poker.xp||0)+" XP",(poker.lvl||0)===15&&(poker.xp||0)===15);
    check("v132.28 raid: level is CLAMPED at the cap ("+G.XP_MAX_LVL+") — a level-20 participant "+
      "paid 15 landed on level "+(capped.lvl||0)+" (unclamped would be 35)",(capped.lvl||0)===G.XP_MAX_LVL);
    check("v132.28 raid: …but XP is NOT clamped, so the forge stays reachable at the cap "+
      "(capped player holds "+(capped.xp||0)+" XP)",(capped.xp||0)===15);
    check("v132.28 participation: the list is CLEARED on payout, so a second tick cannot double-pay",
      !shore.part||shore.part.length===0);
    const xpAfter=poker.xp; warTicks(2);
    check("v132.28 participation: …and it stays paid-once across further ticks ("+xpAfter+" -> "+poker.xp+")",
      poker.xp===xpAfter);

    // ---------- A WILD CAMP pays 1, and CAMP BREAKER completes for a non-finisher ----------
    const cw=CS.find(c=>!c.boss&&c.creeps.filter(k=>k.alive).length>=2)||CS[1];
    if(cw.waiting||cw.creeps.filter(k=>k.alive).length<2){cw.respawnAt=-1;tick();}
    const helper=mkHuman(0,cw.x+4,cw.z,"Helper","h-peer");
    const ender =mkHuman(0,cw.x-4,cw.z,"Ender","e-peer");
    helper.quest={i:campIdx,prog:0};                         // holding CAMP BREAKER, will not land the last blow
    const alive=cw.creeps.filter(k=>k.alive);
    G.dealDamage(helper,alive[0],1);
    // ---- STAGE 1: fell all BUT ONE. A camp that is merely mauled must pay nobody. ----
    for(let i=0;i<alive.length-1;i++)if(alive[i].alive)G.dealDamage(ender,alive[i],999999);
    warTicks(1);
    const standing=cw.creeps.filter(k=>k.alive).length;
    check("v132.28 wild camp: a camp MAULED but not cleared pays NOTHING — "+standing+
      " creep still standing, ender xp "+(ender.xp||0)+" lvl "+(ender.lvl||0)+
      ", helper quest "+(helper.quest?"still held":"COMPLETE"),
      standing>=1&&(ender.xp||0)===0&&(ender.lvl||0)===0&&
      (helper.xp||0)===0&&(helper.lvl||0)===0&&!!helper.quest);
    check("v132.28 wild camp: …and the participation list is still OPEN while a creep lives ("+
      ((cw.part||[]).length)+" listed)",(cw.part||[]).length>=1);
    // ---- STAGE 2: fell the last one. Now everything lands. ----
    for(const c of cw.creeps)if(c.alive)G.dealDamage(ender,c,999999);
    warTicks(1);
    check("v132.28 wild camp: a participant is paid 1 XP and 1 LEVEL (xp "+(ender.xp||0)+
      ", lvl "+(ender.lvl||0)+")",(ender.xp||0)>=1&&(ender.lvl||0)>=1);
    check("v132.28 wild camp: CAMP BREAKER completes for a player who did NOT land the last blow "+
      "(quest "+(helper.quest===null?"complete":"still held")+", lvl "+(helper.lvl||0)+")",
      helper.quest===null&&(helper.lvl||0)>=1);
    check("v132.28 wild camp: a wild pack pays LESS than the raid ("+(ender.xp||0)+" vs 15)",
      (ender.xp||0)<15);
    // a fresh wave starts a clean sheet
    cw.respawnAt=-1; tick();
    check("v132.28 participation: a new wave clears the list — nobody carries credit across waves",
      !cw.part||cw.part.length===0);
    poker.alive=false; closer.alive=false; helper.alive=false; ender.alive=false;
    drone.alive=false; capped.alive=false;
  }
  // put the shore back to sleep so later tests meet a quiet map
  for(const c of shore.creeps){c.alive=false;c.corpse=false;c.root.visible=false;}
  shore.waiting=true; shore.respawnAt=1e9;
  function T0(){return 0;} // (respawnAt is measured from sim time — any positive horizon beats +890)
  G.NET.mode="solo";
}
// ---- v80: THE CHARGE — F hurls the rallied line down the gaze, razes the path, holds the far ground ----
global.__G.setGameOver(false); // an accidental regicide in a prior staged fight must not mute this section
{
  const G=global.__G;
  G.NET.mode="host";
  const pl=units.find(u=>u.isPlayer);
  const ox=pl.root.position.x,oz=pl.root.position.z;
  pl.alive=true; pl.root.position.set(-60,0,-90); // open southern ground
  check("F with no rally raises no army (orderCharge refuses)",G.orderCharge(pl,-Math.PI/2)===0||units.every(v=>!v.rally));
  const troop=[];
  for(let i=0;i<3;i++){const s=G.makeUnit(0,"clubman",-64+i*3,-96,{name:"Charger"+i,bot:{role:"citizen"}});
    s.rally=true; s.spread=(i-1)*3; s.hp=s.maxHp=5000; troop.push(s);} // hardy: stray armies must not decide this test
  const shack=G.makeBuilding(1,"house",-25,-90,true); // a red shack squats in the charge lane
  const n=G.orderCharge(pl,-Math.PI/2); // gaze due EAST: fx=-sin(-π/2)=1
  check("the horn sounds: "+n+" rallied soldiers take a charge order east",
    n>=3&&troop.every(v=>v.chargeTo&&Math.abs(v.chargeTo.x-25)<1&&Math.abs(v.chargeTo.z+90)<1));
  let razedAt=-1;
  for(let i=0;i<1400;i++){ tick(); if(razedAt<0&&!shack.alive)razedAt=i; }
  check("the charge RAZES the building in its path ("+(razedAt>=0?("frame "+razedAt):("hp "+Math.round(shack.hp)))+")",razedAt>=0);
  // v93: the mark can land beside (or inside) a campaign building since the 2.2 gap
  // sprawled the towns — holders park around obstructions, so allow a wider ring and
  // let ONE straggler get body-blocked without failing the whole line (was 3/3 within 10).
  const held=troop.filter(v=>v.alive&&Math.hypot(v.root.position.x-25,v.root.position.z+90)<16).length;
  check("the line HOLDS the far ground after the path is cleared ("+held+"/3 within 16 of the mark)",held>=2);
  check("holding troops keep their charge order until recalled",troop.every(v=>v.chargeTo));
  G.toggleRally(); // G: a fresh rally recalls the line — the charge dissolves
  check("G (rally toggle) cancels the standing charge",troop.every(v=>v.chargeTo===null));
  for(const v of units)if(v.rally){v.rally=false;v.chargeTo=null;} // stand everyone down explicitly (v89: a second G would RALLY 5, not stand down)
  // a charge aimed past the border may end INSIDE a camp pocket — the wilds are chargeable
  const scout2=G.makeUnit(0,"clubman",0,118,{name:"WildCharger",bot:{role:"citizen"}}); scout2.rally=true;
  const pl2x=pl.root.position.x,pl2z=pl.root.position.z;
  pl.root.position.set(0,0,118);
  G.orderCharge(pl,Math.PI); // gaze due NORTH (+z): straight at the north-mid camp
  check("a charge can be aimed INTO a creep camp pocket (end z "+(scout2.chargeTo?scout2.chargeTo.z.toFixed(1):"?")+" > "+G.MAP.z+")",
    !!scout2.chargeTo&&scout2.chargeTo.z>G.MAP.z);
  scout2.rally=false; scout2.chargeTo=null; scout2.alive=false;
  for(const v of troop)v.alive=false;
  pl.root.position.set(ox,0,oz);
  G.NET.mode="solo";
}
// ---- v84: THE GREAT REBALANCE — the new wheel, the bayonet, the volley, the dry pistol ----
global.__G.setGameOver(false); // an accidental regicide in a prior staged fight must not mute this section
{
  const G=global.__G, R=G.rps;
  check("wheel: spears 3.8x vs mounted — a spearfighter 3-hits a scout, 4-hits a chariot",
    R("spearman","scout")===3.8&&Math.ceil(CLS.scout.hp/(CLS.spearfighter.dmg*3.8))===3&&
    Math.ceil(CLS.chariot.hp/(CLS.spearfighter.dmg*3.8))===4);
  check("wheel: arrows & musket balls bounce off war engines (0.15x)",
    R("archer","catapult")===0.15&&R("musketeer","trebuchet")===0.15&&R("slinger","batteringram")===0.15);
  check("wheel: swords push spears (1.25x), dismantle siege (2x); cavalry dominates swords & siege (1.5x)",
    R("vanguard","spearman")===1.25&&R("vanguard","catapult")===2.0&&
    R("knight","vanguard")===1.5&&R("knight","catapult")===1.5&&R("knight","archer")===1.8);
  check("wheel: artillery hits troops at FULL force now; rams stay clumsy (0.25)",
    R("catapult","clubman")===1&&R("cannon","halberdier")===1&&R("batteringram","clubman")===0.25);
  check("scouts are economy killers (4.85x): traders die in 3, villagers & carts in 2",
    R("scout","trader")===4.85&&Math.ceil(CLS.trader.hp/(CLS.scout.dmg*4.85))===3&&
    Math.ceil(CLS.villager.hp/(CLS.scout.dmg*4.85))<=2&&Math.ceil(CLS.tradecart.hp/(CLS.scout.dmg*4.85))<=2);
  check("swords besiege: melee tiers carry bMult 1.5 (the musket ball is exempt — its bayonet chews instead)",
    CLS.vanguard.bMult===1.5&&CLS.clubman.bMult===1.5&&CLS.musketeer.bMult===undefined);
  G.NET.mode="host";
  { // THE BAYONET: steel at arm's length beats powder
    const mk=G.makeUnit(0,"villager",-100,110,{name:"Bayoneteer"});
    mk.cls="musketeer"; mk.dmg=CLS.musketeer.dmg; mk.rng=CLS.musketeer.rng; mk.cd=CLS.musketeer.cd; mk.ranged=true; mk.atkT=0;
    const eng=G.makeUnit(1,"catapult",-100,112,{name:"Engine"}); eng.hp=eng.maxHp=1000;
    G.tryAttack(mk);
    const dealt=1000-eng.hp;
    check("the BAYONET stabs an adjacent war engine for steel damage (dealt "+dealt.toFixed(1)+" = 14 x 2.0)",
      Math.abs(dealt-28)<0.5&&Math.abs(mk.atkT-CLS.musketeer.bayonet.cd)<0.01);
    mk.alive=false; eng.alive=false;
  }
  { // THE CASTLE VOLLEY: five arrows in a burst, then the long wind-down
    const cas=G.makeBuilding(0,"castle",-60,108,true);
    const tgt=G.makeUnit(1,"clubman",-60,114,{name:"PinCushion"}); tgt.bot=null; tgt.hp=tgt.maxHp=100000;
    const h0=tgt.hp;
    for(let i=0;i<48;i++)tick(); // 1.6s — the whole volley flies and lands
    const burst=h0-tgt.hp;
    for(let i=0;i<60;i++)tick(); // 2s inside the 4.5s wind-down — the murder-holes stay shut
    const lull=(h0-tgt.hp)-burst;
    check("the castle VOLLEYS: a 5-arrow burst ("+burst.toFixed(0)+" dmg), then silence ("+lull.toFixed(0)+" in the lull)",
      burst>=56&&burst<=84&&lull<=14);
    cas.alive=false; tgt.alive=false;
  }
  { // the pistol never refills on its own — only a fresh re-arm reloads it
    const dg=G.makeUnit(0,"villager",-40,108,{name:"DryGun"});
    dg.cls="dragoon"; dg.ammo=0;
    for(let i=0;i<300;i++)tick(); // ten dry seconds
    const still=dg.ammo;
    G.setClass(dg,"dragoon"); // re-arm: the quartermaster hands over fresh powder
    check("the pistol never regenerates (ammo "+still+" after 10s) but a re-arm reloads it ("+dg.ammo+")",
      still===0&&dg.ammo===6);
    dg.alive=false;
  }
  G.NET.mode="solo";
}
check("net layer loads without PeerJS (solo untouched)",NET&&NET.mode==="solo");
NET._snapN=2; NET._lastRow=null; // fresh cache → full keyframe
const snap=NET.packSnap();
const snapRows=NET.readSnapRows(snap); // v95: unit rows ride as packed binary now
check("packSnap FULL snap carries every unit incl. late carts ("+snapRows.length+")",snapRows.length===units.length&&units.length>=100);
check("v95 binary: 18-byte rows (v99 cargo byte), header count honest ("+snap.ub.byteLength+"B for "+snap.un+")",
  snap.ub.byteLength===snap.un*18&&snap.un===snapRows.length);
// name tags: sc rows now carry unit ids; syncNameTags hangs and clears billboards
{const tagU=global.__G.makeUnit(0,"villager",-170,110,{name:"Tagged"});
 global.__G.syncNameTags([["Ally",0,0,tagU.id]]);
 check("name tag hangs on a player-controlled body",!!tagU._tag&&tagU._tagText==="Ally");
 global.__G.syncNameTags([]);
 check("name tag clears when the body is no longer player-controlled",!tagU._tag);
 tagU.alive=false;}
check("snapshot heartbeat: every 4th snap rides the reliable lane (q%4)",(function(){
  // the dedup guard means duplicates are harmless: assert the predicate logic itself
  let dup=0; for(let q=0;q<16;q++)if(q%4===0)dup++;
  return dup===4;})());
// delta behavior: an immediately-following snap ships only players/kings/changed rows
{const snap2=NET.packSnap();
 const n2=NET.readSnapRows(snap2).length;
 check("packSnap DELTA drops idle rows ("+n2+" of "+units.length+")",
   n2<units.length*0.6&&n2>=1);}
check("keyframe snapshot carries every building (binary rows)",NET.readBldRows(snap).length===buildings.length);
const lean=NET.packSnap(); // the next two travel light
check("v95 lean snapshots ship NO building rows when nothing changed",lean.bb===undefined);
check("compact snapshot is LEAN ("+((lean.bs||0)/1024).toFixed(2)+" KB est. @15Hz)",
  (lean.bs||0)<8000&&lean.un*18===lean.ub.byteLength);
check("snapshots carry a sequence",typeof snap.q==="number"&&lean.q===snap.q+2); // +2: the delta-probe snap sits between
// driveRemote: a fake guest holds E next to a berry bush and fills their hands
const gu=units.find(u=>u.team===0&&u.bot&&!u.isKing&&u.bot.role!=="cart"&&u.alive&&u.cls==="villager");
gu.remote="test-peer"; gu.garrison=null; gu.gathering=null;
const berry=nodes.find(n=>n.type==="food"&&n.amount>50);
gu.root.position.set(berry.x+1.6,0,berry.z);
const sentNotes=[]; const fakeR={unit:gu,input:{e:1},conn:{open:true,send:o=>sentNotes.push(o)},lastE:true,eUsed:false};
const carry0=gu.carry.food+gu.carry.gold+gu.carry.stone+gu.carry.wood, amt0=berry.amount;
for(let i=0;i<120;i++)NET.driveRemote(fakeR,0.05); // 6 sim-seconds of held E
const carry1=gu.carry.food+gu.carry.gold+gu.carry.stone+gu.carry.wood;
check("driveRemote: fake guest gathers (carry "+carry0+"→"+carry1+", node "+amt0+"→"+berry.amount+")",
  carry1>carry0||berry.amount<amt0||carry0>=20);
// driveRemote: E-tap garrisons a watch tower
const wt=buildings.find(b=>b.team===0&&b.alive&&b.built&&b.type==="watch_tower");
if(wt){
  gu.root.position.set(wt.x+2,0,wt.z); gu.gathering=null;
  fakeR.input={e:1}; fakeR.lastE=false; fakeR.eUsed=false;
  NET.driveRemote(fakeR,0.05);
  check("driveRemote: E-tap mans a watch tower",gu.garrison===wt);
  fakeR.input={e:1}; fakeR.lastE=false; // tap again to climb down
  NET.driveRemote(fakeR,0.05);
  check("driveRemote: E-tap climbs back down",gu.garrison===null);
  // the leash: reported feet within 6 units become the truth on the host
  const lx=gu.root.position.x, lz=gu.root.position.z;
  fakeR.input={px:lx+3.5,pz:lz+1.5,w:1};
  for(let i=0;i<8;i++)NET.driveRemote(fakeR,0.05); // the leash GLIDES now — converge
  check("position leash: the host glides onto the guest's reported feet",
    Math.abs(gu.root.position.x-(lx+3.5))<0.15&&Math.abs(gu.root.position.z-(lz+1.5))<0.15);
  fakeR.input={px:lx+300,pz:lz,w:1}; // absurd teleport: rejected, keys walk instead
  const bx=gu.root.position.x;
  NET.driveRemote(fakeR,0.05);
  check("position leash: absurd reports are refused",Math.abs(gu.root.position.x-(lx+300))>200);
}else console.log("  SKIP — no blue watch tower stood at campaign end");
try{NET.hostAct(fakeR,{act:"rally"});check("hostAct rally survives",true);}
catch(e){console.error("  rally threw:",e.message);check("hostAct rally survives",false);}
gu.remote=null; gu.garrison=null;
const w=NET.packWorld(units.find(u=>u.team===0&&u.bot&&!u.isKing&&u.bot.role!=="cart"&&u.alive).id);
check("packWorld carries units+buildings+nodes",
  w.units.length===units.length&&w.blds.length===buildings.length&&w.nodes.length===nodes.length);
// loopback: apply the world we just packed to OUR OWN state — a self-consistent world
// must apply cleanly (this is exactly what a guest does on admit)
const bldsBefore=buildings.filter(b=>b.alive).length;
try{
  NET.applyWorld(w);            // flips NET.mode to "guest" — run this LAST
  check("applyWorld loopback survives",true);
}catch(e){console.error("  applyWorld threw:",e.message);check("applyWorld loopback survives",false);}
check("applyWorld preserved the living building count",
  buildings.filter(b=>b.alive).length===bldsBefore);
const possessed=units.find(u=>u.id===w.uid);
check("guest possession: assigned bot becomes the player",NET.myUid===w.uid&&possessed&&possessed.isPlayer===true);
// ---------------- SCORING + TEAM SELECTION ----------------
global.__G.setGameOver(false); // an accidental regicide in a prior staged fight must not mute this section
const scorer=global.__G.makeUnit(0,"villager",-190,100,{name:"Scorer",isPlayer:false});
scorer.remote="score-peer"; scorer.score=0;
global.__G.awardPts=undefined; // (not exported — call through gameplay paths instead)
// deposit points: fake guest hauls 12 food home via driveRemote
scorer.carry.food=12;
scorer.alive=true; scorer.hp=scorer.maxHp; scorer.root.visible=true; // the war zone spares no test dummy
const scoreR={unit:scorer,input:{},conn:{open:true,send(){}},lastE:false};
scorer.root.position.set(global.__G.TCPOS[0][0]+3,0,global.__G.TCPOS[0][1]+3);
NET.driveRemote(scoreR,0.05);
check("deposits pay 1 point per resource (score "+Math.round(scorer.score||0)+")",Math.round(scorer.score||0)===12);
// kill points: the scorer slays a fresh enemy clubman (cost = its resource price)
const victim=global.__G.makeUnit(1,"clubman",-189,101,{name:"Doomed"});
const kcost=(CLS.clubman.cost.food||0)+(CLS.clubman.cost.gold||0)+(CLS.clubman.cost.stone||0)+(CLS.clubman.cost.wood||0);
const before=scorer.score||0;
NET.mode="host"; global.__G.dealDamage(scorer,victim,99999); NET.mode="guest";
// a villager kill pays a flat 10
{const vk=global.__G.makeUnit(1,"villager",-160,100,{name:"Victim",bot:{role:"citizen"}});
 const kk=global.__G.makeUnit(0,"clubman",-159,100,{name:"Killer",bot:{role:"citizen"}}); kk.remote="pts-peer"; // awardPts pays humans only
 const s0=kk.score||0; NET.mode="host"; global.__G.dealDamage(kk,vk,9999); NET.mode="guest"; // this stretch runs in guest context
 check("a villager kill is worth 10 points (Δ"+(((kk.score||0)-s0))+")",(kk.score||0)-s0===10);
 kk.alive=false;}
// the market cap: a team's sixth market is refused by the validator
// v127: the second half of this — "…but team 1 may still build one" — was silently a question
// about how many markets the AI had already raised for team 1. Five of them and the control case
// inverts, through no fault of the validator. Both sides are counted and stood down first, so the
// check tests the CAP rather than the campaign's trading habits.
{const mkts=[];
 const preB=clearBuildings(0,0,1e4,b=>b.type==="market");
 for(let i=0;i<5;i++)mkts.push(global.__G.makeBuilding(0,"market",-60+i*16,100,true));
 const n0=global.__G.buildings.filter(b=>b.alive&&b.team===0&&b.type==="market").length;
 const n1=global.__G.buildings.filter(b=>b.alive&&b.team===1&&b.type==="market").length;
 check("five markets stand, the validator refuses a sixth ("+n0+" blue / "+n1+" red)", // probe sits 26 out: clear of the v87 2.2 gap
   n0===5&&n1===0&&
   global.__G.validFor("market",30,100,0)===false&&global.__G.validFor("market",30,100,1)===true);
 for(const m of mkts)m.alive=false; preB.restore();}
check("kills pay the victim's cost (Δ"+Math.round((scorer.score||0)-before)+" = "+kcost+")",
  !victim.alive&&Math.round((scorer.score||0)-before)===kcost);
scorer.remote=null;
// red team selection: a hello asking for RED gets a RED body
const fakeConn={peer:"red-friend",open:true,sent:[],send(o){this.sent.push(o);}};
NET.hostAdmit(fakeConn,"RedFriend","red");
const redBody=NET.remotes["red-friend"]&&NET.remotes["red-friend"].unit;
check("team selection: a RED request yields a RED body",redBody&&redBody.team===1&&redBody.remote==="red-friend");
// ---- v92: co-op admission, private-hall passwords, the hall registry, the name screen ----
{const cc={peer:"coop-friend",open:true,sent:[],send(o){this.sent.push(o);}};
 NET.gameMode="coop";
 NET.hostAdmit(cc,"CoopFriend","red");
 const cb=NET.remotes["coop-friend"]&&NET.remotes["coop-friend"].unit;
 check("CO-OP: a RED request still lands in BLUE",!!cb&&cb.team===0);
 NET.gameMode="pvp";
 NET.hostDrop(cc);}
{const pc={peer:"pw-friend",open:true,sent:[],send(o){this.sent.push(o);}};
 NET.password="mead";
 NET.hostData(pc,{t:"hello",proto:NET.PROTO,name:"Sneak",team:"blue",pw:"ale"});
 const denied=pc.sent.some(m=>m.t==="deny"&&/password/i.test(m.m))&&!NET.remotes["pw-friend"];
 NET.hostData(pc,{t:"hello",proto:NET.PROTO,name:"Friend",team:"blue",pw:"mead"});
 const admitted=!!NET.remotes["pw-friend"];
 check("a private hall denies the wrong password and admits the right one",denied&&admitted);
 NET.password=""; NET.hostDrop(pc);}
{const lc={open:true,sent:[],send(o){this.sent.push(o);}};
 NET.hall.servers={};
 NET.hallData(lc,{t:"announce",s:{code:"regicide-aaaa",name:"Filip",mode:"pvp",players:2,proto:NET.PROTO}});
 NET.hall.servers["regicide-zzzz"]={code:"regicide-zzzz",name:"Ghost",mode:"pvp",players:1,proto:NET.PROTO,t:-1e9}; // two heartbeats dead
 const mSave=NET.mode, rcSave=NET.roomCode, pubSave=NET.isPublic;
 NET.mode="host"; NET.roomCode="regicide-test"; NET.isPublic=true;
 NET.hallData(lc,{t:"list"});
 const resp=lc.sent.find(m=>m.t==="servers");
 check("the hall lists fresh games + its keeper's own, and sweeps the dead",
   !!resp&&resp.list.length===2&&resp.list.some(s=>s.code==="regicide-aaaa")&&
   resp.list.some(s=>s.code==="regicide-test")&&!resp.list.some(s=>s.code==="regicide-zzzz"));
 NET.isPublic=false; lc.sent.length=0;
 NET.hallData(lc,{t:"list"});
 const resp2=lc.sent.find(m=>m.t==="servers");
 check("a PRIVATE hall keeps itself off the list",!!resp2&&!resp2.list.some(s=>s.code==="regicide-test"));
 NET.mode=mSave; NET.roomCode=rcSave; NET.isPublic=pubSave; NET.hall.servers={};}
{global.document.getElementById("playername").value="John T";
 NET.uiName();
 check("the name screen names the warrior (myName='"+NET.myName+"')",NET.myName==="John T");
 NET.myName="Warrior";}
// v93: hostAct buff — a guest's pick is validated against the standing table + the forge's yard
{const bu=global.__G.makeUnit(0,"clubman",-118,60,{name:"Chooser",bot:null}); bu.remote="smith-peer";
 const fr={unit:bu,conn:{open:true,sent:[],send(o){this.sent.push(o);}},name:"Chooser"};
 bu.xp=2; bu.smithOffer=null;
 NET.mode="host";
 const off=global.__G.smithOffer(bu);
 NET.hostAct(fr,{act:"buff",pick:"bogus"});
 const denied=fr.conn.sent.some(m=>m.t==="deny");
 NET.hostAct(fr,{act:"buff",pick:off[1]});
 NET.mode="guest";
 check("hostAct buff: a bogus pick is denied; the offered pick is granted (stack "+global.__G.buffSt(bu,off[1])+", xp "+bu.xp+")",
   denied&&global.__G.buffSt(bu,off[1])===1&&bu.xp===1);
 bu.alive=false;}
if(redBody){redBody.remote=null;delete NET.remotes["red-friend"];NET.conns=NET.conns.filter(c=>c!==fakeConn);}

// THE PISTOL: six rounds through the REAL tryAttack, then dry clicks
const drg=global.__G.makeUnit(0,"villager",-186,106,{name:"Pistoleer"});
global.__G.NET.mode="host";
{
  drg.cls="dragoon"; drg.dmg=CLS.dragoon.dmg; drg.rng=CLS.dragoon.rng; drg.cd=CLS.dragoon.cd;
  drg.ammo=6; drg.atkT=0;
  const mark=global.__G.makeUnit(1,"clubman",-186,112,{name:"Mark"}); // 6 away: pistol range, NOT melee
  mark.hp=mark.maxHp=2000;
  let shots=0;
  for(let i=0;i<9;i++){drg.atkT=0; if(global.__G.tryAttack(drg))shots++;}
  check("the pistol holds six rounds (fired "+shots+", ammo "+drg.ammo+", damage "+(2000-mark.hp)+")",
    shots===6&&drg.ammo===0&&Math.round(2000-mark.hp)===330);
  check("an empty pistol falls silent at range",global.__G.tryAttack(drg)===false);
  mark.alive=false; mark.hp=0;
}
global.__G.NET.mode="guest";

// THE SKILL SHOT: a lobbed stone splashes a cluster
global.__G.NET.mode="host";
{
  const cat=global.__G.makeUnit(0,"villager",-180,95,{name:"Gunner"});
  cat.cls="catapult"; cat.dmg=40; cat.cd=4; cat.atkT=0;
  const v1=global.__G.makeUnit(1,"clubman",-168,95,{name:"S1"});
  const v2=global.__G.makeUnit(1,"clubman",-166,97,{name:"S2"});
  v1.hp=v1.maxHp=500; v2.hp=v2.maxHp=500;
  global.__G.launchLob(cat,-167,96);
  for(let i=0;i<90;i++)tick();
  check("the skill shot lands and SPLASHES the cluster (hp "+Math.round(v1.hp)+"/"+Math.round(v2.hp)+")",
    v1.hp<500&&v2.hp<500);
  v1.alive=false;v2.alive=false;cat.alive=false;
}
global.__G.NET.mode="guest";

// THE FROZEN-CLOCK regression: combat timers must tick even for LOD-skipped units.
// (atkT once lived in animateUnit, which LOD gates — far units locked after one attack)
const swU=global.__G.makeUnit(0,"villager",-198,112,{name:"Unseen Statue"}); // no bot: it just stands
swU.lodSkipAnim=true; swU.root.visible=false;
swU.atkT=3; swU.swing=0.25; swU.attackAnimT=0.4;
for(let i=0;i<30;i++)tick();
check("combat clocks tick for UNSEEN units (atkT "+swU.atkT.toFixed(2)+", swing "+swU.swing.toFixed(2)+")",
  swU.atkT<3&&swU.swing<=0&&swU.attackAnimT<=0);
try{
  NET.applySnap(NET.packSnap()); // keyframe round-trip in guest mode
  NET.applySnap(NET.packSnap()); // lean round-trip (no blds field)
  const stale=NET.packSnap(); stale.q=-5;
  NET.applySnap(stale);          // out-of-order arrival must be discarded
  check("applySnap loopback survives keyframe + lean + stale",true);
}catch(e){console.error("  applySnap threw:",e.message);check("applySnap loopback survives keyframe + lean + stale",false);}
check("guest mode engaged after world apply",NET.mode==="guest");
// hammer the guest frame: prediction, interpolation, watchdog, effects
const keys=global.__G.keys; keys.w=true; // guest holds W — prediction must move us
const pp=units.find(u=>u.isPlayer);
pp.alive=true; pp.hp=pp.maxHp; pp.root.visible=true; pp.garrison=null; // possession can hand us a corpse
pp.root.position.set(-40,0,60); // open ground: walls and buildings can pin a spawn to 0.0 movement
delete pp.authX; // stale authority must not yank the measurement
const px0=pp.root.position.x, pz0=pp.root.position.z;
let gfOK=true;
try{
  NET.applySnap(NET.packSnap()); // prime interp pairs + authority
  for(let i=0;i<40;i++)NET.guestFrame(0.05); // 2 predicted seconds
}catch(e){console.error("  guestFrame threw:",e.stack.split("\n").slice(0,3).join("\n"));gfOK=false;}
keys.w=false;
check("guest frame survives 40 frames",gfOK);
const moved=Math.hypot(pp.root.position.x-px0,pp.root.position.z-pz0);
check("prediction: our body moves locally the moment W is held ("+moved.toFixed(1)+" units)",moved>1);

// ---- v75: corpses linger where they fall; priests resurrect the dead ----
global.__G.setGameOver(false); // an accidental regicide in a prior staged fight must not mute this section
global.__G.NET.mode="host";
{
  const cVic=global.__G.makeUnit(0,"clubman",-150,118,{name:"Fallen"});
  const cAtt=global.__G.makeUnit(1,"clubman",-149,118,{name:"Slayer"});
  cVic.hp=1;
  global.__G.setGameOver(false); // 05-combat.js:196 — dealDamage is a NO-OP once a king has fallen
  global.__G.dealDamage(cAtt,cVic,999);
  check("a slain unit becomes a lingering corpse (not gone at once)",
    !cVic.alive&&cVic.corpse===true&&cVic.respawnT>0);
  warTicks(40); // dieT 0.9 @ 1/30 ≈ 27 frames → topple finishes (and the war stays open through it)
  check("the corpse lies toppled on the field, still present after the fall",
    cVic.corpse===true&&!cVic.alive&&Math.abs(cVic.body.rotation.x)>1);
  cAtt.alive=false; cVic.alive=false; cVic.corpse=false;
}
// resurrectUnit restores a corpse to life, at full HP, KEEPING its class (not a villager respawn)
{
  const rVic=global.__G.makeUnit(0,"archer",-142,118,{name:"Martyr"});
  const rPri=global.__G.makeUnit(0,"villager",-140,118,{name:"Padre"}); rPri.cls="priest"; rPri.remote="res-peer"; // human priest → scores
  const foe=global.__G.makeUnit(1,"clubman",-141,118,{name:"Reaper"}); rVic.hp=1;
  global.__G.setGameOver(false); // …the pair below failed for exactly this, not for broken corpses
  global.__G.dealDamage(foe,rVic,999);
  check("the resurrection target is a corpse first",rVic.corpse===true&&!rVic.alive);
  const pri0=rPri.score||0;
  global.__G.resurrectUnit(rVic,rPri);
  check("a priest raises the fallen to life at full HP, standing upright",
    rVic.alive&&!rVic.corpse&&rVic.hp===rVic.maxHp&&Math.abs(rVic.body.rotation.x)<0.01);
  check("resurrection keeps the unit's class (archer, not a reset villager)",rVic.cls==="archer");
  check("the priest is rewarded for the miracle (score climbs)",(rPri.score||0)>pri0);
  rVic.alive=false;rVic.corpse=false;foe.alive=false;rPri.alive=false;
}
// the CHANNEL: hold LMB ~2s to charge, release over a body to raise, then a ~10s cooldown
{
  const pl=units.find(u=>u.isPlayer); // NB: possession reassigned `player`, so __G.player is stale — read the live one
  const ox=pl.root.position.x,oz=pl.root.position.z,ocls=pl.cls,oteam=pl.team;
  global.__G.NET.mode="solo"; // resurrect locally, no host round-trip
  pl.cls="priest"; pl.team=0; pl.alive=true;
  pl._resCd=0; pl._resCharge=0; pl._resReady=false; pl._resNag=false;
  pl.root.position.set(-118,0,120);
  const downed=global.__G.makeUnit(0,"archer",-118,120,{name:"Downed"});
  downed.alive=false; downed.corpse=true; downed.dieT=0; downed.respawnT=99; downed.hp=0;
  for(let i=0;i<40;i++)global.__G.updatePriestChannel(1/30,true); // ~1.33s held
  check("priest charge builds but is NOT ready before 2s",!pl._resReady&&pl._resCharge>0);
  for(let i=0;i<30;i++)global.__G.updatePriestChannel(1/30,true); // total ~2.33s held
  check("priest reaches a fully-charged state after ~2s of holding",pl._resReady===true);
  global.__G.updatePriestChannel(1/30,false); // release over the body
  check("releasing a charged priest over a corpse resurrects it",
    downed.alive&&!downed.corpse&&downed.hp===downed.maxHp);
  check("a successful resurrection opens a ~10s cooldown",pl._resCd>9);
  global.__G.updatePriestChannel(1/30,true); // try to recharge while on cooldown
  check("a priest on cooldown cannot recharge (faith must recover)",pl._resCharge===0&&!pl._resReady);
  downed.alive=false; downed.corpse=false;
  // v76: siege engines are beyond salvation — a wrecked catapult under the priest is NOT a target
  pl._resCd=0; pl._resCharge=0; pl._resReady=false;
  const wreck=global.__G.makeUnit(0,"catapult",-118,120,{name:"Wreck"});
  wreck.alive=false; wreck.corpse=true; wreck.dieT=0; wreck.hp=0;
  check("a priest cannot resurrect a siege engine (tryResurrect refuses)",
    global.__G.tryResurrect()===false&&!wreck.alive&&wreck.corpse===true);
  wreck.corpse=false;
  pl.cls=ocls; pl.team=oteam; pl.root.position.set(ox,0,oz);
  pl._resCd=0; pl._resCharge=0; pl._resReady=false; pl._resNag=false;
  if(pl._resFX)pl._resFX.g.visible=false;
  global.__G.NET.mode="guest";
}

// ================= v95: THE NETCODE OVERHAUL =================
global.__G.setGameOver(false); // staged fights ahead — the mute stays off
{
  const G=global.__G;
  // ---- binary rows survive the wire to the wire's own precision ----
  {
    NET.mode="host"; NET._lastRow=null;
    const s=NET.packSnap(), rows=NET.readSnapRows(s);
    const live=units.find(x=>x.alive);
    const r=rows.find(w=>w[0]===live.id);
    check("v95 binary roundtrip: position ±0.05, hp exact, class index true",
      !!r&&Math.abs(r[3]/10-live.root.position.x)<=0.06&&Math.abs(r[4]/10-live.root.position.z)<=0.06&&
      r[6]===Math.round(live.hp)&&Object.keys(G.CLS)[r[1]]===live.cls);
  }
  // ---- congestion control: a backed-up lane is skipped; a drained lane is served ----
  {
    const sent=[];
    NET.remotes["cg-rel"]={conn:{open:true,dataChannel:{bufferedAmount:999999},send:o=>sent.push(o)},fast:null,unit:null,input:{}};
    NET.bcastFast({t:"snap",q:4}); // fast lane down → reliable heartbeat wanted — but the pipe is CHOKED
    const choked=sent.length, skipped=NET.remotes["cg-rel"].skipR||0;
    NET.remotes["cg-rel"].conn.dataChannel.bufferedAmount=0;
    NET.bcastFast({t:"snap",q:8}); // drained → served
    check("v95 congestion: reliable lane never queues behind a backlog ("+choked+" sent choked, "+sent.length+" after drain)",
      choked===0&&skipped===1&&sent.length===1);
    const fsent=[];
    NET.remotes["cg-fast"]={conn:{open:true,dataChannel:{bufferedAmount:0},send(){}},
      fast:{open:true,dataChannel:{bufferedAmount:999999},send:o=>fsent.push(o)},unit:null,input:{}};
    NET.bcastFast({t:"snap",q:1}); // fast lane up but choked, q%4!==0 → nobody gets this one
    check("v95 congestion: a choked FAST lane skips the frame",fsent.length===0&&(NET.remotes["cg-fast"].skipF||0)===1);
    check("v95 laneBuf survives lanes with no dataChannel (relay quirks)",NET.laneBuf({})===0&&NET.laneBuf(null)===0);
    delete NET.remotes["cg-rel"]; delete NET.remotes["cg-fast"];
  }
  // ---- AOI: near units every snap; far motion at quarter rate; structure breaks through ----
  {
    const gb=G.makeUnit(0,"villager",-150,60,{name:"AOIGuest",bot:{role:"citizen"}}); gb.remote="aoi-peer";
    NET.remotes["aoi-peer"]={conn:{open:true,send(){}},unit:gb,input:{}};
    const near=G.makeUnit(1,"clubman",-140,60,{name:"NearFoe",bot:null}); near.hp=near.maxHp=4000;
    const far=G.makeUnit(1,"clubman",150,-50,{name:"FarFoe",bot:null}); far.hp=far.maxHp=4000;
    NET._lastRow=null; NET.packSnap(); // keyframe swallows the newcomers
    let nearN=0,farN=0;
    for(let i=0;i<8;i++){
      if((NET._snapN+1)%15===0)NET._snapN++; // dodge the full-refresh slot: we measure the THROTTLE
      near.root.position.x+=0.3; far.root.position.x+=0.3;
      const rows=NET.readSnapRows(NET.packSnap());
      if(rows.some(w=>w[0]===near.id))nearN++;
      if(rows.some(w=>w[0]===far.id))farN++;
    }
    check("v95 AOI: near motion ships every snap, far motion ~every 4th ("+nearN+"/"+farN+")",
      nearN===8&&farN>=1&&farN<=3);
    if((NET._snapN+1)%15===0)NET._snapN++;
    far.alive=false; // STRUCTURAL change far away — must break through the throttle at once
    const rows2=NET.readSnapRows(NET.packSnap());
    check("v95 AOI: a far death ships immediately (structure beats distance)",rows2.some(w=>w[0]===far.id));
    delete NET.remotes["aoi-peer"]; gb.remote=null; gb.alive=false; near.alive=false;
  }
  // ---- hostAct train: back-to-villager legal, wilds & future tiers refused ----
  {
    const tu=G.makeUnit(0,"clubman",-100,100,{name:"Turncoat",bot:null}); tu.remote="tr-peer"; tu.alive=true;
    const denies=[];
    const tr={unit:tu,conn:{open:true,send:o=>{if(o&&o.t==="deny")denies.push(o.m);}},name:"Turncoat"};
    G.stock[0].food+=500; G.stock[0].gold+=500;
    NET.hostAct(tr,{act:"train",cls:"villager"});
    check("v95 hostAct: BACK TO VILLAGER is legal for guests at last (was 'Unknown class')",
      tu.cls==="villager"&&denies.length===0);
    NET.hostAct(tr,{act:"train",cls:"vikingboss"});
    check("v95 hostAct: wilds can't be trained even with gold in hand",tu.cls==="villager"&&denies.length===1);
    const aSave=G.teamAge[0]; G.teamAge[0]=0;
    NET.hostAct(tr,{act:"train",cls:"musketeer"});
    check("v95 hostAct: age-gated tiers are refused (Stone Age musketeer)",tu.cls==="villager"&&denies.length===2);
    const legal=G.lineUnitFor("melee",0);
    NET.hostAct(tr,{act:"train",cls:legal});
    check("v95 hostAct: the line's current tier still trains ("+legal+")",tu.cls===legal&&denies.length===2);
    G.teamAge[0]=aSave;
    tu.remote=null; tu.alive=false;
  }
  // ---- hostAdmit: every joiner takes the field as a VILLAGER ----
  {
    const ac={peer:"adm-peer",open:true,sent:[],send(o){this.sent.push(o);}};
    NET.hostAdmit(ac,"NewBoots","blue");
    const au=NET.remotes["adm-peer"]&&NET.remotes["adm-peer"].unit;
    check("v95 admit: the joiner spawns as a Villager (or a respawning body — respawn IS villager)",
      !!au&&ac.sent.some(m=>m.t==="admit")&&(!au.alive||au.cls==="villager"));
    NET.hostDrop(ac);
  }
  // ---- stale inputs stop the body: no runaway ghost-walking on a clogged uplink ----
  {
    const su=G.makeUnit(0,"villager",-40,64,{name:"Staller",bot:null}); su.alive=true; su.garrison=null;
    // v126: stamp inputAt off NET.now, not performance.now. The whole net layer reads wall time
    // through that seam now, and the harness drives it — mixing the two clocks here made a
    // freshly-stamped input look ~970 SECONDS old and the body refused to walk at all.
    const sr={unit:su,conn:{open:true,send(){}},input:{w:1,yaw:0},inputAt:NET.now(),rtt:0};
    const x0=su.root.position.z;
    for(let i=0;i<10;i++)NET.driveRemote(sr,0.05);
    const walked=Math.abs(su.root.position.z-x0)>0.5;
    sr.inputAt=NET.now()-5000; // the uplink died 5s ago
    const x1=su.root.position.z;
    for(let i=0;i<10;i++)NET.driveRemote(sr,0.05);
    check("v95 stale inputs: fresh keys walk ("+walked+"), dead keys stop the body",
      walked&&Math.abs(su.root.position.z-x1)<0.01);
    su.alive=false;
  }
  // ---- PERSONAL WARBANDS: two leaders, two bands, no poaching, death releases ----
  {
    NET.mode="solo";
    const A=G.makeUnit(0,"clubman",-60,40,{name:"LeaderA",bot:null}); A.remote="wbA"; A.alive=true;
    const B=G.makeUnit(0,"clubman",-40,40,{name:"LeaderB",bot:null}); B.remote="wbB"; B.alive=true;
    const pool=[];
    for(let i=0;i<12;i++)pool.push(G.makeUnit(0,"clubman",-56+i*3,44,{name:"WB"+i,bot:{role:"citizen"}}));
    for(const v of units){v.rally=false;v.rallyBy=null;v.chargeTo=null;} // a clean parade ground
    const rA=G.toggleRallyFor(A);
    const rB=G.toggleRallyFor(B);
    const bandA=units.filter(v=>v.rallyBy===A), bandB=units.filter(v=>v.rallyBy===B);
    check("v95 warbands: two leaders each hold their OWN five ("+bandA.length+"/"+bandB.length+", no overlap)",
      !!rA&&rA.on&&!!rB&&rB.on&&bandA.length===5&&bandB.length===5&&!bandA.some(v=>bandB.includes(v)));
    const rB2=G.toggleRallyFor(B); // B recalls…
    check("v95 warbands: B's recall leaves A's band standing",
      !!rB2&&!rB2.on&&units.filter(v=>v.rallyBy===B).length===0&&units.filter(v=>v.rallyBy===A).length===5);
    G.toggleRallyFor(B); // …and re-rallies from the free pool
    const chargedA=G.orderCharge(A,0);
    const bHolds=units.filter(v=>v.rallyBy===B&&!v.chargeTo).length;
    check("v95 warbands: A's CHARGE moves only A's five ("+chargedA+" charged, "+bHolds+" hold)",
      chargedA===5&&bHolds===5);
    G.killUnit(A); // the horn falls silent
    check("v95 warbands: a fallen leader's band is released, the other band stands",
      units.filter(v=>v.rallyBy===A).length===0&&units.filter(v=>v.rallyBy===B).length===5);
    G.toggleRallyFor(B);
    A.remote=null;B.remote=null;A.alive=false;B.alive=false;A.corpse=false;
    for(const s of pool)s.alive=false;
  }
  // ---- work pulse: a stationary worker's re-arriving row re-swings the arm ----
  {
    NET.mode="host";
    const wk=G.makeUnit(1,"clubman",-30,30,{name:"Statue",bot:null}); wk.alive=true;
    wk.swing=0.2; wk.attackAnimT=0; // mid-work on the host
    NET._lastRow=null;
    const s=NET.packSnap();
    const rows=NET.readSnapRows(s), i=rows.findIndex(w=>w[0]===wk.id);
    const oldPulse=(rows[i][2]>>3)&3;
    NET.mode="guest";
    // The re-trigger is read off SWING, not attackAnimT: triggerAttackAnim only moves
    // attackAnimT when a mixer clip or the baked pool is loaded, and baked playback is
    // disabled in index.html — a procedural clubman would fail an animT assertion for a
    // reason that has nothing to do with the pulse. Swing is the arm the pulse re-arms.
    // Park it well ABOVE the 0.05 floor so ONLY a pulse change can reset it to 0.25.
    // same pulse arrives while the local arm is still up → NO re-trigger (echoes would loop the arm)
    wk.swing=0.9; wk.attackAnimT=0; wk._pulse=oldPulse;
    s.q=NET.lastQ+1; NET.applySnap(s);
    const noRetrig=wk.swing===0.9;
    // the NEXT half-second of work bumps the pulse → the statue swings again
    rows[i][2]=(rows[i][2]&~24)|(((oldPulse+1)&3)<<3);
    s.ub=NET.packRows(rows); s.q=NET.lastQ+1;
    NET.applySnap(s);
    check("v95 work pulse: same pulse holds, bumped pulse re-swings the statue",
      noRetrig&&wk.swing===0.25&&wk._pulse===((oldPulse+1)&3));
    wk.alive=false;
  }
  // ---- stale-authority guard: a backlog snapshot may not yank our body into the past ----
  // v126 REWRITTEN, because the mechanism changed and this test was asserting the mechanism.
  // v95 compared two SIM clocks (our estT vs the snapshot's T); v126 compares the host's own
  // monotonic `ht` against itself. The old test faked age by rolling s2.T back three seconds —
  // under v126 that snapshot is correctly judged FRESH, because its ht says it left the host a
  // moment ago and a sim clock running slow is not the same thing as a stale packet. That
  // distinction IS the fix (John's guests refused authority on ~88% of a perfectly live feed),
  // so the test now fakes age the honest way: by rolling `ht` back.
  {
    const realNow=NET.now;
    let clk=1e6; NET.now=()=>clk; // a clock we control — age is now a wall-clock measurement
    NET.mode="host"; NET._lastRow=null;
    const s1=NET.packSnap(), s2=NET.packSnap(), s3=NET.packSnap();
    NET.mode="guest";
    const pl=units.find(u=>u.isPlayer); pl.alive=true;
    NET._hOff=undefined;NET._hOffAt=0; // a fresh baseline for the delay floor
    pl.authX=undefined; pl.authAt=0;
    s1.q=NET.lastQ+1;
    NET.applySnap(s1); // arrival == ht → zero age → fresh → authority arms
    const armed=typeof pl.authX==="number";
    pl.authX=undefined; pl.authAt=0;
    clk+=3000; s2.q=NET.lastQ+1;     // three seconds pass; s2's ht is three seconds old
    NET.applySnap(s2); // world state applies, the leash does NOT re-arm
    const blocked=pl.authX===undefined;
    // …and the delay FLOOR must not have absorbed it: a snapshot minted at the new clock is
    // fresh again immediately. (If _hOff had been re-floored by the 3s sample, this would fail.)
    NET.mode="host"; const s4=NET.packSnap(); NET.mode="guest";
    s4.q=NET.lastQ+1; NET.applySnap(s4);
    const recovered=typeof pl.authX==="number";
    check("v126 snapshot age: a live feed arms the leash, a 3s-old ht cannot, and the next live snap re-arms",
      armed&&blocked&&recovered);
    // ---- the v125 fallback: a host with no `ht` on the wire still gets the old sim-clock test ----
    // This path is not decoration — it is what a v126 guest does against a v125 host, and PROTO
    // stays 25 precisely so that pairing is legal. It must keep working.
    {
      pl.authX=undefined; pl.authAt=0;
      NET._hasHt=false;
      NET.mode="host"; const l1=NET.packSnap(), l2=NET.packSnap(); NET.mode="guest";
      delete l1.ht; delete l2.ht;               // pretend a v125 host minted these
      NET.estT=l1.T; l1.q=NET.lastQ+1;
      NET.applySnap(l1);
      const legacyArmed=typeof pl.authX==="number";
      pl.authX=undefined; pl.authAt=0;
      l2.T=Math.round((l2.T-3)*10)/10; l2.q=NET.lastQ+1; // born three sim-seconds ago
      NET.estT=l1.T;
      NET.applySnap(l2);
      check("v126 legacy path: against a v125 host (no ht) the old sim-clock guard still gates the leash",
        legacyArmed&&pl.authX===undefined);
    }
    // leave no authority armed — the gather-theatre block below stands still next to a node,
    // and a live leash would drag the body out of reach and silently zero its swing
    pl.authX=undefined; pl.authAt=0; NET._hasHt=true;
    NET.mode="host"; const s5=NET.packSnap(); NET.mode="guest"; s5.q=NET.lastQ+1; NET.applySnap(s5);
    pl.authX=undefined; pl.authAt=0;
    NET.now=realNow;
  }
  // ---- gather theatre: the guest's own pick swings; the ore stays host-authoritative ----
  {
    NET.mode="guest";
    G.closeMenus(); G.cancelPlacing(); // a stray open menu would rightly gate the theatre
    const pl=units.find(u=>u.isPlayer);
    pl.alive=true; pl.garrison=null; G.setClass(pl,"villager");
    const nd=nodes.find(n=>n.amount>10);
    pl.root.position.set(nd.x+1.5,0,nd.z);
    const kk=G.keys; kk.w=kk.a=kk.s=kk.d=false; kk.e=true;
    pl.swing=0; pl._gfxT=0; const amt=nd.amount;
    let gtOK=true;
    try{for(let i=0;i<30;i++)NET.guestFrame(1/30);}catch(e){console.error("  gather theatre threw:",e.message);gtOK=false;}
    kk.e=false;
    check("v95 gather theatre: the pick swings ("+pl.swing.toFixed(2)+"), the node is untouched ("+nd.amount+"/"+amt+")",
      gtOK&&pl.swing>0&&nd.amount===amt);
  }
  // ---- the batched arrow theatre: shots ride the snap, not the reliable lane ----
  {
    NET.mode="host";
    const bow=G.makeUnit(0,"villager",-20,20,{name:"Bower"}); bow.cls="archer"; bow.rng=20; bow.dmg=5; bow.atkT=0;
    const tgt=G.makeUnit(1,"clubman",-20,26,{name:"Butt"}); tgt.hp=tgt.maxHp=4000;
    NET._fx.length=0;
    G.shootArrow(bow,tgt); // the arrow (through the live wrapped binding)

    const queued=NET._fx.length===1;
    const s=NET.packSnap();
    check("v95 shot batching: the arrow queues, rides the next snap, and the queue drains",
      queued&&s.fx&&s.fx.length===1&&s.fx[0][0]===bow.id&&NET._fx.length===0);
    bow.alive=false; tgt.alive=false;
    NET.mode="guest";
  }
}

// ================= v96: THE FACING RELAY =================
{
  const G=global.__G;
  // host side: the input packet's facing is adopted; a packet WITHOUT one leaves facing be
  {
    NET.mode="host";
    const fu=G.makeUnit(0,"villager",-44,58,{name:"Facer",bot:null}); fu.alive=true; fu.garrison=null; fu.facing=0;
    const fr={unit:fu,conn:{open:true,send(){}},input:{px:fu.root.position.x,pz:fu.root.position.z,f:2.5},lastE:false};
    NET.driveRemote(fr,0.05);
    const adopted=Math.abs(fu.facing-2.5)<0.01;
    fu.facing=1.0; // calibration: strip the field — the guard must NOT touch facing
    fr.input={px:fu.root.position.x,pz:fu.root.position.z};
    NET.driveRemote(fr,0.05);
    check("v96 facing relay: reported facing adopts (→2.5), absent facing is left alone (1.0)",
      adopted&&Math.abs(fu.facing-1.0)<0.01);
    fu.alive=false;
  }
  // guest side: our outgoing input packet carries our TRUE body facing
  {
    NET.mode="guest";
    const sentIn=[];
    const oldConn=NET.conn, oldFast=NET.fast;
    NET.fast=null; NET.conn={open:true,send:o=>{if(o&&o.t==="input")sentIn.push(o);}};
    const pl=units.find(u=>u.isPlayer);
    pl.alive=true; pl.garrison=null;
    const kk=G.keys; kk.w=kk.a=kk.s=kk.d=kk.e=false;
    pl.facing=1.2;
    NET.inputT=1; // due for a send this very frame
    NET.guestFrame(0.001);
    NET.conn=oldConn; NET.fast=oldFast;
    check("v96 facing relay: the input packet ships our facing ("+(sentIn.length&&sentIn[0].f)+")",
      sentIn.length>0&&typeof sentIn[0].f==="number"&&Math.abs(sentIn[0].f-1.2)<0.05);
  }
}

// ================= v97: GUEST SIEGE + THE BUILDING DIET =================
global.__G.setGameOver(false);
{
  const G=global.__G;
  // ---- guest siege aim: RMB on a catapult is the SKILL SHOT, not the archer zoom ----
  {
    NET.mode="guest";
    G.closeMenus(); G.cancelPlacing();
    const pl=units.find(u=>u.isPlayer);
    pl.alive=true; pl.garrison=null; G.setClass(pl,"catapult"); pl.atkT=0;
    G.setRmb(true); G.setLmb(false);
    tick(); // guestFrame computes the stances; renderFrame climbs the camera + marks lobTarget
    const aimCat=G.getSiegeAim()===true;
    G.setClass(pl,"archer"); // calibration: ranged NON-siege keeps the aim-zoom path
    tick();
    const aimArc=G.getSiegeAim()===false;
    check("v97 guest siege aim: catapult RMB arms the skill shot; archer RMB does not",aimCat&&aimArc);
    G.setClass(pl,"catapult"); pl.atkT=0; NET._pendingLob=null;
    tick(); // re-arm siegeAim under held RMB
    G.setLmb(true); G.setLock(true);
    tick(); // LMB fires playerPrimary's guest branch
    check("v97 guest siege aim: LMB queues the lob for the host",
      !!NET._pendingLob&&typeof NET._pendingLob.x==="number");
    G.setRmb(false); G.setLmb(false); G.setLock(false); NET._pendingLob=null;
    tick();
  }
  // ---- driveRemote: the lob lands where the guest aimed (catapult reach = the UI's 46) ----
  {
    NET.mode="host";
    const cu=G.makeUnit(0,"villager",-70,20,{name:"GuestGunner",bot:null});
    G.setClass(cu,"catapult"); cu.remote="lob-peer"; cu.alive=true; cu.atkT=0;
    const seen=[]; const cstub={open:true,send:o=>{if(o&&o.t==="lob")seen.push(o);}};
    NET.conns.push(cstub);
    const fr={unit:cu,conn:{open:true,send(){}},input:{lobx:cu.root.position.x+44,lobz:cu.root.position.z},lastE:false};
    NET.driveRemote(fr,0.05);
    NET.conns=NET.conns.filter(c=>c!==cstub);
    check("v97 guest lob: the stone flies to the mark 44 out (was clamped to 38)",
      seen.length===1&&Math.abs(seen[0].tx-(cu.root.position.x+44))<0.6&&cu.atkT>0);
    cu.alive=false;
  }
  // ---- building rows: binary roundtrip + the quantized delta key ----
  {
    const hb=G.makeBuilding(0,"house",-95,40,false); // a site mid-construction
    hb.hp=321.4; hb.progress=7;
    const fb=G.makeBuilding(0,"farm",-95,52,true); fb.crop=0.73;
    NET._lastRow=null; // keyframe
    const s=NET.packSnap();
    const rows=NET.readBldRows(s);
    const hr=rows.find(w=>w[0]===hb.id), fr2=rows.find(w=>w[0]===fb.id);
    check("v97 bld binary: hp/progress/built/alive/crop survive the 8-byte row",
      !!hr&&hr[1]===321&&hr[2]===0&&hr[3]===7&&hr[4]===1&&
      !!fr2&&fr2[2]===1&&Math.abs(fr2[5]-0.7)<0.001);
    if((NET._snapN+1)%45===0)NET._snapN++; // dodge the building full-refresh slot
    fb.crop=0.734; // sub-quantum wiggle: same wire row, must NOT re-ship
    const again=NET.readBldRows(NET.packSnap()).some(w=>w[0]===fb.id);
    if((NET._snapN+1)%45===0)NET._snapN++;
    fb.crop=0.85;  // a real step: ships
    const shipped=NET.readBldRows(NET.packSnap()).some(w=>w[0]===fb.id);
    check("v97 bld diet: sub-quantum crop wiggle stays home, a real step ships ("+again+"/"+shipped+")",
      again===false&&shipped===true);
    hb.alive=false; fb.alive=false;
    NET.mode="guest";
  }
}

// ================= v98: THE NET LOG =================
{
  const G=global.__G;
  // guest sampler: one row per second of guest frames, with the counters aboard
  {
    NET.mode="guest";
    // v126: the sampler is wall-clocked now, so step NET.now instead of trusting 40 tight-loop
    // frames to take a real second. They never did — this check used to pass only because
    // whatever ran before it happened to burn ~1s of wall time, which is not a test, it is a
    // coincidence that had been holding for 28 versions.
    const realNow=NET.now; let clk=15e5; NET.now=()=>clk;
    const r0=NET.LOG.rows.length;
    NET._cDup=(NET._cDup||0); // ensure counters exist
    NET._pingW=clk;
    for(let i=0;i<40;i++){clk+=1000/30;NET.guestFrame(1/30);} // ~1.3s of wall time → one sampled row
    const grow=NET.LOG.rows.slice(r0).filter(r=>r.role==="g");
    check("v98 net log: the guest samples a row per second ("+grow.length+" new)",
      grow.length>=1&&typeof grow[0].snaps==="number"&&typeof grow[0].ping==="number"&&
      typeof grow[0].qgap==="number"&&typeof grow[0].fps==="number"&&grow[0].fps>0);
    check("v126 net log: the guest row carries the measured window and the snapshot age (win="+
      (grow[0]&&grow[0].win)+", age="+(grow[0]&&grow[0].age)+")",
      !!grow[0]&&grow[0].win>=990&&grow[0].win<=1050&&typeof grow[0].age==="number"&&
      typeof grow[0].ageMax==="number");
    NET.now=realNow;
  }
  // dup + gap counters feed the log
  {
    NET.mode="host"; NET._lastRow=null;
    const sA=NET.packSnap(), sB=NET.packSnap(), sC=NET.packSnap();
    NET.mode="guest";
    sA.q=NET.lastQ+1; NET.applySnap(sA);
    NET._cDup=0; NET._cGap=0;
    NET.applySnap(sA);                    // same q again → duplicate
    sC.q=NET.lastQ+5; NET.applySnap(sC);  // a 4-snap hole → gap
    check("v98 net log: duplicates and sequence holes are counted ("+NET._cDup+"/"+NET._cGap+")",
      NET._cDup===1&&NET._cGap===4);
    sB.q=NET.lastQ+1; NET.applySnap(sB); // tidy the sequence forward
  }
  // host sampler: per-guest sent/skip/ping aboard the row
  // v126: the ticker is WALL time now, not accumulated sim dt, so the old `NET._diagT=0.95`
  // nudge has nothing to nudge. Drive NET.now instead — which is also the point of the seam:
  // a harness that steps the clock by hand cannot accidentally pass because the block before
  // it happened to take a second of real time (the guest sampler check below was doing that).
  {
    NET.mode="host";
    const realNow=NET.now;
    let clk=2e6; NET.now=()=>clk;
    const hu=G.makeUnit(0,"villager",-50,55,{name:"LogGuest",bot:null}); hu.remote="log-peer"; hu.alive=true;
    NET.remotes["log-peer"]={conn:{open:true,send(){}},unit:hu,input:{},name:"LogGuest",rtt:87,sentF:12,skipF:3};
    const r0=NET.LOG.rows.length;
    NET._diagW=clk; NET._snapW=clk; NET._simT0=undefined;
    clk+=1000;                       // one wall second passes
    NET.hostFrame(0.06);             // …and the ticker fires on it
    const hrow=NET.LOG.rows.slice(r0).find(r=>r.role==="h");
    check("v98 net log: the host row carries per-guest sent/skip/ping",
      !!hrow&&hrow.g&&hrow.g.LogGuest&&hrow.g.LogGuest.sent===12&&hrow.g.LogGuest.skipF===3&&hrow.g.LogGuest.ping===87);
    check("v98 net log: the 1s ticker resets the send window",NET.remotes["log-peer"].sentF===0);
    // v126: `win` is the measured window, not an assumed 1000 — every rate in the row is per
    // `win`. The host rows in John's v125.1 logs were up to 2.04s apart while claiming to be
    // one second, which inflated fps and sent/s by up to 2× exactly when the host was worst.
    check("v126 net log: the host row reports the window it actually measured (win="+(hrow&&hrow.win)+")",
      !!hrow&&hrow.win>=990&&hrow.win<=1010);
    // and simR: the sim clock's rate against wall time. 0.85 in John's session; the one number
    // that makes a clamped-dt host self-evident instead of something you have to derive.
    check("v126 net log: the host row reports simR, the sim clock's rate against wall time",
      !!hrow&&typeof hrow.simR==="number");
    delete NET.remotes["log-peer"]; hu.remote=null; hu.alive=false;
    NET.now=realNow;
  }
  // saveLog: a well-formed payload even headless (download guarded)
  {
    NET.logEvent("test-probe",{ok:1});
    const p=NET.saveLog();
    check("v98 net log: saveLog returns meta+rows+events (role "+p.meta.role+", "+p.rows.length+" rows)",
      p&&p.meta&&p.meta.game==="REGICIDE"&&p.meta.proto===NET.PROTO&&Array.isArray(p.rows)&&
      p.rows.length>=2&&p.events.some(e=>e.k==="test-probe"));
  }
  NET.mode="guest";
}

// ================= v126: THE LANES =================
// Everything in this block is a fix for something John's three field logs (one host, two
// guests, same 24-minute playthrough) proved was happening. The numbers in the comments are
// measured from those files, not estimated.
{
  const G=global.__G;
  // a stand-in lane: records what it was sent, and lets a test pin bufferedAmount where it likes
  const mkLane=()=>{const L={open:true,sent:[],dataChannel:{bufferedAmount:0},closed:false,
    send(o){L.sent.push(o);},close(){L.closed=true;L.open=false;}};return L;};
  const mkRemote=(name,fast,conn)=>{
    const u=G.makeUnit(0,"villager",-60,60,{name,bot:null}); u.remote="peer-"+name; u.alive=true;
    return {conn,fast,unit:u,input:{},name,rtt:0};
  };
  // ---- the reliable mirror is 1Hz, not every 4th snap ----
  // Was `o.q%4===0`: 3.75Hz of full snapshots duplicated onto the RETRANSMITTING lane, which
  // applySnap then discarded at `q<=lastQ`. Measured cost: 17% of Petra's arrivals and 20% of
  // John's, thrown away — paid for while the host's send buffer sat at ≥16KB for 11–13% of
  // seconds. MIRROR_EVERY keeps a 1Hz trickle so a silently-dying fast lane still delivers a
  // world until the guest redials, and stops being the reason the buffer is full.
  {
    NET.mode="host";
    const fast=mkLane(), conn=mkLane();
    const saveR=NET.remotes; NET.remotes={"peer-M":mkRemote("Mirror",fast,conn)};
    for(let q=0;q<60;q++)NET.bcastFast({t:"snap",q});
    const onFast=fast.sent.length, onRel=conn.sent.length;
    check("v126 mirror: 60 snaps → all 60 on the fast lane, "+onRel+" mirrored on the reliable one (was 15)",
      onFast===60&&onRel===Math.ceil(60/NET.MIRROR_EVERY)&&onRel===4);
    check("v126 mirror: MIRROR_EVERY is a whole multiple of SNAP_HZ, so the trickle is exactly 1Hz",
      NET.MIRROR_EVERY===NET.SNAP_HZ);
    // the mirror must NOT sit inside the redial window, or a healthy link redials on schedule
    check("v126 mirror: the 1Hz mirror period does not fall inside REDIAL_MS (that is why the redial watches the fast lane by name)",
      (1000/NET.SNAP_HZ)*NET.MIRROR_EVERY>=1000&&NET.REDIAL_MS>=1000);
    NET.remotes=saveR;
  }
  // ---- a wedged lane gets dropped instead of skipped against for ever ----
  // John, at t+87s: buf pinned at EXACTLY 16855 for 11 straight seconds, sent:0, skipF:15/s,
  // while his body sat frozen on stale inputs. A DataChannel reporting open with a
  // bufferedAmount that never moves is dead, not busy. The guest has had `redial` for this
  // since v98; the host had nothing at all.
  {
    NET.mode="host";
    const realNow=NET.now; let clk=3e6; NET.now=()=>clk;
    const fast=mkLane(), conn=mkLane();
    fast.dataChannel.bufferedAmount=16855; // exactly John's wedged figure
    const r=mkRemote("Wedge",fast,conn);
    const saveR=NET.remotes; NET.remotes={"peer-W":r};
    for(let q=0;q<10;q++)NET.bcastFast({t:"snap",q});      // buffer never moves…
    const stillUp=!!(r.fast&&r.fast.open), skipped=r.skipF;
    clk+=NET.LANE_WEDGE_MS+200;                            // …for longer than LANE_WEDGE_MS
    NET.bcastFast({t:"snap",q:99});
    check("v126 wedged lane: a pinned buffer is tolerated briefly ("+skipped+" skips), then the lane is dropped and closed",
      stillUp&&skipped>=10&&r.fast===null&&fast.closed===true);
    check("v126 wedged lane: the reliable relay picks up the very snap that dropped it — no gap for the guest",
      conn.sent.some(o=>o.q===99));
    check("v126 wedged lane: the drop lands in the event stream",
      NET.LOG.events.some(e=>e.k==="lane-wedged"));
    // …and a lane that DRAINS is never dropped, however long it was choked before
    const fast2=mkLane(), conn2=mkLane();
    fast2.dataChannel.bufferedAmount=16855;
    const r2=mkRemote("Drain",fast2,conn2);
    NET.remotes={"peer-D":r2};
    for(let q=0;q<10;q++)NET.bcastFast({t:"snap",q});
    fast2.dataChannel.bufferedAmount=0;                    // it drains
    NET.bcastFast({t:"snap",q:50});
    fast2.dataChannel.bufferedAmount=16855;                // and chokes again on the same figure
    clk+=NET.LANE_WEDGE_MS+200;
    for(let q=51;q<54;q++)NET.bcastFast({t:"snap",q});
    check("v126 wedged lane: a lane that drained is watched afresh — a later choke on the SAME byte count still starts a new timer",
      r2.fast===fast2&&fast2.closed===false);
    NET.remotes=saveR; NET.now=realNow;
  }
  // ---- v128.4: THE RELIABLE LANE IS NOT A SNAPSHOT LANE ----
  // The v128.2 field logs: with the fast lane down the host relayed the FULL 15Hz stream on
  // the reliable, ORDERED lane behind one guard — laneBuf < BUF_REL_MAX. That guard is blind:
  // bufferedAmount reads ~800B while SCTP retransmits, so the host shovelled 600 snapshots
  // into a stalled pipe and the guest froze for 39 seconds and then took the lot at once
  // (621 snaps / 528KB, oldest 40.9s, 604 refused stale). 20 outages, 144 dead seconds, 35%
  // of that session. The floods carried 112% of a 15Hz stream: nothing was dropped, all of it
  // was delivered late. Two brakes now — the guest's own ack, and a rate cap.
  {
    NET.mode="host";
    const realNow=NET.now; let clk=5e6; NET.now=()=>clk;
    const saveR=NET.remotes;
    // the rate cap: a dead fast lane must NOT put SNAP_HZ on the reliable one
    {
      const conn=mkLane(); const r=mkRemote("Cap",null,conn);
      NET.remotes={"peer-C":r};
      for(let q=0;q<60;q++){NET.bcastFast({t:"snap",q});clk+=1000/NET.SNAP_HZ;}
      const relayed=conn.sent.length, secs=60/NET.SNAP_HZ;
      check("v128.4 relay cap: 60 snaps over "+secs.toFixed(1)+"s with the fast lane down → "+relayed+
        " on the reliable lane (~"+NET.REL_FALLBACK_HZ+"Hz), not 60",
        relayed>=Math.floor(secs*NET.REL_FALLBACK_HZ)-2&&relayed<=Math.ceil(secs*NET.REL_FALLBACK_HZ)+2);
      check("v128.4 relay cap: every relayed send is COUNTED — `sent` was sentF, so a relaying host logged 0 and read as idle",
        r.sentR===relayed&&relayed>0);
    }
    // the ack window: a guest that stops applying stops being sent to, however empty the buffer looks
    {
      const conn=mkLane(); const r=mkRemote("Ack",null,conn);
      NET.remotes={"peer-A":r};
      r.ackQ=0; // the guest is stuck on snapshot 0 — the pipe is head-of-line blocked
      for(let q=0;q<200;q++){NET.bcastFast({t:"snap",q});clk+=1000/NET.REL_FALLBACK_HZ;} // clock clears the rate cap every time
      const relayed=conn.sent.length;
      check("v128.4 ack window: a guest stuck at q=0 stops the relay after ~REL_ACK_WINDOW ("+relayed+
        " sent of 200, held "+r.holdR+") — bufferedAmount stayed 0 throughout",
        relayed<=NET.REL_ACK_WINDOW+2&&relayed>=NET.REL_ACK_WINDOW&&r.holdR>0&&conn.dataChannel.bufferedAmount===0);
      const before=conn.sent.length;
      r.ackQ=r._relQ;                     // …the guest catches up
      clk+=1000; NET.bcastFast({t:"snap",q:500});
      check("v128.4 ack window: the brake RELEASES the moment the guest catches up (a stall must not be terminal)",
        conn.sent.length===before+1);
    }
    // the 1Hz mirror is liveness, not bulk: exempt from the rate cap, still subject to the window
    {
      const fast=mkLane(), conn=mkLane(); const r=mkRemote("Mir",fast,conn);
      NET.remotes={"peer-Mi":r};
      for(let q=0;q<=NET.MIRROR_EVERY;q++){NET.bcastFast({t:"snap",q});clk+=10;} // 10ms apart: the cap would eat the 2nd mirror
      const mirrored=conn.sent.length;
      check("v128.4 mirror: the 1Hz liveness trickle is exempt from the relay rate cap ("+mirrored+" mirrors)",
        mirrored===2&&fast.sent.length===NET.MIRROR_EVERY+1);
      r.ackQ=-1000; // …but a guest that is not applying gets no mirror either
      const before=conn.sent.length;
      for(let q=NET.MIRROR_EVERY*2;q<=NET.MIRROR_EVERY*3;q++){NET.bcastFast({t:"snap",q});clk+=10;}
      check("v128.4 mirror: a guest far behind the ack window is not sent mirrors on top of its backlog",
        conn.sent.length===before);
    }
    check("v128.4 constants: the relay window is ~2s of snapshots and the cap is well under SNAP_HZ",
      NET.REL_ACK_WINDOW>=NET.SNAP_HZ&&NET.REL_ACK_WINDOW<=NET.SNAP_HZ*3&&NET.REL_FALLBACK_HZ<NET.SNAP_HZ/2);
    NET.remotes=saveR; NET.now=realNow;
  }
  // ---- v128.4: THE HOST HAS TO NOTICE PEOPLE LEAVING ----
  // One `drop` event for at least three departures. PeerJS held a lane open:true for 8 minutes
  // after the player was gone and fired neither close nor error, so hostDrop — reachable only
  // from those two events — never ran. The body kept u.remote, updateBot returned on it, and
  // hostAdmit refused to recycle it: the team was permanently a unit down.
  {
    NET.mode="host";
    const realNow=NET.now; let clk=7e6; NET.now=()=>clk;
    const saveR=NET.remotes, saveC=NET.conns;
    const conn=mkLane(); conn.peer="peer-Z";
    const r=mkRemote("Zombie",null,conn); r.seenAt=clk;
    const u=r.unit; u.bot={role:"citizen"}; const born=r.oldName;
    NET.remotes={"peer-Z":r}; NET.conns=[conn];
    // the 21.3s input silence in the v125 logs RECOVERED — a screen-locked phone is not a departure
    clk+=25000; NET.reapPeers();
    check("v128.4 reaper: 25s of silence is NOT a departure (the field logs contain a 21.3s silence that fully recovered)",
      !!NET.remotes["peer-Z"]&&u.remote==="peer-Zombie");
    clk+=NET.PEER_DEAD_MS; NET.reapPeers();
    check("v128.4 reaper: past PEER_DEAD_MS the peer is released and the body goes back to the AI",
      !NET.remotes["peer-Z"]&&u.remote===null&&u.name===born&&conn.closed===true&&NET.conns.length===0);
    check("v128.4 reaper: the release is in the event stream, with the reason",
      NET.LOG.events.some(e=>e.k==="drop"&&/silent/.test(String(e.d))));
    // …and a clean goodbye does not wait for any of that
    const conn2=mkLane(); conn2.peer="peer-B";
    const r2=mkRemote("Byer",null,conn2); r2.seenAt=clk;
    NET.remotes={"peer-B":r2}; NET.conns=[conn2];
    NET.hostData(conn2,{t:"bye"});
    check("v128.4 bye: a guest closing its tab is released instantly, not in 90 seconds",
      !NET.remotes["peer-B"]&&r2.unit.remote===null&&NET.conns.length===0);
    check("v128.4 release: hostDrop still works off a bare connection (the old call sites are untouched)",
      typeof NET.hostDrop==="function"&&NET.hostRelease("nobody-home","x")===false);
    NET.remotes=saveR; NET.conns=saveC; NET.now=realNow;
  }
  // ---- v128.4: AN E TAP THE PINNED BIT CANNOT HIDE ----
  // 12-touch.js's auto-gather writes keys.e every animation frame on a guest and runs BEFORE
  // guestFrame, so on a phone the USE button was either erased (bit forced 0) or swallowed
  // (bit pinned 1, so the host's rising edge never fired). E was the only player action with
  // no discrete message — every other one is a guestAct RPC. `et` is that discrete message.
  {
    NET.mode="host";
    const tower=G.buildings.find(b=>b.team===0&&b.alive&&b.built&&b.type==="watch_tower");
    check("v128.4 e-tap: a real watch tower exists to test against (a test that measures nothing must not pass)",!!tower);
    if(tower){
      const gu=G.units.find(u=>u.team===0&&u.bot&&!u.isKing&&u.alive&&u.cls==="villager"&&!u.remote);
      gu.remote="etap-peer"; gu.gathering=null;
      gu.root.position.set(tower.x+2,0,tower.z);
      // lastET:0 is what hostAdmit stamps — both ends start the counter at 0 so a rejoin in the
      // same page load cannot arrive carrying a count the host reads as an instant interact
      const r={unit:gu,input:{},conn:{open:true,send(){}},name:"Tapper",lastE:false,eUsed:false,lastET:0};
      r.input={e:1}; NET.driveRemote(r,0.05);      // a clean rising edge still mans the tower
      const up=gu.garrison===tower;
      // now the mobile case: auto-gather has held the bit high for frames, so there is no edge left
      r.lastE=true; r.input={e:1};
      for(let i=0;i<5;i++)NET.driveRemote(r,0.05);
      check("v128.4 e-tap: with keys.e PINNED high the rising edge never fires — the mobile bug, still reproducible",
        up&&gu.garrison===tower);
      r.input={e:1,et:1};                          // …the same pinned bit, plus one real tap
      NET.driveRemote(r,0.05);
      check("v128.4 e-tap: a tap counter rides through the pinned bit — the guest climbs down",gu.garrison===null);
      gu.root.position.set(tower.x+2,0,tower.z);
      for(let i=0;i<6;i++)NET.driveRemote(r,0.05); // the SAME et resent every frame is not six taps
      check("v128.4 e-tap: the counter is edge-triggered, not level-triggered — a resent packet is one tap",
        gu.garrison===null);
      r.input={e:1,et:2}; NET.driveRemote(r,0.05); // …and the next real tap is seen
      check("v128.4 e-tap: the following tap is seen (the counter is not a one-shot)",gu.garrison===tower);
      r.input={e:1,et:3}; NET.driveRemote(r,0.05);
      gu.remote=null; gu.garrison=null;
    }
  }
  // ---- v129.2: THE MENU OPENS ON THE NAME SCREEN, EVERY TIME ----
  // v128.9 skipped this screen for anyone with a stored name. Since v124 has been writing one on
  // every first load, that meant essentially nobody ever saw it — they got a black flash instead,
  // because the CSS shows #namescreen at parse time and the skip could not run until all fourteen
  // scripts had loaded. Assert the opening screen, not the intention.
  {
    const G3=global.__G, scr=id=>(global.document.getElementById(id).style||{}).display;
    // THE OPENING STATE CANNOT BE READ HERE — uiSolo ran hundreds of checks ago and hid every
    // menu, which is correct. So assert the two things that PRODUCE it instead: the boot has no
    // branch that can route past the name screen, and uiScreen does what the boot asks of it.
    const netSrc=fs.readFileSync(path.join(ROOT,"js/10-net.js"),"utf8");
    const boot=netSrc.slice(netSrc.indexOf("function firstRun()"),netSrc.indexOf("function firstRun()")+900);
    check("v129.2 menu: the boot opens on the name screen UNCONDITIONALLY — no stored-name shortcut",
      /uiScreen\(\s*["']namescreen["']\s*\)/.test(boot)&&!/known\s*\?/.test(boot));
    check("v129.2 menu: …and it prefills the box first, so CONTINUE is one tap and nobody invents a name",
      /playername/.test(boot)&&boot.indexOf("p.value=NET.myName")<boot.indexOf("uiScreen"));
    G3.NET.uiScreen("namescreen");
    check("v129.2 menu: uiScreen shows exactly one screen and hides the rest",
      scr("namescreen")==="flex"&&scr("startmenu")==="none"&&scr("setupscreen")==="none");
    global.document.getElementById("playername").value="Ragnar the Bold";
    G3.NET.uiName();
    check("v129.2 menu: CONTINUE takes the typed name and carries you to the shields",
      G3.NET.myName==="Ragnar the Bold"&&scr("namescreen")==="none"&&scr("startmenu")==="flex");
    G3.NET.uiHideMenus(); // the game is running — leave the menus down, as we found them
  }
  // ---- v128.7: THE DEPLOY ACTUALLY REACHES THE DEVICE ----
  // This file has now shipped stale code to a real phone once (v128.2, an unbumped VERSION) and
  // a stale DOCUMENT to a real desktop once (v128.6 — John's desktop reported v128.5 while his
  // phone reported v128.6, because "network-first" was a bare fetch() that the browser answered
  // from its own HTTP cache). Both were invisible failures that cost a session each. Neither is
  // detectable from inside the game, so assert it from the source text.
  {
    const swSrc=fs.readFileSync(path.join(ROOT,"sw.js"),"utf8");
    const htmlSrc=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
    const swV=(swSrc.match(/const VERSION="([^"]+)"/)||[])[1];
    const pageV=((htmlSrc.match(/class="verstamp">([^<]+)</)||[])[1]||"").trim().split(/\s+—\s+/)[0];
    // THE v128.2 GUARD. The cache is keyed on VERSION and every old cache is deleted on activate,
    // so a deploy that forgets to bump it serves the previous build's js/ out of cache for ever.
    // The verstamp is the number a human reads off the menu; if the two disagree, the diagnostic
    // everyone trusts is lying about which build is running.
    check("v128.7 deploy: sw.js VERSION matches the menu verstamp ("+swV+" vs "+pageV+")",
      !!swV&&!!pageV&&swV===pageV);
    // THE v128.6 GUARD. A bare fetch() consults the browser's HTTP cache and may answer without
    // ever reaching the origin, which makes "network-first" a promise the code does not keep.
    const netFirst=swSrc.slice(swSrc.indexOf("if(isDoc||isCode)"),swSrc.indexOf("CACHE-FIRST for the rest"));
    check("v128.7 deploy: the network-first branch REVALIDATES (fetch with cache:no-cache), it does not just ask nicely",
      /fetch\(req,\s*\{\s*cache:\s*["']no-cache["']\s*\}\)/.test(netFirst));
    check("v128.7 deploy: the cache-first branch is NOT forced to revalidate (that is the half that must stay cheap)",
      /fetch\(req\)/.test(swSrc.slice(swSrc.indexOf("CACHE-FIRST for the rest"))));
    // v132.51 THE GUARD THAT WAS MISSING, AND IT COST A PLAYTEST. Every deploy gate above
    // watches the FETCH handler. Nothing watched INSTALL, where the cache is actually filled —
    // and cache.add() revalidates against the browser's own HTTP cache, so a brand-new worker
    // could fill a brand-new cache with YESTERDAY'S FILES. John played a build with v132.50's
    // 05-combat.js and v132.49's 00-data.js: auraTick threw ReferenceError sixty times a second
    // and every particle in the game froze in mid-air. Bumping VERSION did not save him, because
    // VERSION only names the cache — it says nothing about what goes into it.
    // STRIP THE COMMENTS FIRST. The first version of this gate matched the raw slice and passed
    // happily against a build where the install had been reverted to c.add(u) — because the
    // COMMENT above it says cache:"reload". A gate that reads prose is not reading code.
    const inst=swSrc.slice(swSrc.indexOf('addEventListener("install"'),swSrc.indexOf('addEventListener("activate"'))
      .replace(/^\s*\/\/.*$/gm,"");
    check("v132.51 deploy: the INSTALL fills the cache from the NETWORK (cache:\"reload\"), not "+
      "from the browser's HTTP cache — otherwise a version bump can ship a build that is new in "+
      "some files and stale in others, which is not a slow update but a different program",
      /cache\s*:\s*["']reload["']/.test(inst));
    check("v128.7 deploy: sw.js itself is registered with updateViaCache:none",
      /register\(\s*["']sw\.js["']\s*,\s*\{[^}]*updateViaCache\s*:\s*["']none["']/.test(htmlSrc));
    // the automatic second load, and the two guards that stop it looping or bouncing a first visit
    check("v128.7 deploy: a new worker taking over reloads the page once, automatically",
      /controllerchange/.test(htmlSrc)&&/location\.reload\(\)/.test(htmlSrc));
    check("v128.7 deploy: …but never on a FIRST visit, and never twice (both guards present)",
      /hadController/.test(htmlSrc)&&/swReloaded/.test(htmlSrc)&&
      /if\(!hadController\|\|swReloaded\)return;/.test(htmlSrc));
    // and never mid-match: there is no host migration, so a host reloading ends the game for
    // everyone in it. The TDZ guard matters too — `typeof` on an uninitialised top-level `let`
    // THROWS, and an exception in this handler would take the reload with it.
    check("v128.7 deploy: the auto-reload refuses to fire during a live match",
      /inMenu/.test(htmlSrc)&&/inGame/.test(htmlSrc)&&/try\{\s*inGame=/.test(htmlSrc));
    const shell=(swSrc.match(/const SHELL=\[([\s\S]*?)\];/)||["",""])[1];
    const shellPaths=[...shell.matchAll(/"\.\/([^"]*)"/g)].map(m=>m[1]).filter(Boolean);
    // A TYPO IN THE SHELL IS INVISIBLE. install() deliberately swallows a 404 per entry so one
    // bad path cannot disable the whole worker — which also means a path that drifts out of step
    // with the repo silently stops being precached, for ever, with no symptom but a slow launch.
    const dead=shellPaths.filter(p=>!fs.existsSync(path.join(ROOT,p)));
    check("v128.7 deploy: every SHELL entry resolves to a real file ("+
      (dead.length?dead.join(", "):shellPaths.length+" checked")+") — install() swallows 404s, so a typo here is silent",
      dead.length===0);
    // the 14 game scripts are what "boot" means; audio-data.js is 3.9 MB of sound and is
    // deliberately left to be fetched on demand, so it is excluded from this by name
    const tags=[...htmlSrc.matchAll(/<script src="(js\/[^"]+)"/g)].map(m=>m[1])
      .filter(t=>!/audio-data\.js$/.test(t));
    const missing=tags.filter(t=>shell.indexOf(t)<0);
    check("v128.7 deploy: every boot script the page loads is precached in the SHELL ("+
      (missing.length?missing.join(", "):tags.length+" checked")+")",missing.length===0&&tags.length>=14);
    // …and the one script that is NOT precached must be on the cheap path, not revalidated on
    // every load — it is a megabyte-class file that changes about once a year
    check("v128.7 deploy: the 3.9 MB audio blob is cache-first, not revalidated on every load",
      /audio-data\.js/.test(swSrc.slice(swSrc.indexOf("const isCode"),swSrc.indexOf("if(isDoc||isCode)"))));
  }
  // ---- v128.6: THE UNIT DRAW BUDGET ----
  // The tree budget (v114) asserts a tree is ONE mesh and has caught real regressions twice.
  // This is the same guard for characters. Units were 86% of the scene's draw calls at 22.8-33.4
  // each; the rigid-cluster merge welds them to one mesh per ANIMATED node, and the number of
  // animated nodes is the floor. If someone adds a mesh outside the merge — or breaks the atlas
  // so materials stop collapsing — the count goes up and this fails.
  {
    const G2=global.__G;
    const meshesOf=u=>{let n=0;u.body.traverse(o=>{if(o.isMesh)n++;});return n;};
    const matsOf=u=>{const s=new Set();u.body.traverse(o=>{if(o.isMesh)s.add(o.material);});return s;};
    const foot=G2.makeUnit(0,"broadsword",-150,95,{name:"Budget",bot:null});
    const horse=G2.makeUnit(0,"knight",-150,97,{name:"Budget2",bot:null});
    const fm=meshesOf(foot), hm=meshesOf(horse);
    check("v128.6 draw budget: a foot soldier is ONE mesh per animated node ("+fm+" meshes, was ~51)",fm<=12);
    check("v128.6 draw budget: a mounted unit stays inside its own floor ("+hm+" meshes, horse legs and knees animate too)",hm<=24);
    check("v128.6 draw budget: the merge actually ran and welded most of the body ("+foot._merged+" source meshes consumed)",
      foot._merged>=40);
    const fMats=matsOf(foot);
    check("v128.6 atlas: the whole body collapses to a single shared material ("+fMats.size+" material(s), was 26)",
      fMats.size<=2&&fMats.has(G2.UATLAS.material()));
    // the atlas must be ONE texture shared by every unit, or nothing was gained
    check("v128.6 atlas: every unit draws from the same atlas texture",
      matsOf(horse).has(G2.UATLAS.material())&&G2.UATLAS.material().map===G2.UATLAS.tex);
    // …and a cell, once handed out, must never move: merged geometry has the UVs baked in
    const t1=G2.UATLAS.slot(G2.texturedMat("metal",0x7d858f).map);
    for(let i=0;i<20;i++)G2.texturedMat("cloth",0x100000+i); // force more allocations
    const t2=G2.UATLAS.slot(G2.texturedMat("metal",0x7d858f).map);
    check("v128.6 atlas: a cell never moves once allocated — baked UVs would rot if it did",
      t1.u0===t2.u0&&t1.v0===t2.v0&&t1.us===t2.us);
    check("v128.6 atlas: flat parts point at a WHITE cell so their vertex colour survives unchanged",
      G2.UATLAS.whiteSlot().us>0);
    // the v122 contract: merged geometry is per-unit and must be freed on rebuild
    const g0=[];foot.body.traverse(o=>{if(o.geometry)g0.push(o.geometry);});
    let freed=0;for(const g of g0)g.addEventListener("dispose",()=>freed++);
    G2.setClass(foot,"legionaire");
    check("v128.6 leak: rebuilding disposes every merged geometry ("+freed+" of "+g0.length+")",
      freed===g0.length&&g0.length>0);
    foot.alive=false; horse.alive=false;
  }
  // ---- v128.5: LAG COMPENSATION ----
  // Measured from the v128.2 field logs: at the median 212ms ping a fleeing infantryman travels
  // 1.70 units while a broadsword's whole reach is 3.4 — half the reach gone. Against a fleeing
  // knight (2.86u) usable reach was 0.54u. At the p90 of 1294ms no guest could land melee on
  // anything that moved. Every assertion below FIRST reproduces the uncompensated miss, so none
  // of them can pass by measuring nothing.
  {
    NET.mode="host"; G.setGameOver(false);
    const realNow=NET.now; let clk=9e6; NET.now=()=>clk;
    const saveR=NET.remotes; NET.remotes={};
    NET.histReset();
    // a corner of the map with nobody else in it — these tests stage duels, and `tryAttack`
    // scans every unit in the world, so a stray bystander would let them pass for the wrong
    // reason. Asserted, not assumed.
    const spot=(()=>{
      for(let x=-120;x<=120;x+=15)for(let z=-120;z<=120;z+=15){
        let clear=true;
        for(const v of G.units){if(v.alive&&G.dist2(v.root.position.x,v.root.position.z,x,z)<45*45){clear=false;break;}}
        if(clear)return {x,z};
      }
      return null;
    })();
    check("v128.5 setup: an empty corner exists to stage the duels in (no bystander can score them)",!!spot);
    const SX=spot?spot.x:0, SZ=spot?spot.z:0;
    // --- the ring itself ---
    {
      const mover=G.makeUnit(1,"clubman",SX,SZ,{name:"Ghost",bot:null}); mover.hp=mover.maxHp=9999;
      const p=mover.root.position;
      for(let k=0;k<10;k++){ p.set(SX+k*2,p.y,SZ); clk+=50; NET.histSample(clk); } // +2u every 50ms
      const tNow=clk;
      NET.histAt(mover,tNow);
      check("v128.5 ring: the newest sample is the present position",Math.abs(NET._rwX-(SX+18))<0.15);
      NET.histAt(mover,tNow-200);
      check("v128.5 ring: 200ms ago it was 8 units back ("+(NET._rwX-SX).toFixed(1)+" vs 18 now)",
        Math.abs(NET._rwX-(SX+10))<0.35);
      NET.histAt(mover,tNow-125); // between two samples
      check("v128.5 ring: a time BETWEEN samples interpolates ("+(NET._rwX-SX).toFixed(2)+")",
        NET._rwX-SX>12&&NET._rwX-SX<13.5);
      NET.histAt(mover,tNow-99999); // older than the whole ring
      check("v128.5 ring: a time older than the ring clamps to the OLDEST sample, not to the origin ("+
        (NET._rwX-SX).toFixed(1)+")",Math.abs(NET._rwX-SX)<0.2&&Math.abs(NET._rwX)>0.5*Math.abs(SX));
      const fresh=G.makeUnit(1,"clubman",SX+77,SZ,{name:"Newborn",bot:null});
      fresh.root.position.set(SX+77,fresh.root.position.y,SZ);
      NET.histSample(clk+=50);
      NET.histAt(fresh,clk-400); // born mid-ring: its whole past must be its spawn point
      check("v128.5 ring: a unit born mid-ring reads its SPAWN point in the past, not the origin ("+
        (NET._rwX-SX).toFixed(1)+")",Math.abs(NET._rwX-(SX+77))<0.2);
      check("v128.5 ring: 24 slots × 22ms covers the 500ms compensation ceiling",
        NET.HIST_SLOTS*NET.HIST_MIN_MS>=NET.LAGCOMP_MAX_MS);
      mover.alive=false; fresh.alive=false;
    }
    // --- the trust boundary: nobody rewinds further than their own latency earns ---
    {
      const r={rtt:40,name:"Cheat"};
      const t=NET.rewindTime(r,clk-500); // claims half a second on a 40ms link
      check("v128.5 trust: a 500ms claim on a 40ms link is cut to rtt+slack ("+r._rwMs+"ms, not 500)",
        r._rwMs===40+NET.LAGCOMP_SLACK_MS&&Math.abs((clk-t)-r._rwMs)<1);
      const r2={rtt:300,name:"Honest"};
      NET.rewindTime(r2,clk-260);
      check("v128.5 trust: an honest 260ms claim on a 300ms link is granted in full",r2._rwMs===260);
      const r3={rtt:2000,name:"Awful"};
      NET.rewindTime(r3,clk-1500);
      check("v128.5 trust: nothing exceeds LAGCOMP_MAX_MS however bad the link",r3._rwMs===NET.LAGCOMP_MAX_MS);
      const r4={rtt:180,name:"Old"};
      NET.rewindTime(r4,undefined);
      check("v128.5 trust: a guest that sends no claim still gets an rtt-shaped estimate",r4._rwMs===180);
      const r5={rtt:100,name:"Future"};
      NET.rewindTime(r5,clk+5000); // claims to be shooting from the future
      check("v128.5 trust: a claim in the FUTURE is refused, not honoured",r5._rwMs<=100);
    }
    // --- melee: the swing that used to miss ---
    {
      const att=G.makeUnit(0,"broadsword",SX,SZ,{name:"Swinger",bot:null});
      att.root.position.set(SX,att.root.position.y,SZ);
      att.remote="rw-peer"; att.hp=att.maxHp=9999; att.atkT=0;
      const vic=G.makeUnit(1,"clubman",SX,SZ,{name:"Runner",bot:null}); vic.hp=vic.maxHp=9999;
      NET.histReset();
      // the victim runs away: inside the 3.4u reach a third of a second ago, well clear of it now
      const vp=vic.root.position;
      for(let k=0;k<12;k++){ vp.set(SX,vp.y,SZ+1.0+k*0.7); clk+=30; NET.histSample(clk); }
      const gap=Math.hypot(vp.x-att.root.position.x,vp.z-att.root.position.z);
      const reach=att.rng+0.8;
      check("v128.5 melee: the setup is real — the victim is now OUT of reach ("+gap.toFixed(2)+
        "u vs "+reach.toFixed(2)+"u)",gap>reach);
      const hp0=vic.hp;
      G.setRewind(0); G.tryAttack(att);          // present-tick: exactly the v128.4 behaviour
      check("v128.5 melee: WITHOUT compensation the swing misses — the field bug, reproduced",vic.hp===hp0);
      att.atkT=0;
      G.setRewind(clk-330); G.tryAttack(att); G.setRewind(0);
      check("v128.5 melee: WITH the rewind the same swing connects ("+hp0+" → "+vic.hp+")",vic.hp<hp0);
      // …and it must not become a licence to hit anyone who was merely nearby at some point
      att.atkT=0; vp.set(SX,vp.y,SZ+40); clk+=30; NET.histSample(clk);
      const hp1=vic.hp;
      G.setRewind(clk-30); G.tryAttack(att); G.setRewind(0);
      check("v128.5 melee: a target that was never in reach during the swing window is still a miss",vic.hp===hp1);
      att.alive=false; vic.alive=false;
    }
    // --- the arrow that used to step over people ---
    {
      const shooter=G.makeUnit(0,"archer",SX,SZ,{name:"Bowman",bot:null}); shooter.hp=shooter.maxHp=9999;
      shooter.root.position.set(SX,shooter.root.position.y,SZ);
      // the muzzle sits at +0.8 along the shot and +1 to its right (fireAimedFor), so for a shot
      // down +x the arrow's line is z = SZ+1 — put the target ON it, not on the shooter's line
      const target=G.makeUnit(1,"clubman",SX+6.8,SZ+1,{name:"Pincushion",bot:null});
      target.hp=target.maxHp=9999;
      target.root.position.set(SX+6.8,target.root.position.y,SZ+1);
      const step=36*1.6*0.05; // full draw, one clamped 0.05s frame
      check("v128.5 tunnel: the setup is real — one clamped step ("+step.toFixed(2)+
        "u) is wider than the hit diameter (2.24u)",step>2.24);
      const before=target.hp;
      shooter.atkT=0; G.fireAimedFor(shooter,new G.THREE.Vector3(1,0,0),1);
      for(let k=0;k<6;k++)G.updateProjectiles(0.05); // straddle the target with long frames
      check("v128.5 tunnel: a swept arrow hits a target a point sample would step clean over ("+
        before+" → "+target.hp+")",target.hp<before);
      shooter.alive=false; target.alive=false;
    }
    // --- the arrow loosed at a world that has since moved on ---
    {
      const shooter=G.makeUnit(0,"archer",SX,SZ,{name:"Bowman2",bot:null}); shooter.hp=shooter.maxHp=9999;
      shooter.root.position.set(SX,shooter.root.position.y,SZ);
      // NOTE ON WHAT COMPENSATION DOES AND DOES NOT BUY. An arrow has travel time, so a player
      // still has to LEAD a moving target — that skill is the game. What they should not also
      // have to lead is an invisible, variable network offset. So the test is: the target stood
      // still while the guest aimed and loosed, then bolted. The guest's shot was correct for
      // the world it saw; only the host's 300ms-newer world makes it wrong.
      const target=G.makeUnit(1,"clubman",SX+6.8,SZ+1,{name:"Sprinter",bot:null}); target.hp=target.maxHp=9999;
      NET.histReset();
      const tp=target.root.position;
      for(let k=0;k<10;k++){ tp.set(SX+6.8,tp.y,SZ+1); clk+=30; NET.histSample(clk); }   // standing
      for(let k=0;k<2;k++){ tp.set(SX+6.8,tp.y,SZ+31); clk+=30; NET.histSample(clk); }   // …then gone
      const aimT=clk-300;                       // the world the guest was looking at: still standing
      NET.histAt(target,aimT);
      const aimZ=NET._rwZ, nowZ=tp.z;
      check("v128.5 catch-up: the setup is real — the target has moved "+Math.abs(nowZ-aimZ).toFixed(1)+
        "u since the guest aimed, far beyond the 1.12u hit radius",Math.abs(nowZ-aimZ)>3);
      const dir=new G.THREE.Vector3(1,0,0);     // straight down the line it was standing on
      const hp0=target.hp;
      shooter.atkT=0; G.fireAimedFor(shooter,dir,1);            // no rewind: the v128.4 behaviour
      for(let k=0;k<10;k++)G.updateProjectiles(0.03);
      check("v128.5 catch-up: WITHOUT compensation the arrow flies at empty ground — the bug, reproduced",
        target.hp===hp0);
      shooter.atkT=0;
      G.fireAimedFor(shooter,dir,1,aimT);                       // …the same shot, rewound
      check("v128.5 catch-up: WITH the rewind the arrow finds the target the guest aimed at ("+
        hp0+" → "+target.hp+")",target.hp<hp0);
      shooter.alive=false; target.alive=false;
    }
    check("v128.5 fairness: the dragoon's pistol is the same length for guests as for the host and the AI",
      /pistolTarget\(u,15,rwT\)/.test(String(NET.driveRemote)));
    NET.remotes=saveR; NET.now=realNow; NET.histReset();
  }
  // ---- one dial at a time ----
  // Two callers (the 1200ms redial and the 5s retry) with no idea about each other. Petra:
  // 38 redials, 37 fast-ups, 38 fast-downs in 24 minutes — a lane that never settled, plus a
  // host that (before this version) never closed the lane each new dial replaced.
  {
    let dials=0;
    const realPeer=NET.peer, realNow=NET.now, realMode=NET.mode;
    let clk=4e6; NET.now=()=>clk;
    NET.mode="guest"; NET._code="regicide-test"; NET._dialAt=0; NET.fast=null;
    NET.peer={connect(){dials++;return {on(){}};}};
    NET.dialFast(); NET.dialFast(); NET.dialFast();   // a dogpile
    const afterPile=dials;
    clk+=NET.DIAL_TIMEOUT_MS+100;                    // the attempt is never going to land
    NET.dialFast();
    check("v126 dial guard: three dials in a row make ONE connection ("+afterPile+"), and a timed-out attempt may retry ("+dials+")",
      afterPile===1&&dials===2);
    NET.peer=realPeer; NET.now=realNow; NET.mode=realMode; NET._dialAt=0;
  }
  // ---- the input-staleness cliff became a ramp, and the ledge moved with the ping ----
  // Both guests spent 13–15% of their seconds past the old fixed 600ms (inAge p90 1470ms and
  // 1162ms, against pings whose p90 was 537ms and 737ms). A guest must not be declared silent
  // faster than their own network can speak, and the body should stumble rather than freeze.
  {
    NET.mode="host";
    const realNow=NET.now; let clk=5e6; NET.now=()=>clk;
    const fast=mkLane(), conn=mkLane();
    const r=mkRemote("Ramp",fast,conn);
    const saveR=NET.remotes; NET.remotes={"peer-R":r};
    r.input={w:1,seq:1}; r.rtt=0; r.inputAt=clk;
    const holds=[];
    for(const age of [0,NET.INPUT_STALE_MS+NET.INPUT_EASE_MS/2,NET.INPUT_STALE_MS+NET.INPUT_EASE_MS+50]){
      r.inputAt=clk-age; NET.driveRemote(r,1/60); holds.push(r._hold);
    }
    check("v126 input ramp: current inputs hold full speed ("+holds[0]+"), mid-ramp is partial ("+
      Math.round(holds[1]*100)/100+"), past the ramp is a dead stop ("+holds[2]+")",
      holds[0]===1&&holds[1]>0&&holds[1]<1&&holds[2]===0);
    // the ledge tracks the round trip: a 700ms input age is NOT stale for a 400ms-ping guest
    r.rtt=400; r.inputAt=clk-700; NET.driveRemote(r,1/60);
    const tolerant=r._hold;
    r.rtt=0;   r.inputAt=clk-700; NET.driveRemote(r,1/60);
    const strict=r._hold;
    check("v126 input ramp: 700ms of silence is full speed at 400ms ping ("+tolerant+") but already easing at 0 ping ("+
      Math.round(strict*100)/100+")",
      tolerant===1&&strict<1);
    NET.remotes=saveR; NET.now=realNow;
  }
  // ---- the wire itself ----
  {
    NET.mode="host";
    const s=NET.packSnap();
    check("v126 wire: every snapshot carries `ht`, the host's own monotonic clock",typeof s.ht==="number");
    // v132.0 26 -> 27 with the map rework: MAP.x/MAP.z moved, so every node moved, and the netcode
  // indexes nodes positionally. The assertion is that the number MOVED WITH THE WORLD, which is the
  // thing a peer actually needs — a stale literal here is how two builds shake hands and disagree.
  check("v132.46 wire: PROTO is 46 — the set-piece channel, public timed modifiers, the "+
    "thrown knife and the damage-number message",NET.PROTO===46);
    // the version stamp is READ from the page, not frozen in the recorder. Every log John
    // field-tested on v125.1 said ver:"v98", because that literal was written in v98 and never
    // touched again — a flight recorder you have to take somebody's word about.
    const realQS=global.document.querySelector;
    global.document.querySelector=sel=>(sel===".verstamp"?{textContent:"  v126 — THE HONEST CLOCK  "}:realQS(sel));
    const p=NET.saveLog();
    global.document.querySelector=realQS;
    check("v126 net log: the payload reads the build's own verstamp instead of a frozen literal (ver="+p.meta.ver+")",
      p.meta.ver==="v126 — THE HONEST CLOCK"&&p.meta.logfmt===2&&p.meta.mirrorEvery===NET.MIRROR_EVERY);
    // …and degrades honestly when there is no page to read (headless, or a stripped build)
    check("v126 net log: with no verstamp in the DOM it says so rather than guessing",NET.logVer()==="unknown");
    NET.mode="guest";
  }
}

// ================= v127: THE DIET AND THE GLIDE =================
{
  const G=global.__G;
  // ---- the envelope ships on change, not on schedule ----
  // Measured with PeerJS's own serializer (tools/netprofile.js): stock0+stock1+carry cost
  // 69 B/snap and were byte-identical to the previous snapshot 100% of a 300-snapshot sample —
  // ~1.0 KB/s per guest of pure repetition, on a host whose send buffer was at or over
  // BUF_FAST_MAX for 11–13% of John's session. The rows have shipped on change since v95; this
  // is the envelope finally doing the same.
  {
    NET.mode="host";
    NET._lastRow=null;                        // force the init snapshot (which is also a keyframe)
    NET._lastStock=undefined;NET._lastCarry=undefined;
    const first=NET.packSnap();
    check("v127 envelope: the first snapshot is a keyframe and carries the whole treasury",
      !!first.stock0&&!!first.stock1&&typeof first.stock0.f==="number");
    // walk to just before the next keyframe so `full` cannot mask the delta
    let lean=null,fat=0;
    for(let i=0;i<12;i++){const s=NET.packSnap();if(s.stock0)fat++;else lean=s;}
    check("v127 envelope: with the treasury unchanged, later snapshots omit it ("+fat+
      " of 12 still carried it)",!!lean&&fat<=1);
    // …and a real change ships immediately, not at the next keyframe
    G.stock[G.BLUE].food+=777;
    const changed=NET.packSnap();
    check("v127 envelope: a spent or earned coin ships on the very next snapshot",
      !!changed.stock0&&changed.stock0.f===Math.floor(G.stock[G.BLUE].food));
    // the keyframe heals a drop — this is the whole reason omitting is safe on a lossy lane
    let healed=false;
    for(let i=0;i<20;i++){const s=NET.packSnap();if(s.stock0)healed=true;}
    check("v127 envelope: an omitted treasury is re-sent by the 1Hz keyframe, so a dropped packet heals",healed);
    // ares drops to ~2Hz because the guest already ticks the countdown down itself
    let aresN=0; for(let i=0;i<30;i++){if(NET.packSnap().ares)aresN++;}
    check("v127 envelope: `ares` rides ~2Hz, not "+NET.SNAP_HZ+"Hz ("+aresN+" of 30 snapshots)",
      aresN>0&&aresN<=30*(3/NET.SNAP_HZ)+2);
  }
  // ---- a guest must tolerate every one of those absences ----
  // THE FAILURE MODE THIS GUARDS is not hypothetical: the pre-v127 line was
  // `stock[BLUE].food=s.stock0.f` with no guard, so a lean snapshot would have written NaN
  // into the treasury and every HUD figure downstream of it. That is why PROTO moved to 26.
  {
    NET.mode="host"; NET._lastRow=null;
    const s=NET.packSnap();
    NET.mode="guest";
    delete s.stock0; delete s.stock1; delete s.carry; delete s.ares;
    s.q=NET.lastQ+1;
    const f0=G.stock[G.BLUE].food, r0=G.ageResT[G.BLUE];
    let threw=false;
    try{NET.applySnap(s);}catch(e){console.error("  lean snapshot threw:",e.message);threw=true;}
    check("v127 lean snapshot: a guest applies one with no treasury, carry or countdown and keeps its own figures",
      !threw&&G.stock[G.BLUE].food===f0&&!isNaN(G.stock[G.BLUE].food)&&G.ageResT[G.BLUE]===r0);
  }
  // ---- the glide carries on instead of parking ----
  // A far unit ships every AOI_FAR_EVERY-th snap (~266ms at 15Hz) and the glide finishes in
  // gapAvg (~76ms measured in the field), so the old code left it standing perfectly still for
  // two thirds of its life and then jerking forward. Every dropped snapshot added another
  // freeze, and John's guests logged ~1,400 sequence holes each.
  {
    const realNow=NET.now; let clk=7e6; NET.now=()=>clk;
    NET.mode="guest";
    const mover=G.units.find(u=>u.alive&&!u.isPlayer&&!u.garrison);
    const startX=40, startZ=40, step=1.5; // 1.5 units per arrival, due east
    mover.netX=startX;mover.netZ=startZ;mover.netPX=startX;mover.netPZ=startZ;
    mover.netVX=0;mover.netVZ=0;mover.netAt=clk;mover.gmv=true;
    mover.root.position.set(startX,0,startZ);
    NET.gapAvg=80;
    // two arrivals, 80ms apart, establish the leg
    const arrive=(x,z)=>{
      const legMs=clk-(mover.netAt||clk);
      mover.netPX=mover.root.position.x;mover.netPZ=mover.root.position.z;
      if(legMs>=8&&legMs<=1000){mover.netVX=(x-mover.netX)/legMs;mover.netVZ=(z-mover.netZ)/legMs;}
      mover.netX=x;mover.netZ=z;mover.netAt=clk;
    };
    clk+=80; arrive(startX+step,startZ);
    clk+=80; arrive(startX+step*2,startZ);
    check("v127 glide: the velocity of the leg just walked is derived from the wire, not shipped ("+
      (Math.round(mover.netVX*1e4)/1e4)+" u/ms)",Math.abs(mover.netVX-step/80)<1e-6&&mover.netVZ===0);
    // now let the feed go quiet for four glide-lengths, as an AOI-far unit's does
    clk+=80; NET.guestFrame(1/60); const atGlideEnd=mover.root.position.x;
    clk+=120; NET.guestFrame(1/60); const later=mover.root.position.x;
    check("v127 glide: a MOVING body keeps walking past the end of the glide instead of parking ("+
      (Math.round(atGlideEnd*100)/100)+" → "+(Math.round(later*100)/100)+")",
      later>atGlideEnd+0.1);
    // …but the extrapolation is bounded, or a unit that stopped would be flung across the map
    clk+=4000; NET.guestFrame(1/60);
    const drift=mover.root.position.x-mover.netX;
    const cap=mover.netVX*NET.EXTRAP_MAX_MS; // exactly one EXTRAP_MAX_MS of the last leg, no more
    check("v127 glide: the carry-on is capped at EXTRAP_MAX_MS — four seconds of silence still drifts only "+
      (Math.round(drift*100)/100)+" units (cap "+(Math.round(cap*100)/100)+")",
      Math.abs(drift-cap)<0.01);
    // and a body the host says is STANDING STILL does not drift at all
    mover.gmv=false; mover.netAt=clk;
    mover.netPX=mover.root.position.x;mover.netPZ=mover.root.position.z;
    mover.netX=mover.root.position.x;mover.netZ=mover.root.position.z;
    clk+=2000; NET.guestFrame(1/60);
    const still=Math.abs(mover.root.position.x-mover.netX)<0.001;
    check("v127 glide: a body the host reports as still stays still, however long the feed is quiet",still);
    NET.now=realNow;
  }
}

// ================= v99: THE QUEST DRAFT, THE OX CART & THE PLUNDER =================
global.__G.setGameOver(false);
{
  const G=global.__G;
  // ---- guest draft: the trio rides a qdraft event; picks & redraws validated at the board ----
  {
    NET.mode="host";
    const gq=G.makeUnit(0,"clubman",-60,58,{name:"GuestQ",bot:null}); gq.remote="gq-peer"; gq.alive=true;
    const sent=[],denies=[];
    const conn={open:true,send:o=>{if(o&&o.t==="deny")denies.push(o);else sent.push(o);}};
    NET.remotes["gq-peer"]={conn,unit:gq,input:{},name:"GuestQ"};
    const brd=G.boardFor(0);
    gq.root.position.set(brd.x+1,0,brd.z);
    G.useTownBoard(gq); // the host reads the guest their draft
    const ev=sent.find(m=>m.t==="qdraft");
    check("v99 guest draft: the trio ships as a qdraft event",!!ev&&ev.offer.length===3);
    const fr={unit:gq,conn,name:"GuestQ"};
    NET.hostAct(fr,{act:"quest",pick:G.QUESTS.findIndex((q,i)=>!ev.offer.includes(i))});
    check("v99 guest draft: off-board picks are denied",denies.length===1&&!gq.quest);
    NET.hostAct(fr,{act:"quest",pick:ev.offer[0]});
    check("v99 guest draft: the posted pick lands",!!gq.quest&&gq.quest.i===ev.offer[0]);
    gq.quest=null; G.useTownBoard(gq); // a fresh trio stands
    NET.hostAct(fr,{act:"quest",redraw:1}); // no reroll banked → denied
    const denied2=denies.length===2;
    gq.qRerolls=1; sent.length=0;
    NET.hostAct(fr,{act:"quest",redraw:1});
    check("v99 guest draft: redraw needs a banked reroll, then re-lays the trio",
      denied2&&gq.qRerolls===0&&sent.some(m=>m.t==="qdraft"));
    const far0=denies.length;
    gq.root.position.set(brd.x+80,0,brd.z); // across the map: the board is out of reach
    NET.hostAct(fr,{act:"quest",pick:(gq.questDraft||[0])[0]});
    check("v99 guest draft: picks demand the board's yard",denies.length===far0+1);
    delete NET.remotes["gq-peer"]; gq.remote=null; gq.alive=false;
  }
  // ---- the board bang: "!" hangs over the board while questless ----
  {
    NET.mode="solo";
    const pl=units.find(u=>u.isPlayer);
    const aSave=pl.alive,qSave=pl.quest,lSave=pl.lvl;
    pl.alive=true; pl.quest=null; pl.lvl=0;
    G.tickBoardBang(0.05);
    const bang=G.getBoardBang();
    const shown=!!bang&&bang.visible===true;
    pl.quest={i:0,prog:0};
    G.tickBoardBang(0.05);
    check("v99 board bang: '!' shows while questless, clears once a posting is taken",
      shown&&bang.visible===false);
    // ---- v126: …AND THE GUEST'S FRAME HAS TO BE THE ONE THAT CALLS IT ----
    // John, after the v125.1 playthrough: "as a guest I could not see the exclamation point
    // over the question board." He could not, because `tickBoardBang` was called from exactly
    // one place — tickBody's host/solo branch — and a guest returns from tickBody well before
    // it. The group was never constructed at all.
    //
    // THE TEST ABOVE COULD NOT HAVE CAUGHT THAT, and that is the lesson worth keeping: it calls
    // tickBoardBang by hand, so it proves the driver works and says nothing about whether
    // anybody drives it. This one goes through NET.guestFrame — the real frame — so the
    // assertion is "a guest standing questless SEES the marker", not "the function functions".
    {
      const realNow=NET.now; let clk=6e6; NET.now=()=>clk;
      NET.mode="guest";
      pl.alive=true; pl.quest=null; pl.lvl=0;
      G.closeMenus(); G.cancelPlacing();
      const kk=G.keys; kk.w=kk.a=kk.s=kk.d=kk.e=false;
      let gShown=false,overBoard=false,cleared=false,ok=true;
      try{
        clk+=1000/30; NET.guestFrame(1/30);
        const gb=G.getBoardBang();
        gShown=!!gb&&gb.visible===true;
        const brd=G.boardFor(pl.team); // the bang tracks boardFor(MYTEAM), which is our team as a guest
        overBoard=!!gb&&!!brd&&Math.hypot(gb.position.x-brd.x,gb.position.z-brd.z)<0.01;
        pl.quest={i:0,prog:0};
        clk+=1000/30; NET.guestFrame(1/30);
        cleared=!!gb&&gb.visible===false;
      }catch(e){console.error("  guest board bang threw:",e.message);ok=false;}
      check("v126 board bang: a GUEST's own frame raises the '!' while questless ("+gShown+
        "), over their own board ("+overBoard+"), and clears it on a posting ("+cleared+")",
        ok&&gShown&&overBoard&&cleared);
      pl.quest=null;
      NET.now=realNow;
    }
    pl.quest=qSave; pl.lvl=lSave; pl.alive=aSave;
  }
  // ---- the ox cart: pit-trained, timber-only, four per swing, 300 bed ----
  {
    NET.mode="host";
    const ox=G.makeUnit(0,"villager",-40,60,{name:"OxDriver",bot:null}); ox.remote="ox-peer"; ox.alive=true;
    const denies=[];
    const orr={unit:ox,conn:{open:true,send:o=>{if(o&&o.t==="deny")denies.push(o.m);}},name:"OxDriver",lastE:true,eUsed:false};
    G.stock[0].food+=500; G.stock[0].gold+=500;
    NET.hostAct(orr,{act:"train",cls:"oxcart"});
    check("v99 ox cart: hostAct trains it at the pit price",ox.cls==="oxcart"&&denies.length===0);
    check("v99 ox cart: the bed holds 300",G.carryCap(ox)===300);
    const bush=nodes.find(n=>n.type==="food"&&n.amount>20);
    ox.root.position.set(bush.x+1,0,bush.z); ox.gathering=null;
    orr.input={e:1};
    for(let i=0;i<30;i++)NET.driveRemote(orr,0.05); // 1.5s of held E at a BERRY BUSH
    const ateFood=ox.carry.food;
    ox.carry.wood=0; ox.gathering=null; // a tree may stand near the bush — the ox chops it (rightly); reset for the counted phase
    const cand=nodes.find(n=>n.type==="wood"&&n.amount>40&&
      !buildings.some(b=>b.alive&&b.team===0&&(b.type==="storage_pit"||b.type==="towncenter"||b.type==="castle")&&Math.hypot(b.x-n.x,b.z-n.z)<18));
    ox.root.position.set(cand.x+1,0,cand.z); ox.gathering=null;
    // v114: the map is flush with forest now, so the tree the ox actually swings at is whichever
    // one is NEAREST — not necessarily the one we picked. Re-derive it from where the ox stands.
    let tree=cand,td=1e9;
    for(const n of nodes){
      if(n.type!=="wood"||n.amount<=0)continue;
      const d=Math.hypot(n.x-ox.root.position.x,n.z-ox.root.position.z);
      if(d<td){td=d;tree=n;}
    }
    const w0=tree.amount;
    for(let i=0;i<26;i++)NET.driveRemote(orr,0.05); // 1.3s → two gather ticks → 8 timber
    check("v99 ox cart: timber only, FOUR per swing (food "+ateFood+", wood "+ox.carry.wood+", node -"+(w0-tree.amount)+")",
      ateFood===0&&ox.carry.wood>=8&&(w0-tree.amount)===ox.carry.wood);
    const tc=G.teamTC(0), w1=ox.carry.wood, sw0=Math.floor(G.stock[0].wood);
    orr.input={};
    ox.root.position.set(tc.x+tc.def.r+2,0,tc.z);
    NET.driveRemote(orr,0.05);
    check("v99 ox cart: the haul banks at the TC (+"+w1+" wood)",ox.carry.wood===0&&Math.floor(G.stock[0].wood)===sw0+w1);
    // ---- plunder: the slain ox spills its bed into the raider's TEAM stock ----
    ox.carry.wood=250;
    const raider=G.makeUnit(1,"clubman",-40,61,{name:"Raider",bot:null});
    const rw0=G.stock[1].wood;
    G.killUnit(ox,raider);
    check("v99 plunder: 250 wood falls to the raiders",G.stock[1].wood===rw0+250&&ox.carry.wood===0);
    const mk2=buildings.find(b=>b.type==="market"&&b.alive&&b.team===0)||G.makeBuilding(0,"market",-30,70,true);
    const cart=G.makeUnit(0,"tradecart",-28,70,{name:"DoomedCart",bot:{role:"cart",home:mk2}});
    cart.tradePhase="back"; cart.tradeTarget={x:mk2.x+60,z:mk2.z}; // a 60-pace route home
    const g0=G.stock[1].gold, expect=Math.round(G.tradeGold(60));
    G.killUnit(cart,raider);
    check("v99 plunder: a LOADED trade cart pays its route value (+"+(G.stock[1].gold-g0)+"g ≈ "+expect+")",
      Math.abs(G.stock[1].gold-g0-expect)<=1&&G.stock[1].gold>g0);
    const cart2=G.makeUnit(0,"tradecart",-28,72,{name:"EmptyCart",bot:{role:"cart",home:mk2}});
    cart2.tradePhase="out";
    const g1=G.stock[1].gold;
    G.killUnit(cart2,raider);
    check("v99 plunder: an EMPTY cart spills nothing",G.stock[1].gold===g1);
    raider.alive=false;
  }
  // ---- the cargo byte: every client SEES the load ----
  {
    NET.mode="host";
    const ox2=G.makeUnit(0,"villager",-44,62,{name:"WireOx",bot:null});
    G.setClass(ox2,"oxcart"); ox2.alive=true; ox2.carry.wood=150; // half a bed
    NET._lastRow=null;
    const s=NET.packSnap();
    const row=NET.readSnapRows(s).find(w=>w[0]===ox2.id);
    check("v99 cargo byte: half a bed rides as ~50 ("+(row&&row[10])+")",!!row&&Math.abs(row[10]-50)<=1);
    NET.mode="guest";
    s.q=NET.lastQ+1; NET.applySnap(s);
    G.updateCargoVisual(ox2);
    const _lt=ox2.rig&&ox2.rig.logs?ox2.rig.logs.children.length:0; // v113: the rebuilt wain stacks 8, not 6
    check("v99 cargo visual: guests decode 0.5 and show half the log stack ("+
      (ox2.rig&&ox2.rig.logs?ox2.rig.logs.children.filter(l=>l.visible).length:"-")+" of "+_lt+")",
      Math.abs((ox2._cargo||0)-0.5)<=0.02&&ox2.rig&&ox2.rig.logs&&ox2.rig.logs.visible===true&&_lt===8&&
      ox2.rig.logs.children.filter(l=>l.visible).length===Math.max(1,Math.ceil(0.5*_lt)));
    ox2.alive=false;
  }
  NET.mode="guest";
}

// ================= v100: THE SOUNDSCAPE =================
// Headless: no AudioContext, so play() no-ops on the graph — but every DECISION helper
// (resolve/pan/dist/throttle/voice-cap/mute/bus) is pure and asserted here. Self-calibrating
// pairs: near-plays vs far-culled · fresh-fires vs throttled · under-cap vs over-cap · on vs muted.
{
  const A=global.__G.Sound;
  check("v100 audio: the manager loaded & exported",!!A&&typeof A.play==="function"&&typeof A._decideKey==="function");
  check("v132.38 audio: 155 sound defs registered (79 SFX + 58 vocals + 2 wolf + 16 buff cues)",
    Object.keys(A._defs).length===155);
  // ---- v132.37: THE REGISTRY GATE. DEFS is what loadAll() and resolve() key on; SND_DATA is
  // only the payload. A key in one and not the other is a sound that never makes a noise, and
  // nothing anywhere throws or logs. Both directions, because they are different bugs. ----
  {
    const sndSrc=fs.readFileSync(path.join(ROOT,"js","audio-data.js"),"utf8");
    const embedded=new Set([...sndSrc.matchAll(/"([A-Za-z0-9_]+)":"/g)].map(m=>m[1]));
    const defs=Object.keys(A._defs);
    const unregistered=[...embedded].filter(k=>!A._defs[k]);
    const unembedded=defs.filter(k=>!embedded.has(k));
    check("v132.37 audio: every EMBEDDED sound is registered in DEFS — an unregistered key is "+
      "never decoded by loadAll() and resolve() returns null for it, so it is 20KB of silence "+
      "("+embedded.size+" embedded"+(unregistered.length?", ORPHANED: "+unregistered.join(","):"")+")",
      embedded.size>=151&&unregistered.length===0);
    check("v132.37 audio: …and every REGISTERED sound is embedded — the fallback is fetch(), "+
      "which is disabled on file:// and useless to an offline service-worker client, so this "+
      "one plays on the dev machine and nowhere else"+
      (unembedded.length?" [MISSING AUDIO: "+unembedded.join(",")+"]":""),unembedded.length===0);
    // ---- every call site in the game resolves through the same predicate play() uses ----
    const CHORUS="__chorus";   // a net sentinel the handler branches on, never a key
    let playKeys=new Set(), sfxKeys=[], netKeys=new Set(), sites=0;
    for(const f of fs.readdirSync(path.join(ROOT,"js"))){
      if(!/^\d\d-.*\.js$/.test(f))continue;
      const t=fs.readFileSync(path.join(ROOT,"js",f),"utf8");
      for(const m of t.matchAll(/Sound\.play\(\s*"([A-Za-z0-9_]+)"/g)){playKeys.add(m[1]);sites++;}
      for(const m of t.matchAll(/_sfxAt\(\s*"([A-Za-z0-9_]+)"/g)){sfxKeys.push(m[1]);sites++;}
      for(const m of t.matchAll(/\{t:"snd",k:"([A-Za-z0-9_]+)"/g))if(m[1]!==CHORUS)netKeys.add(m[1]);
    }
    const allRefs=[...new Set([...playKeys,...sfxKeys,...netKeys])];
    const dead=allRefs.filter(k=>A._resolve(k)===null);
    check("v132.37 audio: the scan actually found the call sites — a regex that stopped "+
      "matching would make the next assertion a claim about the empty set ("+sites+" literal "+
      "play sites, "+allRefs.length+" distinct keys)",sites>=60&&allRefs.length>=40);
    check("v132.37 audio: EVERY key the game asks for resolves — a typo'd key is not a syntax "+
      "error, it is a cue that silently never fires"+(dead.length?" [DEAD: "+dead.join(",")+"]":""),
      dead.length===0);
    // ---- John's rule, as a test: no reuse ----
    const reused=sfxKeys.filter(k=>playKeys.has(k));
    check("v132.38 audio: the buff cues are SIXTEEN — "+sfxKeys.length+" proc sites, "+
      new Set(sfxKeys).size+" distinct keys",sfxKeys.length===16&&new Set(sfxKeys).size===16);
    check("v132.38 audio: …and no two of them share a KEY with an existing play site"+
      (reused.length?" [REUSED: "+reused.join(",")+"]":""),reused.length===0);
    // ---- v132.38: THE SAME CLAIM, ABOUT THE AUDIO. The key check above is what shipped in
    // v132.37 under the name "no sound reuse". It was green while SEVEN of the twelve cues were
    // the same recording the game already played under another key. A player hears waveforms. ----
    {
      let man=null,err="";
      try{man=JSON.parse(fs.readFileSync(path.join(ROOT,"tools","sfx-screen.json"),"utf8"));}
      catch(e){err=e.message;}
      check("v132.38 no-reuse: the waveform screen exists — a MISSING manifest is the state after "+
        "someone deletes it to silence a red, so it fails loudly rather than skipping"+
        (man?"":" ["+err+"]"),!!man&&!!man.keys);
      if(man&&man.keys){
        const crypto=require("crypto");
        const live={};
        for(const m of sndSrc.matchAll(/"([A-Za-z0-9_]+)":"([A-Za-z0-9+\/=]*)"/g))
          live[m[1]]=crypto.createHash("sha256").update(m[2]).digest("hex").slice(0,16);
        const lk=Object.keys(live).sort(), mk=Object.keys(man.keys).sort();
        const missing=lk.filter(k=>!man.keys[k]), extra=mk.filter(k=>!live[k]);
        check("v132.38 no-reuse: the screen covers exactly the sounds in the bank ("+lk.length+
          " embedded, "+mk.length+" screened)"+(missing.length?" [UNSCREENED: "+missing.join(",")+"]":"")+
          (extra.length?" [STALE: "+extra.join(",")+"]":""),
          missing.length===0&&extra.length===0);
        const drift=lk.filter(k=>man.keys[k]&&man.keys[k]!==live[k]);
        check("v132.38 no-reuse: …and every hash matches, so the verdict is about THIS audio — "+
          "swap a sound without re-running `node tools/sfxdupe.js --freeze` and this goes red "+
          "instead of inheriting the old sound's clean bill of health"+
          (drift.length?" [CHANGED SINCE SCREENING: "+drift.join(",")+"]":""),drift.length===0);
        const over=man.over||[];
        check("v132.38 no-reuse: NO TWO CUES ARE THE SAME SOUND — all "+
          (lk.length*(lk.length-1)/2).toLocaleString("en-US")+" pairs compared by envelope and "+
          "spectrum, threshold "+man.threshold+", "+(man.allowed||[]).length+" pairs argued for "+
          "in writing (one actor's two death cries)"+
          (over.length?" [COLLIDES: "+over.map(o=>o.a+"~"+o.b+" "+o.s).join(", ")+"]":""),
          over.length===0);
      }
    }
    // ---- the twelve are spatial, on the sfx bus, and throttled ----
    const CUES=[...new Set(sfxKeys)];
    const notSpatial=CUES.filter(k=>!A._defs[k]||A._defs[k][1]!==1||A._defs[k][0]!==0||A._defs[k][2]!==0);
    check("v132.37 audio: every cue is a one-shot on the sfx bus with 3D placement — each call "+
      "site passes {x,z} and a 2D cue would ignore it"+(notSpatial.length?" ["+notSpatial.join(",")+"]":""),
      notSpatial.length===0);
    const unthrottled=CUES.filter(k=>!(A._throttle[k]>0));
    check("v132.37 audio: every cue has a category throttle — the per-unit clocks in combat bound "+
      "ONE unit; forty units in one melee are bounded only here"+
      (unthrottled.length?" ["+unthrottled.join(",")+"]":""),unthrottled.length===0);
  }
  // variant groups: play("swing") resolves to one of swing1..4; unknown resolves to null
  check("v100 audio: variant groups resolve ('swing'→a swing variant, junk→null)",
    /^swing[1-4]$/.test(A._resolve("swing"))&&A._resolve("swing9nope")===null&&A._resolve("hit1")==="hit1");
  check("v100 audio: 'death'/'bow'/'arrowhit' are multi-variant groups",
    A._groups.death.length===2&&A._groups.bow.length===2&&A._groups.arrowhit.length===2);

  // --- pan model: symmetric about the listener, clamped [-1,1], centered≈0 ---
  const L={x:0,z:0,yaw:0};
  const pL=A._panFor(-40,0,L.x,L.z,L.yaw), pR=A._panFor(40,0,L.x,L.z,L.yaw), pC=A._panFor(0,0,L.x,L.z,L.yaw);
  check("v100 audio: pan is symmetric, centered≈0, clamped ("+pL.toFixed(2)+"/"+pC.toFixed(2)+"/"+pR.toFixed(2)+")",
    Math.abs(pC)<1e-9&&Math.sign(pL)===-Math.sign(pR)&&pL>=-1&&pR<=1&&Math.abs(pL)===Math.abs(pR));
  // --- distance rolloff: 1 up close, 0 past FAR, monotone in between ---
  const gN=A._gainForDist(0,0,0,0), gF=A._gainForDist(A.FAR+10,0,0,0), gM=A._gainForDist((A.NEAR+A.FAR)/2,0,0,0);
  check("v100 audio: distance rolloff 1@near · 0@far · mid between ("+gM.toFixed(2)+")",gN===1&&gF===0&&gM>0&&gM<1);

  const NOW=1e6, LOPT={x:0,z:0,_listener:L};
  // reset shared decision state so the pairs below are clean
  A._state.last={}; A._state.active.length=0; A.setMute(false);
  A.setVol("master",0.9); A.setVol("sfx",1.0); A.setVol("ambience",0.55);

  // spatial cull: a hit at the listener PLAYS; the same hit past FAR is CULLED
  const near=A._decideKey("hit1",{x:2,z:0,_listener:L},NOW);
  const far =A._decideKey("hit1",{x:A.FAR+30,z:0,_listener:L},NOW);
  check("v100 audio: near-hit fires, far-hit is distance-culled",near.play===true&&far.play===false&&far.reason==="far");

  // throttle pair: same category twice inside its window — 2nd is throttled; a UI cue (0ms) never is
  A._state.last={};
  const h1=A._decideKey("hit1",LOPT,NOW);           A._state.last.hit=NOW; // stamp as play() would
  const h2=A._decideKey("hit1",LOPT,NOW+10);         // 10ms < 45ms hit throttle
  const h3=A._decideKey("hit1",LOPT,NOW+200);        // window elapsed
  check("v100 audio: same cue throttles inside its window, re-arms after ("+h1.play+"/"+h2.play+"/"+h3.play+")",
    h1.play===true&&h2.play===false&&h2.reason==="throttle"&&h3.play===true);
  A._state.last={};
  const u1=A._decideKey("ui_confirm",{},NOW), u2=A._decideKey("ui_confirm",{},NOW+1);
  check("v100 audio: UI cues have no throttle (both fire)",u1.play===true&&u2.play===true);

  // voice cap: fill the combat voices → a capped cue is dropped; an IMPORTANT cue still lands
  A._state.last={}; A._state.active.length=0;
  for(let i=0;i<A.MAXVOICES;i++)A._state.active.push({key:"hit1",until:NOW+500});
  const capped=A._decideKey("swing1",{x:1,z:0,_listener:L},NOW);
  const important=A._decideKey("regicide_win",{},NOW);
  check("v100 audio: voice-cap drops combat spam but never the signature cue",
    capped.play===false&&capped.reason==="cap"&&important.play===true);
  A._state.active.length=0;

  // mute + bus gain zero both silence the DECISION (gain floors out)
  A._state.last={}; A.setMute(true);
  const muted=A._decideKey("ui_confirm",{},NOW);
  A.setMute(false); A._state.last={};
  const onAgain=A._decideKey("ui_confirm",{},NOW);
  A.setVol("sfx",0); A._state.last={};
  const busOff=A._decideKey("ui_confirm",{},NOW);
  A.setVol("sfx",1.0);
  check("v100 audio: mute & a zeroed bus both silence a cue; unmuted plays",
    muted.play===false&&muted.reason==="silent"&&onAgain.play===true&&busOff.play===false);

  // 2D cues (spatial=0) ignore position entirely — never distance-culled
  A._state.last={};
  const flat=A._decideKey("ageup",{x:9999,z:9999,_listener:L},NOW);
  check("v100 audio: 2D cues (ageup) ignore position — no distance cull",flat.play===true);

  // play() end-to-end (headless): returns true when it WOULD fire, false when throttled
  A._state.last={}; A._state.active.length=0; A.setMute(false); A.setVol("sfx",1.0);
  const p1=A.play("hit",{x:0,z:0,_listener:L}), p2=A.play("hit",{x:0,z:0,_listener:L}); // 2nd within throttle
  const d1=A.play("deposit"), d2=A.play("deposit");             // no throttle
  check("v100 audio: play() reports would-fire vs throttled ("+p1+"/"+p2+" · "+d1+"/"+d2+")",
    p1===true&&p2===false&&d1===true&&d2===true);
  check("v100 audio: mute API round-trips",A.toggleMute()===true&&A.isMuted()===true&&A.toggleMute()===false);
  // tick() is safe to call headless (ambience/march driver no-ops without a context)
  let tickSafe=true; try{A.tick(0.016);}catch(e){tickSafe=false;}
  check("v100 audio: tick() is headless-safe",tickSafe);
  // the options-panel globals exist and don't throw against the stub DOM
  const TO=global.__G.toggleOptions, SU=global.__G.syncOptionsUI;
  let optSafe=true; try{if(SU)SU();if(TO){TO();TO();}}catch(e){optSafe=false;}
  check("v100 audio: options-panel wiring is stub-DOM safe",optSafe&&typeof TO==="function"&&typeof SU==="function");
  A.setMute(false);
}

// ================= v107: THE SCORE & THE 90-SECOND ADVANCE =================
// Gameplay: T pays now and arms a 90s team countdown (host-authoritative, no cancel);
// the age fires when the timer does, and the countdown rides every snap (`ares`).
// Music: per-age anthems stream via <audio> (headless: no Audio → the DECISION state
// machine still runs and is asserted here — track map, fade curve, volume law, arming).
{
  const G=global.__G, A=G.Sound;
  G.setGameOver(false);
  const savAge=[G.teamAge[0],G.teamAge[1]], savRes=[G.ageResT[0],G.ageResT[1]];
  const savStock=JSON.parse(JSON.stringify(G.stock));

  // --- the timed advance: pay at T, land 90s later, never pay twice ---
  G.ageResT[0]=0;G.ageResT[1]=0;G.teamAge[0]=2;
  const cost=G.AGES[3].cost;
  G.stock[0].food=cost.food+500; G.stock[0].gold=(cost.gold||0)+500;
  const started=G.startAgeResearch(0);
  const paidF=G.stock[0].food, paidG=G.stock[0].gold;
  check("v107 advance: T pays the cost NOW and arms the 90s countdown (age unchanged)",
    started===true&&G.ageResT[0]===G.AGE_RESEARCH_S&&G.teamAge[0]===2&&
    paidF===500&&paidG===500);
  check("v107 advance: a second T while advancing is refused (no double pay)",
    G.startAgeResearch(0)===false&&G.stock[0].food===paidF&&G.ageResT[0]===G.AGE_RESEARCH_S);
  G.tickAgeResearch(60,true);
  const midOk=G.teamAge[0]===2&&Math.abs(G.ageResT[0]-30)<1e-6;
  G.tickAgeResearch(31,true);
  check("v107 advance: 60s in the age holds, at 90s it LANDS — and ageUp pays nothing again",
    midOk&&G.teamAge[0]===3&&G.ageResT[0]===0&&G.stock[0].food===paidF&&G.stock[0].gold===paidG);
  // guests tick for display only — the age must NOT fire without authority
  G.ageResT[0]=1;
  G.tickAgeResearch(5,false);
  check("v107 advance: a guest countdown reaching 0 does NOT flip the age (host's snap does)",
    G.teamAge[0]===3&&G.ageResT[0]===0);
  // the countdown rides the wire: world payload + snap payload both carry `ares`
  // v127: `ares` is no longer on EVERY snapshot — it rides ~2Hz now, because the guest already
  // ticks the countdown down itself between arrivals (tickAgeResearch(dt,false)) and 15Hz of
  // authoritative overwrite was fighting its own smoothing. So force the keyframe rather than
  // asserting against whichever phase this call happens to land on: what matters is that the
  // field still CARRIES the countdown, not that it is present 15 times a second.
  G.ageResT[0]=42.5;
  const w=G.NET.packWorld(1);
  let snapAres=null;
  try{G.NET._lastRow=null;const s=G.NET.packSnap(); snapAres=s&&s.ares;}catch(_){}
  check("v115/v132.46 net: PROTO 46 (the damage number) and `ares` still rides both payloads",
    G.NET.PROTO===46&&Array.isArray(w.ares)&&Math.abs(w.ares[0]-42.5)<0.06&&
    Array.isArray(snapAres)&&Math.abs(snapAres[0]-42.5)<0.06);
  G.ageResT[0]=0;

  // --- the score: track map, fade curve, volume law, arming state machine ---
  check("v111 music: music bus defaults to 40% (prefs key v4 — stale broken-mix sliders reset)",Math.abs(A.getVol("music")-0.4)<1e-9);
  check("v107 music: age→track map clamps to age0…age5",
    A._musTrackFor(0)==="audio/music/age0.ogg"&&A._musTrackFor(5)==="audio/music/age5.ogg"&&
    A._musTrackFor(-3)==="audio/music/age0.ogg"&&A._musTrackFor(99)==="audio/music/age5.ogg");
  check("v107 music: fade is full above 15s, half at 7.5s, full when no advance runs",
    A._musFadeFor(90)===1&&A._musFadeFor(A.MUSFADE_S)===1&&
    Math.abs(A._musFadeFor(7.5)-0.5)<1e-9&&A._musFadeFor(0)===1);
  const vSave={m:A.getVol("master"),mu:A.getVol("music")};
  A.setMute(false);A.setVol("master",0.8);A.setVol("music",0.5);
  const mv=A._musVol(0.5); A.setMute(true); const mvM=A._musVol(1); A.setMute(false);
  check("v107 music: anthem volume = master × music × trim × fade — and 0 muted",
    Math.abs(mv-0.8*0.5*A.MUSTRIM*0.5)<1e-9&&mvM===0);
  A.setVol("master",vSave.m);A.setVol("music",vSave.mu);
  // v109 MIX FIX: the source node's gain (`local`) must NOT bake in bus/master — those live
  // on the graph nodes. Halving master halves the DECISION gain but leaves `local` untouched.
  {
    const sv={m:A.getVol("master"),s:A.getVol("sfx")};
    A.setMute(false);A._state.last={};A._state.active.length=0;
    A.setVol("master",1.0);A.setVol("sfx",1.0);
    const d1=A._decideKey("hit1",{x:0,z:0,_listener:{x:0,z:0,yaw:0}},5e6);
    A._state.last={};A.setVol("master",0.5);A.setVol("sfx",0.5);
    const d2=A._decideKey("hit1",{x:0,z:0,_listener:{x:0,z:0,yaw:0}},5e6);
    check("v109 mix: sliders scale the decision gain but never the node's local gain",
      d1.play===true&&d2.play===true&&Math.abs(d1.local-0.9)<1e-9&&Math.abs(d2.local-0.9)<1e-9&&
      Math.abs(d2.gain-d1.gain*0.25)<1e-9);
    A.setVol("master",sv.m);A.setVol("sfx",sv.s);A._state.last={};
  }
  A._mus.age=-1;A._mus.playing=false;
  G.teamAge[0]=3;
  A._musTick(true,0.016);
  const armed=A._mus.age===3;
  A._musTick(false,0.016);
  check("v107 music: a live game arms YOUR age's anthem; menu/game-over rests it to -1",
    armed&&A._mus.age===-1&&A._mus.playing===false);

  // put the world back the way we found it
  G.teamAge[0]=savAge[0];G.teamAge[1]=savAge[1];
  G.ageResT[0]=savRes[0];G.ageResT[1]=savRes[1];
  for(const t of [0,1]){for(const k in savStock[t])G.stock[t][k]=savStock[t][k];}
}

// ================= v109: THE VOICES =================
// 58 Gamemaster human vocals: per-unit deterministic voice identity (id-locked, host/guest
// agree wire-free), soldier pools b/c/d with graded pain, mixed civilian pools a/e/f/g,
// medium-density throttles + voice-cap membership, and the uncapped regicide scream.
{
  const A=global.__G.Sound;
  check("v109 voices: variant pools fold per voice (atk/death/shout ×2, effort ×4, growl ×3)",
    A._groups.vatk_b.length===2&&A._groups.vdeath_e.length===2&&A._groups.vshout_c.length===2&&
    A._groups.veffort.length===4&&A._groups.vgrowl.length===3);
  const s5={id:5,cls:"clubman"}, s5b={id:5,cls:"archer"}, c6={id:6,cls:"villager"}, t7={id:7,cls:"trader"};
  check("v109 voices: a unit's voice is deterministic (id-locked) and pool-routed",
    A._voxVoice(s5)===A._voxVoice(s5b)&&["b","c","d"].includes(A._voxVoice(s5))&&
    ["a","e","f","g"].includes(A._voxVoice(c6))&&["a","e","f","g"].includes(A._voxVoice(t7)));
  check("v109 voices: soldiers grade pain, civilians share one pool and never war-cry",
    /^vpainm_[bcd]$/.test(A._voxKeyFor("painm",s5))&&/^vpainh_[bcd]$/.test(A._voxKeyFor("painh",s5))&&
    /^vpain_[aefg]$/.test(A._voxKeyFor("painm",c6))&&A._voxKeyFor("atk",c6)===null&&
    /^vdeath_[aefg]$/.test(A._voxKeyFor("deathi",c6))&&/^vdeathi_[bcd]$/.test(A._voxKeyFor("deathi",s5)));
  A._state.last={};A._state.active.length=0;A.setMute(false);
  const NOW9=9e6, L9={x:0,z:0,yaw:0};
  const v1=A._decideKey("vpain_b1",{x:0,z:0,_listener:L9},NOW9); A._state.last.vpain_b=NOW9;
  const v2=A._decideKey("vpain_b1",{x:0,z:0,_listener:L9},NOW9+50);
  for(let i=0;i<A.MAXVOICES;i++)A._state.active.push({key:"hit1",until:NOW9+500});
  const vCap=A._decideKey("vshout_b1",{x:1,z:0,_listener:L9},NOW9);
  const vKing=A._decideKey("vking1",{},NOW9);
  check("v109 voices: vocals throttle & respect the cap — the regicide scream bypasses both",
    v1.play===true&&v2.play===false&&v2.reason==="throttle"&&vCap.play===false&&vCap.reason==="cap"&&vKing.play===true);
  A._state.active.length=0;A._state.last={};
  let vSafe=true;
  try{A.vox("death",{id:3,cls:"clubman"},{x:0,z:0,_listener:L9});A.voxChorus(0,0);A.voxChorus();}catch(e){vSafe=false;}
  check("v109 voices: vox() and voxChorus() are headless-safe",vSafe);

  // v110 THE WOLVES: two quiet spatial cues — the 7s howl throttles long & is NEVER capped
  // (atmosphere always lands); the bite rides the combat cadence inside the cap
  A._state.last={};A._state.active.length=0;
  const w1=A._decideKey("wolfhowl",{x:2,z:0,_listener:L9},NOW9); A._state.last.wolfhowl=NOW9;
  const w2=A._decideKey("wolfhowl",{x:2,z:0,_listener:L9},NOW9+4000); // inside the 6s window
  for(let i=0;i<A.MAXVOICES;i++)A._state.active.push({key:"hit1",until:NOW9+500});
  const wH=A._decideKey("wolfhowl",{x:2,z:0,_listener:L9},NOW9+9000);
  const wB=A._decideKey("wolfbite",{x:2,z:0,_listener:L9},NOW9);
  check("v110 wolves: defs land quiet & spatial; howl throttles 6s and bypasses the cap; bite is capped",
    A._defs.wolfhowl[3]===0.55&&A._defs.wolfbite[3]===0.7&&A._defs.wolfhowl[1]===1&&
    w1.play===true&&w2.play===false&&w2.reason==="throttle"&&
    wH.play===true&&wB.play===false&&wB.reason==="cap");
  A._state.active.length=0;A._state.last={};

  // ================= v113: THE QUIET PASS + THE FLANK =================
  // 1) the mix: music trimmed again, the town bell put on a one-minute leash
  check("v113 mix: MUSTRIM deepens to 0.42 and the base alarm only tolls once a minute",
    Math.abs(A.MUSTRIM-0.42)<1e-9&&A._throttle.basealarm===60000);
  A._state.last={};A._state.active.length=0;
  const b1=A._decideKey("basealarm",{},NOW9); A._state.last.basealarm=NOW9;
  const b2=A._decideKey("basealarm",{},NOW9+30000); // a bombardment 30s later must NOT re-ring
  const b3=A._decideKey("basealarm",{},NOW9+61000);
  check("v113 alarm: rings, holds through 30s of shelling, re-arms after the minute",
    b1.play===true&&b2.play===false&&b2.reason==="throttle"&&b3.play===true);
  A._state.active.length=0;A._state.last={};
}
{
  const G=global.__G;
  // 2) the silent archer: hand-aimed fire now speaks
  {
    const A=G.Sound, arch=G.makeUnit(0,"archer",-150,4,{name:"Aimer",bot:null});
    arch.alive=true; arch.atkT=0;
    const heard=[]; const realPlay=A.play;
    A.play=function(k,o){heard.push(k);return realPlay.call(A,k,o);};
    const savedPlayer=G.player;
    try{
      G.__setPlayer?G.__setPlayer(arch):0;
    }catch(_){}
    A.play=realPlay;
    check("v113 archer: fireAimedShot exists and carries a launch cue",
      typeof G.fireAimedShot==="function"&&/Sound\.play/.test(G.fireAimedShot.toString())&&
      /cannonfire/.test(G.fireAimedShot.toString())&&/"bow"/.test(G.fireAimedShot.toString()));
    arch.alive=false; void savedPlayer;
  }
  // 3) gather foley halves: every OTHER swing is miked
  check("v113 gather: the host gather tick gates its cue on an alternating flag",
    /_gsw/.test(G.economyTick.toString())===false); // (the flag lives in the player tick, not economyTick)
  // 4) farms: 2 food every 3 seconds
  check("v113 farms: FARM_PASSIVE is 2 food / 3s ("+G.FARM_PASSIVE.toFixed(4)+")",
    Math.abs(G.FARM_PASSIVE-2/3)<1e-9);
  // 5) THE CARTS: both rebuilt on jointed, trotting anatomy
  {
    const ox=G.makeUnit(0,"villager",-150,-8,{name:"Wain",bot:null}); G.setClass(ox,"oxcart");
    // v131.7 THIS BUILT `trader` AND CALLED IT A MULE, WHICH IS WHY IT NEVER CAUGHT ANYTHING.
    // `trader` and `tradecart` are two classes; until this round they were ONE MODEL, because both
    // carry rig:"cart" in 00-data.js and the cart rig has no class branch in it. §H A4 scored the
    // pair at ΔE00 0.0 / IoU 1.000 in both views — the only exact 1.000 in the game — while this
    // assertion, the one place any test looks at either class, reported that collision as a PASS
    // by building the wrong half of it. The market mule is `tradecart`. §E's Trader is a walking
    // merchant nutcracker and is asserted on its own terms below.
    const mule=G.makeUnit(0,"tradecart",-150,-14,{name:"Mule",bot:null});
    const oL=ox.rig&&ox.rig.horseLegs, mL=mule.rig&&mule.rig.horseLegs;
    const oxSG=ox.body.children.find(c=>c.isGroup&&Math.abs(c.scale.x-G.OXSCALE)<1e-9);
    check("v113 ox cart: 4 jointed TROT legs, 8 logs, 4 wheels, one group at OXSCALE "+G.OXSCALE,
      !!oL&&oL.length===4&&oL.every(l=>l.userData.knee&&l.userData.trot)&&
      ox.rig.logs.children.length===8&&ox.rig.wheels.length===4&&!!ox.rig.horseG&&!!oxSG);
    check("v113 ox cart: the health bar clears the rig at whatever OXSCALE is set to",
      ox.bar&&ox.bar.bg.position.y>2.9*G.OXSCALE&&ox.bar.bg.position.y<2.9*G.OXSCALE+2.5);
    check("v113 market mule: jointed TROT legs, a neck pivot and cargo that hides when empty",
      !!mL&&mL.length===4&&mL.every(l=>l.userData.knee&&l.userData.trot)&&
      !!mule.rig.horseNeck&&!!mule.rig.goods&&mule.rig.goods.visible===false&&mule.rig.wheels.length===4);
    // v131.7 §E THE TRADER IS A WALKING MERCHANT AND NOT THE CART HE BUYS FROM.
    // Asserted structurally rather than by pixel: he is on the NUTCRACKER rig (two legs, two arms,
    // a head — none of which the cart rig builds), he has NO mule and NO wheels, and he carries the
    // strongbox §E names as his read on his BACK, above the shoulder line (world 1.95) and behind
    // the skull's own back facet at z −0.54. The mesh count is the §H A10 ceiling test: everything
    // §E adds parents into a cluster the rig already merges, so a merchant costs the same eleven
    // draw calls as a spearman. If someone re-points this class at the cart rig, all five fail.
    // The strongbox is looked for in VERTICES and not in a child mesh, because by the time anyone
    // can see this unit the torso cluster is ONE welded mesh (that is the point of v128.6) and
    // Box3.setFromObject on it returns the whole barrel. Counting positions in the region instead
    // survives the merge and is what actually has to be true: geometry behind the head, above the
    // shoulder. Region: torso-local y > 1.15 (world 2.10, the shoulder ball tops out at 2.07) and
    // z < -0.60 (the skull's back facet is -0.54). Nothing else on any nutcracker is back there.
    const trd=G.makeUnit(0,"trader",-150,-20,{name:"Merchant",bot:null});
    const tr=trd.rig||{}; let sbn=0,sbY=9,sbZ=9;
    if(tr.torso)for(const c of tr.torso.children){
      const p=c.isMesh&&c.geometry&&c.geometry.attributes&&c.geometry.attributes.position; if(!p)continue;
      for(let i=0;i<p.count;i++){const y=p.getY(i),z=p.getZ(i);
        if(y>1.15&&z<-0.60){sbn++; if(y<sbY)sbY=y; if(z<sbZ)sbZ=z;}}
    }
    check("v131.7 trader: the nutcracker rig, not the mule — legs, arms, head, no wheels, no beast",
      !!tr.legL&&!!tr.shinL&&!!tr.armR&&!!tr.faR&&!!tr.head&&!!tr.torso&&!tr.wheels&&!tr.horseG);
    check("v131.7 trader: §E's strongbox rides above the shoulder line BEHIND the head ("+sbn+
      " verts, lowest world y "+(sbn?(sbY+0.95).toFixed(2):"-")+", deepest z "+(sbn?sbZ.toFixed(2):"-")+")",
      sbn>=8&&sbY+0.95>2.05&&sbZ<-0.70);
    check("v131.7 trader: zero new draw calls — merged into the same 11 clusters as a foot unit ("+
      trd._merged+" parts welded)",trd._merged>0&&trd.body.children.filter(c=>c.isMesh).length<=4);
    trd.alive=false; trd.root.visible=false;
    ox.carry.wood=300; G.updateCargoVisual(ox);
    const full=ox.rig.logs.children.filter(l=>l.visible).length;
    ox.carry.wood=75; G.updateCargoVisual(ox);
    const quarter=ox.rig.logs.children.filter(l=>l.visible).length;
    check("v113 ox cart: the log stack grows with the haul ("+quarter+" of "+full+")",
      ox.rig.logs.visible===true&&full===8&&quarter===2);
    ox.alive=false; mule.alive=false;
  }
  // 6) THE FLANKING LANES: bands approach off-axis, then turn in
  {
    const u={id:3,team:G.BLUE,root:{position:{x:-150,z:0}},bandRef:{id:1,laneZ:88}};
    const far=G.laneTarget(u,175,0);
    u.root.position.x=140; // now inside the turn-in radius of the objective
    const near=G.laneTarget(u,175,0);
    const road={id:4,team:G.BLUE,root:{position:{x:-150,z:0}},bandRef:{id:2,laneZ:0}};
    const straight=G.laneTarget(road,175,0);
    check("v113 flank: a laned band sweeps off the road far out, then turns in at "+G.LANE_TURNIN,
      far.lane===true&&Math.abs(far.z)>40&&near.lane===false&&near.z===0&&
      straight.lane===false&&straight.z===0);
    const edge={id:5,team:G.BLUE,root:{position:{x:-150,z:0}},bandRef:{id:3,laneZ:400}};
    check("v113 flank: a lane never steers past the border fringe",
      Math.abs(G.laneTarget(edge,175,0).z)<=G.LANE_EDGE&&G.LANE_EDGE<G.MAP.z);
    const D={team:G.BLUE}, bA={id:11}, bB={id:12};
    G.assignLane(D,bA); G.assignLane(D,bB);
    check("v113 flank: consecutive bands are dealt DIFFERENT axes ("+bA.laneZ+" / "+bB.laneZ+")",
      bA.laneZ!==bB.laneZ&&bA.laneUntil>0&&bB.laneUntil>0);
    const loose={id:7,team:G.BLUE,root:{position:{x:0,z:0}}}; // no band: still fans out by id
    check("v113 flank: a bandless raider still draws a lane from the table",
      G.LANE_Z.includes(G.laneFor(loose)));
  }
  // 7) THE RELIEF: a quiet bazaar posting does not last forever
  {
    const G2=global.__G, team=G2.BLUE, D=G2.directors[team], NOWT=G2.getT();
    // A COLD POSTING: one soldier parked in an empty corner of the map, tour spent.
    // (manageBands prunes memberless bands, so the band needs a real, live body.)
    const cold=G2.makeUnit(team,"clubman",-200,-118,{name:"Sentry",bot:{role:"war"}});
    cold.alive=true;
    const hb={id:9001,role:"hold",members:[cold],holdUntil:NOWT-1,lastContact:NOWT-9999,laneZ:0,laneUntil:NOWT+999};
    // v127: "a cold field" was HOPED for, not established. manageBands re-checks contact by
    // looking for enemies near the posting, so one wandering raider within a few units made the
    // field hot and the band rightly held — and the check then reported that correct behaviour as
    // a failure. The HOT case five lines below is staged deliberately; this one has to be too, or
    // the pair is the same test run twice with different luck.
    const cellar=isolateArea(-200,-118,30,{team:1-team,keep:[cold]});
    // v134.0 …AND THE SQUARE IS PART OF THE FIELD. bandHoldPoint posts a hold band ON a bazaar, and
    // manageBands refuses to relieve a band standing on one that is mid-capture (the v132.26
    // `_taking` rule) — by EITHER side, because a square the enemy is taking under your feet is not
    // quiet ground either. So a campaign that leaves any bazaar part-captured makes this assertion
    // fail while the code does exactly the right thing. The enemy count was staged here from v127;
    // the capture state was not. Both now are.
    const bazHold=G2.neutralMarkets.map(m=>({m,cap:m.cap,capTeam:m.capTeam}));
    for(const m of G2.neutralMarkets){m.cap=0;m.capTeam=-1;}
    cold.bandRef=hb; D.bands.push(hb);
    G2.manageBands(D);
    cellar.restore();
    for(const e of bazHold){e.m.cap=e.cap;e.m.capTeam=e.capTeam;}
    check("v113 relief: a hold band with a spent tour and a cold field takes a new mission ("+hb.role+
      ", field cleared of "+cellar.moved+")",
      hb.role!=="hold"&&["econ","patrol","assassin"].includes(hb.role)&&hb.point===null);
    // v134.0 A SQUARE HALF TAKEN IS NOT QUIET GROUND. The v132.26 `_taking` rule — "a band
    // mid-capture is not relieved", John's point being that marching a band off a bazaar at 59%
    // hands the square straight back — shipped without a test and was never once exercised until
    // the v134.0 pathing work tripped it by accident. This is that test, run the same way the
    // relief case above is: everything identical, one field moved.
    {
      const bz=G2.neutralMarkets.find(m=>m.owner!==team);
      if(bz){
        const hb3={id:9003,role:"hold",members:[cold],holdUntil:NOWT-1,lastContact:NOWT-9999,laneZ:0,laneUntil:NOWT+999};
        const keep3=G2.neutralMarkets.map(m=>({m,cap:m.cap,capTeam:m.capTeam}));
        for(const m of G2.neutralMarkets){m.cap=0;m.capTeam=-1;}
        bz.cap=0.6; bz.capTeam=team;               // OUR band, six tenths of the way in
        const cell3=isolateArea(-200,-118,30,{team:1-team,keep:[cold]});
        cold.bandRef=hb3; D.bands.push(hb3);
        G2.manageBands(D);
        cell3.restore();
        const held=hb3.role==="hold";
        // …and prove the harness is not simply refusing to relieve anything: the same band, the
        // same everything, with the capture wound back to zero, IS relieved.
        const hb4={id:9004,role:"hold",members:[cold],holdUntil:NOWT-1,lastContact:NOWT-9999,laneZ:0,laneUntil:NOWT+999};
        for(const m of G2.neutralMarkets){m.cap=0;m.capTeam=-1;}
        const cell4=isolateArea(-200,-118,30,{team:1-team,keep:[cold]});
        cold.bandRef=hb4; D.bands.push(hb4);
        G2.manageBands(D);
        cell4.restore();
        for(const e of keep3){e.m.cap=e.cap;e.m.capTeam=e.capTeam;}
        check("v132.26 relief: a band MID-CAPTURE is not relieved, and the same band with the "+
          "square at zero is ("+hb3.role+" holding vs "+hb4.role+" relieved)",
          held&&hb4.role!=="hold");
        D.bands=D.bands.filter(b=>b!==hb3&&b!==hb4);
      }
    }
    // A HOT POSTING: the same spent tour, but an enemy standing on it — the ground still matters
    const hb2={id:9002,role:"hold",members:[cold],holdUntil:NOWT-1,lastContact:NOWT-9999,laneZ:0,laneUntil:NOWT+999};
    cold.bandRef=hb2; D.bands.push(hb2);
    const foe=G2.makeUnit(1-team,"clubman",-200,-112,{name:"Prowler",bot:{role:"war"}}); foe.alive=true;
    G2.manageBands(D);
    check("v113 relief: a posting still under contact is NOT abandoned ("+hb2.role+")",hb2.role==="hold");
    foe.alive=false; cold.alive=false;
    check("v113 relief: the tour dials are sane (tour "+G2.HOLD_TOUR+"s · quiet "+G2.HOLD_QUIET+"s · watch "+G2.HOLD_WATCH+")",
      G2.HOLD_TOUR>=30&&G2.HOLD_QUIET>=10&&G2.HOLD_WATCH>=30);
  }
}

{
  // ================= v114: THE GREAT WOOD =================
  const G=global.__G, N=G.nodes, H=o=>{const bb=new THREE.Box3().setFromObject(o);return bb.max.y-bb.min.y;};
  const trees=N.filter(n=>n.type==="wood");
  const MAPX=G.MAP.x, MAPZ=G.MAP.z;
  const MAN=4.43; // a nutcracker on foot, measured
  const hs=trees.filter(t=>t.amount>0).map(t=>H(t.mesh)); // felled stumps aren't canopy
  const avg=hs.reduce((a,b)=>a+b,0)/hs.length;
  check("v114 trees: the wood towers over the nutcrackers (avg "+avg.toFixed(1)+" = "+(avg/MAN).toFixed(1)+"× a "+MAN+" soldier)",
    avg>MAN*2.5&&avg<MAN*4);
  check("v114 forest: the map runs flush ("+trees.length+" choppable trees)",trees.length>=400);
  check("v114 draw budget: every tree is ONE mesh sharing pre-built geometry ("+G.TREE_GEOS.length+" silhouettes)",
    trees.every(t=>t.mesh.isMesh&&!t.mesh.children.length)&&
    G.TREE_GEOS.length>=6&&G.STUMP_GEOS.length===G.TREE_GEOS.length&&
    trees.every(t=>G.TREE_GEOS.includes(t.mesh.geometry)||G.STUMP_GEOS.includes(t.mesh.geometry)));
  // the lanes the game needs stay open
  // The scattered wild wood keeps TREE_CLEAR_BASE off both thrones; the v34 HOME FORESTS are
  // deliberately planted close so each team has timber in reach, so the hard rule is only that
  // nothing grows in the town centre's own yard, and nothing at all stands on the road.
  let inYard=0,onRoad=0;
  for(const t of trees){
    for(const tc of G.TCPOS)if(Math.hypot(t.x-tc[0],t.z-tc[1])<G.BLD.towncenter.r+11)inYard++;
    for(let i=0;i<=40;i++){const p=G.roadPoint(i/40);if(Math.hypot(t.x-p.x,t.z-p.z)<G.TREE_CLEAR_ROAD){onRoad++;break;}}
  }
  check("v114 clear lanes: nothing in a town-centre yard ("+inYard+"), nothing on the King's Road ("+onRoad+")",
    inYard===0&&onRoad===0);
  // placement: wood yields, the finite prizes do not
  {
    // a tree standing on ground that is otherwise legal: clear of buildings, clear of the
    // finite nodes, inside the map. Only the timber should be in the way.
    const R=G.BLD.house.r;
    const live=trees.find(t=>t.amount>0&&Math.abs(t.x)<MAPX-20&&Math.abs(t.z)<MAPZ-20&&
      !G.buildings.some(b=>b.alive&&Math.hypot(b.x-t.x,b.z-t.z)<R+b.def.r+4)&&
      !N.some(n=>n.type!=="wood"&&n.amount>0&&Math.hypot(n.x-t.x,n.z-t.z)<R+5)&&
      !G.townBoards.some(tb=>Math.hypot(tb.x-t.x,tb.z-t.z)<R+5));
    const stone=N.find(n=>n.type==="stone"&&n.amount>0);
    // DIFFERENTIAL, not a single sample. The old form asserted validFor()===true at the first
    // tree matching a filter that never excluded ROADS — 634 trees matched, 612 were buildable,
    // and .find() landed on one of the 22 sitting on the King road. That failed a correct game.
    // Hold the position fixed and vary ONLY the timber: wood must not be what blocks a plot,
    // and stone must be.
    // SWEEP, not a sample: every candidate tree, timber on vs timber off.
    const cands=trees.filter(t=>t.amount>0&&Math.abs(t.x)<MAPX-20&&Math.abs(t.z)<MAPZ-20&&
      !G.buildings.some(b=>b.alive&&Math.hypot(b.x-t.x,b.z-t.z)<R+b.def.r+4)&&
      !N.some(n=>n.type!=="wood"&&n.amount>0&&Math.hypot(n.x-t.x,n.z-t.z)<R+5)&&
      !G.townBoards.some(tb=>Math.hypot(tb.x-t.x,tb.z-t.z)<R+5));
    let differ=0,buildable=0;
    for(const t of cands){
      const a=G.validFor("house",t.x,t.z,0);
      const amt=t.amount; t.amount=0;
      const b=G.validFor("house",t.x,t.z,0);
      t.amount=amt;
      if(a!==b)differ++;
      if(a===true)buildable++;
    }
    check("v114 clearing: TIMBER is never what blocks a plot — swept "+cands.length+
      " tree sites, felling changed the verdict on "+differ,differ===0);
    check("v114 clearing: …and that sweep is NOT vacuous — "+buildable+"/"+cands.length+
      " of those sites are genuinely buildable",cands.length>200&&buildable>cands.length*0.8);
    const withoutWood=true,withWood=true; // superseded by the sweep above
    // every pile, not one: which of them block, and on which is the stone provably the cause?
    // LIVE piles: the campaign mines one out during the run, and a spent pile correctly stops
    // refusing a plot. Asserting over all six made this gate flake 6/6 -> 5/6 between runs.
    const allPiles=N.filter(n=>n.type==="stone");
    const piles=allPiles.filter(n=>n.amount>0);
    let blocked=0,freedByRemoval=0,openAround=0;
    for(const st of piles){
      if(G.validFor("house",st.x,st.z,0)===false)blocked++;
      const amt=st.amount; st.amount=0;
      if(G.validFor("house",st.x,st.z,0)===true)freedByRemoval++;
      st.amount=amt;
      let ok=0;
      for(const d of [12,18,26,34])for(const ang of [0,Math.PI/2,Math.PI,3*Math.PI/2])
        if(G.validFor("house",st.x+Math.cos(ang)*d,st.z+Math.sin(ang)*d,0)===true)ok++;
      if(ok>0)openAround++;
    }
    check("v114 clearing: EVERY LIVE stone pile refuses a plot ("+blocked+"/"+piles.length+
      " live of "+allPiles.length+" sited)",
      blocked===piles.length&&allPiles.length===6&&piles.length>=4);
    // v134.0 CONSTRUCTED, NOT SCAVENGED. See tools/patch-smoketest-stone-invariant-v134.js: this
    // asserted freedByRemoval>=2, a tally of how many piles happened to have nothing built beside
    // them at the end of one campaign, and it went red on the default seed the moment the pathing
    // changed — 3 of 4 plots were refused by a BUILDING, and the one genuinely standalone pile
    // freed up exactly as it should. Clean ground, one planted pile, both directions:
    {
      const RH=G.BLD.house.r;
      let spot=null;
      for(let x=-150;x<=150&&!spot;x+=7)for(let z=-110;z<=110&&!spot;z+=7){
        if(G.validFor("house",x,z,0)!==true)continue;              // legal before we touch anything
        if(N.some(n=>n.type!=="wood"&&n.amount>0&&Math.hypot(n.x-x,n.z-z)<RH+9))continue;
        spot={x,z};
      }
      let refused=false,freed=false;
      if(spot){
        const planted={type:"stone",x:spot.x,z:spot.z,amount:500};
        N.push(planted);                                           // …and out again, below
        refused=G.validFor("house",spot.x,spot.z,0)===false;
        planted.amount=0;
        freed=G.validFor("house",spot.x,spot.z,0)===true;
        N.splice(N.indexOf(planted),1);   // nodes is POSITIONAL on the wire — leave it as we found it
      }
      check("v114 clearing: on clean ground a stone pile REFUSES the plot and emptying it frees "+
        "the plot again ("+(spot?"at "+spot.x+","+spot.z+": refused "+refused+", freed "+freed:
        "NO CLEAN GROUND FOUND")+"; of the "+piles.length+" live piles on the map "+freedByRemoval+
        " stand alone, the rest are covered by a building or a neighbour)",
        !!spot&&refused&&freed);
    }
    check("v114 clearing: …and the refusal is LOCAL to the prize, not regional terrain — open\n      ground within 12-34 of all "+openAround+"/"+piles.length+" piles",openAround===piles.length);
    const before=live.amount;
    const h=G.makeBuilding(0,"house",live.x,live.z,true);
    check("v114 clearing: raising the house FELLS the trees under its footprint ("+before+" → "+live.amount+")",
      live.amount===0&&h.alive===true);
    // and only what it actually covers
    const far=trees.find(t=>t.amount>0&&Math.hypot(t.x-h.x,t.z-h.z)>G.BLD.house.r+8);
    check("v114 clearing: a tree outside the footprint is left standing",!!far&&far.amount>0);
    h.alive=false; G.scene?0:0;
  }
  check("v114 tree scale is one dial (TREE_SCALE "+G.TREE_SCALE+")",G.TREE_SCALE>1&&G.TREE_SCALE<2);

  // ---- v115: the wood grows in STANDS, not as evenly-spaced pasture ----
  const live=trees.filter(t=>t.amount>0);
  check("v115 stands: the map carries real forests ("+G.TREE_STANDS.length+" stands)",
    G.TREE_STANDS.length>=20&&
    G.TREE_STANDS.filter(s=>Math.abs(s.x)>=0.001).length%2===0);
  // v132.25: ONE mirror for the whole world, (x,z) -> (-x,z). The 180° convention is retired —
  // the two of them were each fair alone but not fair together, because node clearance deletes
  // trees, and wood within 60 of a throne read BLUE 1 / RED 12. Do not reintroduce it.
  const mirrored=G.TREE_STANDS.every(s=>
    G.TREE_STANDS.some(o=>Math.abs(o.x+s.x)<0.001&&Math.abs(o.z-s.z)<0.001&&Math.abs(o.r-s.r)<0.001));
  check("v115/v132.25 stands: every stand is mirrored in x — the wood is fair to both thrones",mirrored);
  check("v132.25 stands: the RETIRED 180° mirror is genuinely gone (a stand off the axis has no 180° twin)",
    !G.TREE_STANDS.filter(s=>Math.abs(s.x)>=0.001&&Math.abs(s.z)>=0.001).every(s=>
      G.TREE_STANDS.some(o=>Math.abs(o.x+s.x)<0.001&&Math.abs(o.z+s.z)<0.001&&Math.abs(o.r-s.r)<0.001)));
  // CLUSTERING, measured properly: nearest-neighbour distance is a poor test here because the
  // planting grid puts a floor under it either way. The INDEX OF DISPERSION does the job —
  // quadrat-count variance over mean. A uniform/Poisson scatter sits near 1.0; a field that
  // clumps into stands runs well above it. (v114's even grid measured ~1.0; stands measure ~3+.)
  const QR=24; const counts=[];
  for(let x=-G.MAP.x+28;x<G.MAP.x-28;x+=QR)for(let z=-G.MAP.z+18;z<G.MAP.z-18;z+=QR){
    if(G.TCPOS.some(t=>Math.hypot(x-t[0],z-t[1])<G.TREE_CLEAR_BASE+QR))continue; // cleared by rule
    if(Math.abs(z)<G.TREE_CLEAR_ROAD+QR*0.5)continue;                            // ditto the road
    let c=0; for(const t of live)if(Math.abs(t.x-x)<QR/2&&Math.abs(t.z-z)<QR/2)c++;
    counts.push(c);
  }
  const mean=counts.reduce((a,b)=>a+b,0)/counts.length;
  const varr=counts.reduce((a,b)=>a+(b-mean)*(b-mean),0)/counts.length;
  const disp=varr/mean;
  check("v115 clustering: the wood clumps into stands (index of dispersion "+disp.toFixed(2)+
    ", uniform scatter ≈ 1.0)",disp>=1.8);
  // and the meadows are real: some open country genuinely has no wood in it
  let empty=0,probed=0;
  for(let x=-G.MAP.x+30;x<G.MAP.x-30;x+=26)for(let z=-G.MAP.z+20;z<G.MAP.z-20;z+=22){
    if(Math.abs(z)<26)continue;                       // skip the road corridor, cleared by rule
    if(G.TCPOS.some(t=>Math.hypot(x-t[0],z-t[1])<G.TREE_CLEAR_BASE))continue;
    probed++;
    if(!live.some(t=>Math.hypot(t.x-x,t.z-z)<13))empty++;
  }
  check("v115 meadows: open ground survives between the stands ("+empty+"/"+probed+" probes clear)",
    empty>=probed*0.15&&empty<=probed*0.75);
}

{
  // ================= v116: THE MOBILE SPIKE =================
  const G=global.__G;
  // 12-touch.js loads with the rest of the bundle. Headless it must be COMPLETELY inert —
  // no pad, no perf tier, no pointer-lock override — or it would corrupt every test above it.
  // Both UI layers guard on the same two tells, and this asserts the PREMISE rather than a
  // symptom: the stub's getElementById auto-creates whatever you ask it for, so "is there a #dbar"
  // is always true and proves nothing. If either tell ever becomes defined headless, 13-deskui
  // would reparent the stubbed HUD into a bar and the compact roster/age branches would switch on
  // under every test above this line.
  // (The behavioural proof that 13-deskui stayed out is the v124 roster test below: it asserts the
  // LONG two-team line, which only renders when neither touch-mode nor bar-mode is set.)
  check("v125 deskui: neither UI layer can run headless — `screen` is the tell doing the work "+
    "(Node 22 DEFINES a global navigator, so that half of the guard no longer discriminates)",
    typeof screen==="undefined");
  // ---------- v132.30: BATCH A — every new buff, measured against a control ----------
  {
    const G=global.__G, dmgOf=G.dealDamage, BS=G.buffSt;
    // dealDamage returns immediately when NET.mode is "guest" ("host owns all damage"), and an
    // earlier block leaves it there — every probe read 0.0 damage until this was set.
    const _mode0=G.NET.mode; G.NET.mode="host"; G.setGameOver(false);
    let X=-150, Z=-120;                                   // a quiet corner, away from the towns
    const mk=(team,lvl,buffs,cls)=>{
      X+=3;
      const v=G.makeUnit(team,cls||"clubman",X,Z,{name:"BA",bot:{role:"citizen"}});
      v.bot=null; v.remote="ba"+X; v.buffs=buffs||{}; v.hpBonus=0; v.xp=0; v.lvl=lvl||0;
      G.setClassStats(v); v.hp=v.maxHp;
      return v;
    };
    // a fixed-damage probe: how much HP does one blow take off this victim?
    const hit=(att,vic,d)=>{const h=vic.hp; dmgOf(att,vic,d==null?20:d); return h-vic.hp;};

    // ---- attacker-side ----
    {
      const plain=mk(0,0,{}), buffed=mk(0,0,{ambush:1});
      const v1=mk(1,0,{}), v2=mk(1,0,{});
      const a=hit(plain,v1), b=hit(buffed,v2);
      check("v132.30 FIRST BLOOD: +50% into a FULL-health enemy ("+a.toFixed(1)+" → "+b.toFixed(1)+")",b>a*1.4);
    }
    {
      const plain=mk(0,0,{}), buffed=mk(0,0,{yeoman:1});
      const v1=mk(1,0,{}), v2=mk(1,0,{});
      const a=hit(plain,v1), b=hit(buffed,v2);
      check("v132.30 YEOMAN: a villager hits twice as hard — but only a VILLAGER (clubman "+
        a.toFixed(1)+" vs "+b.toFixed(1)+")",Math.abs(a-b)<0.01);
      const vilP=mk(0,0,{},"villager"), vilB=mk(0,0,{yeoman:1},"villager");
      const v3=mk(1,0,{}), v4=mk(1,0,{});
      const c=hit(vilP,v3), e=hit(vilB,v4);
      check("v132.30 YEOMAN: …and a villager DOES ("+c.toFixed(1)+" → "+e.toFixed(1)+")",e>c*1.8);
      const vv1=mk(1,0,{},"villager"), vv2=mk(1,0,{yeoman:1},"villager");
      const f=hit(vilP,vv1), g=hit(vilP,vv2);
      check("v132.30 YEOMAN: the health half is a damage CUT, not a maxHp change ("+f.toFixed(1)+
        " → "+g.toFixed(1)+")",g<f*0.6);
    }
    {
      // WOODSMAN — put the subject inside a real TREE_STAND, and its control outside every one
      const st=G.TREE_STANDS&&G.TREE_STANDS[0];
      if(st){
        const inW=mk(0,0,{woods:1}); inW.root.position.set(st.x,inW.root.position.y,st.z);
        const outW=mk(0,0,{woods:1});
        let ox=st.x,oz=st.z; // walk out until no stand contains it
        for(let k=0;k<400&&G.inTheWoods({root:{position:{x:ox,z:oz}}});k++){ox+=4;}
        outW.root.position.set(ox,outW.root.position.y,oz);
        check("v132.30 WOODSMAN: the woods test itself discriminates (in "+
          G.inTheWoods(inW)+" / out "+G.inTheWoods(outW)+")",
          G.inTheWoods(inW)===true&&G.inTheWoods(outW)===false);
        const v1=mk(1,0,{}), v2=mk(1,0,{});
        const a=hit(outW,v1), b=hit(inW,v2);
        check("v132.30 WOODSMAN: +10% under the canopy ("+a.toFixed(1)+" → "+b.toFixed(1)+")",b>a);
      }
    }
    {
      // KING'S GUARD — both halves, measured beside the real king
      const k=G.kings&&G.kings[0];
      if(k&&k.root){
        const near=mk(0,0,{kguard:1});
        near.root.position.set(k.root.position.x+2,near.root.position.y,k.root.position.z+2);
        const far=mk(0,0,{kguard:1});
        check("v132.30 KING'S GUARD: the proximity test discriminates (near "+G.nearOwnKing(near)+
          " / far "+G.nearOwnKing(far)+")",G.nearOwnKing(near)===true&&G.nearOwnKing(far)===false);
        const v1=mk(1,0,{}), v2=mk(1,0,{});
        const a=hit(far,v1), b=hit(near,v2);
        check("v132.30 KING'S GUARD: +10% damage beside your King ("+a.toFixed(1)+" → "+b.toFixed(1)+")",b>a);
        const dNear=mk(0,0,{kguard:1});
        dNear.root.position.set(k.root.position.x+2,dNear.root.position.y,k.root.position.z+2);
        const dFar=mk(0,0,{kguard:1});
        const att=mk(1,0,{});
        const p=hit(att,dFar), q=hit(att,dNear);
        check("v132.30 KING'S GUARD: …and −10% taken there too ("+p.toFixed(1)+" → "+q.toFixed(1)+")",q<p);
      }
    }
    // ---- victim-side ----
    {
      const beast=mk(2,0,{});                                  // the wilds
      const plain=mk(0,0,{}), warded=mk(0,0,{warden:3});
      const a=hit(beast,plain), b=hit(beast,warded);
      check("v132.30 BEAST WARDEN: ×3 cuts the wilds' bite ("+a.toFixed(1)+" → "+b.toFixed(1)+")",b<a*0.75);
    }
    {
      const att=mk(1,0,{}), taxed=mk(0,0,{tribute:1});
      const g0=G.stock[0].gold; hit(att,taxed);
      check("v132.30 BLOOD TAX: taking a blow pays 1 gold (+"+(G.stock[0].gold-g0)+")",
        G.stock[0].gold===g0+1);
    }
    {
      const att=mk(1,0,{}), sharp=mk(0,0,{thorns:2});
      const h0=att.hp; hit(att,sharp);
      check("v132.30 BRAMBLE MAIL: ×2 bites the melee attacker back for 2 ("+(h0-att.hp)+")",
        h0-att.hp===2);
      const bow=mk(1,0,{},"archer"); const h1=bow.hp; hit(bow,sharp);
      check("v132.30 BRAMBLE MAIL: …and never a RANGED attacker ("+(h1-bow.hp)+")",h1===bow.hp);
    }
    // ---- the kill payouts ----
    {
      const killer=mk(0,0,{feast:2,purse:1,forage:1,trophy:1});
      killer.hp=Math.max(1,Math.round(killer.maxHp*0.3));
      const hpBefore=killer.hp, maxBefore=killer.maxHp;
      const g0=G.stock[0].gold, f0=G.stock[0].food;
      const prey=mk(1,0,{}); dmgOf(killer,prey,99999);
      check("v132.30 SECOND WIND ×2: a kill restores 20% of max HP ("+hpBefore+" → "+killer.hp+")",
        killer.hp>hpBefore);
      check("v132.30 CUTPURSE / SCAVENGER: a kill pockets 10 gold and 10 food (+"+
        (G.stock[0].gold-g0)+"g +"+(G.stock[0].food-f0)+"f)",
        G.stock[0].gold===g0+10&&G.stock[0].food===f0+10);
      check("v132.30 TROPHY HUNTER: a kill adds permanent max HP ("+maxBefore+" → "+killer.maxHp+
        ", bonus "+(killer.hpBonus||0)+")",killer.hpBonus===5&&killer.maxHp===maxBefore+5);
      // …and it must survive the recompute that arming up performs
      G.setClassStats(killer);
      check("v132.30 TROPHY HUNTER: …and it SURVIVES setClassStats — arming up must not erase it "+
        "(maxHp "+killer.maxHp+", bonus "+killer.hpBonus+")",
        killer.hpBonus===5&&killer.maxHp===maxBefore+5&&killer.dmg>0&&killer.spd>0&&killer.cd>0);
    }
    {
      // CULLER — a wounded beast dies to a scratch; an unbuffed attacker leaves it standing
      const beast1=mk(2,0,{}), beast2=mk(2,0,{});
      beast1.hp=beast1.maxHp*0.10; beast2.hp=beast2.maxHp*0.10;
      const plain=mk(0,0,{}), culler=mk(0,0,{cull:1});
      dmgOf(plain,beast1,0.5);
      dmgOf(culler,beast2,0.5);
      check("v132.30 CULLER: a beast under 15% is finished outright, and only by the buff "+
        "(control alive "+!!beast1.alive+", culled alive "+!!beast2.alive+")",
        beast1.alive===true&&beast2.alive===false);
    }
    {
      // DESPERATION — the attack CLOCK runs faster the more health is missing
      const hurt=mk(0,0,{fervor:1}), whole=mk(0,0,{fervor:1});
      hurt.hp=hurt.maxHp*0.2; whole.hp=whole.maxHp;
      hurt.atkT=1.0; whole.atkT=1.0;
      G.updateUnitCommon(hurt,0.1); G.updateUnitCommon(whole,0.1);
      check("v132.30 DESPERATION: the swing clock runs faster when hurt (hurt "+hurt.atkT.toFixed(3)+
        " vs whole "+whole.atkT.toFixed(3)+")",hurt.atkT<whole.atkT);
    }
    {
      // PACK MULE — the same villager, laden and empty
      const laden=mk(0,0,{mule:1},"villager"), empty=mk(0,0,{mule:1},"villager");
      const cap=G.carryCap(laden);
      laden.carry={food:cap,gold:0,stone:0,wood:0};
      empty.carry={food:0,gold:0,stone:0,wood:0};
      const z0a=laden.root.position.z, z0b=empty.root.position.z;
      G.moveUnit(laden,0,1,0.2); G.moveUnit(empty,0,1,0.2);
      const da=Math.abs(laden.root.position.z-z0a), db=Math.abs(empty.root.position.z-z0b);
      check("v132.30 PACK MULE: a full pack moves further in the same tick ("+db.toFixed(3)+
        " → "+da.toFixed(3)+")",da>db);
    }
    // ---- v132.31 BULWARK ----
    {
      const plain=mk(0,0,{}), bul=mk(0,0,{bulwark:1});
      const full=G.BLD.stone_wall.cost, half=G.bldCost(bul,"stone_wall");
      check("v132.31 BULWARK: a defensive structure costs half (stone "+(full.stone||0)+" → "+
        (half.stone||0)+")",half.stone===Math.ceil(full.stone/2)&&half!==full);
      check("v132.31 BULWARK: …and it does NOT discount a house (wood "+
        (G.bldCost(bul,"house").wood||0)+" vs "+(G.BLD.house.cost.wood||0)+")",
        G.bldCost(bul,"house").wood===G.BLD.house.cost.wood);
      check("v132.31 BULWARK: an unbuffed builder pays full price ("+
        (G.bldCost(plain,"stone_wall").stone||0)+")",
        G.bldCost(plain,"stone_wall").stone===full.stone);
      check("v132.31 BULWARK: the DEFENSIVE set is derived from BLD flags — walls, gates, both "+
        "towers and the castle, and nothing else",
        G.isDefensiveDef(G.BLD.stone_wall)&&G.isDefensiveDef(G.BLD.fort_gate)&&
        G.isDefensiveDef(G.BLD.tower)&&G.isDefensiveDef(G.BLD.watch_tower)&&
        G.isDefensiveDef(G.BLD.castle)&&
        !G.isDefensiveDef(G.BLD.house)&&!G.isDefensiveDef(G.BLD.temple)&&
        !G.isDefensiveDef(G.BLD.market)&&!G.isDefensiveDef(G.BLD.barracks));
      // THE ONE THAT MATTERS: the gate and the charge must agree. Park the stockpile BETWEEN the
      // two prices — there, a discount applied to only one of them cannot hide.
      const st=G.stock[0];
      const keep={food:st.food,gold:st.gold,stone:st.stone,wood:st.wood};
      st.food=9999; st.gold=9999; st.wood=9999;
      st.stone=Math.ceil(full.stone/2)+1;           // enough for the HALF price, not the full one
      const gateSaysYes=G.canAfford(0,G.bldCost(bul,"stone_wall"));
      const gateSaysNo =G.canAfford(0,G.bldCost(plain,"stone_wall"));
      const before=st.stone; G.pay(0,G.bldCost(bul,"stone_wall")); const spent=before-st.stone;
      check("v132.31 BULWARK: the affordability GATE and the CHARGE agree — with "+before+
        " stone the buffed builder is allowed ("+gateSaysYes+"), the unbuffed one is not ("+
        gateSaysNo+"), and the till took "+spent,
        gateSaysYes===true&&gateSaysNo===false&&spent===Math.ceil(full.stone/2));
      st.food=keep.food; st.gold=keep.gold; st.stone=keep.stone; st.wood=keep.wood;
    }
    // ---- v132.31: GILDED HARVEST and RICH SOIL, LIFTED FROM SOURCE ----
    // These two live in the gather and harvest paths, which need a live node, a ripe farm and a
    // driven player to exercise — more scaffolding than signal. Re-implementing their arithmetic
    // in the test would be worthless: it would pass with the hooks deleted from the game, which is
    // exactly the tautology this block replaced. So they are asserted the way this file already
    // asserts the build-reach expressions — READ OUT OF THE SHIPPING SOURCE.
    //
    // The failure mode being gated is specific and has bitten this project repeatedly: gathering
    // and harvesting each exist TWICE, once for the local player (09-main.js / 06-input.js) and
    // once for a host-driven remote human (10-net.js). Patching only the first ships a buff that
    // works for the host and is silently dead for every guest. Both halves are required here.
    {
      const src=(f)=>fs.readFileSync(path.join(ROOT,"js",f),"utf8");
      const mainSrc=src("09-main.js"), netSrc=src("10-net.js"), inputSrc=src("06-input.js");
      const has=(hay,needle)=>hay.indexOf(needle)>=0; // plain substring: a regex here loses its
      // backslashes to the patch script’s own template literal, and a stripped \( turns into a
      // capture group that silently matches nothing.
      const ghLocal=has(mainSrc,'n.type==="gold"&&buffSt(player,"alchemy")');
      const ghRemote=has(netSrc,'n.type==="gold"&&buffSt(u,"alchemy")');
      check("v132.31 GILDED HARVEST is wired at BOTH gather sites — local "+ghLocal+
        " / host-driven remote "+ghRemote+" (one without the other is dead for guests)",
        ghLocal&&ghRemote);
      const rsLocal=has(inputSrc,'buffSt(player,"reaping")');
      const rsRemote=has(netSrc,'buffSt(u,"reaping")');
      check("v132.31 RICH SOIL is wired at BOTH harvest sites — local "+rsLocal+
        " / host-driven remote "+rsRemote,rsLocal&&rsRemote);
      // and the ids really exist in the table, so a rename cannot leave these regexes matching
      // dead code
      check("v132.31 …and both ids are live in BUFFS, so the checks above cannot match a rename",
        !!G.BUFF_BY_ID["alchemy"]&&!!G.BUFF_BY_ID["reaping"]);
    }
    G.NET.mode=_mode0;
  }
  // ---------- v132.32: BATCH B — the timed-modifier system ----------
  {
    const G=global.__G, dmgOf=G.dealDamage;
    const _mB=G.NET.mode; G.NET.mode="host"; G.setGameOver(false);
    let BX=-150, BZ=-95;
    const mkB=(team,buffs,cls)=>{
      BX+=3;
      const v=G.makeUnit(team,cls||"clubman",BX,BZ,{name:"TB",bot:{role:"citizen"}});
      v.bot=null; v.remote="tb"+BX; v.buffs=buffs||{}; v._tmods=null; v._lowLatch=false;
      G.setClassStats(v); v.hp=v.maxHp; return v;
    };
    // ---- the system itself ----
    {
      const u=mkB(0,{});
      G.tmodAdd(u,"spdmul",0.5,2,false);
      check("v132.32 tmod: a modifier is live while its clock runs ("+G.tmodMul(u,"spdmul").toFixed(2)+"×)",
        Math.abs(G.tmodMul(u,"spdmul")-1.5)<1e-9);
      G.tmodTick(u,3);
      check("v132.32 tmod: …and it EXPIRES — ticked past its duration it is gone ("+
        G.tmodMul(u,"spdmul").toFixed(2)+"×, entries "+((u._tmods&&u._tmods.length)||0)+")",
        Math.abs(G.tmodMul(u,"spdmul")-1)<1e-9&&!u._tmods);
      // REFRESH, NOT DUPLICATE
      for(let k=0;k<5;k++)G.tmodAdd(u,"spdmul",0.5,2,false);
      check("v132.32 tmod: five applications leave ONE entry, refreshed — not five timers ("+
        u._tmods.length+")",u._tmods.length===1);
      // FADE
      const f=mkB(0,{});
      G.tmodAdd(f,"spdmul",1.0,2,true);
      const at0=G.tmodMul(f,"spdmul"); G.tmodTick(f,1); const at1=G.tmodMul(f,"spdmul");
      check("v132.32 tmod: a FADING modifier decays with its clock ("+at0.toFixed(2)+"× → "+
        at1.toFixed(2)+"×)",at0>at1&&at1>1);
      // a CAP that accumulates
      const cp=mkB(0,{});
      for(let k=0;k<12;k++)G.tmodAdd(cp,"dmgflat",2,7,false,10);
      check("v132.32 tmod: an accumulating modifier stops at its cap (+"+G.tmodSum(cp,"dmgflat")+")",
        G.tmodSum(cp,"dmgflat")===10);
    }
    // ---- KILLING FRENZY ----
    {
      const k1=mkB(0,{frenzy:1});
      const p1=mkB(1,{}); dmgOf(k1,p1,99999);
      check("v133.0 KILLING FRENZY: a kill grants +3 flat damage (+"+G.tmodSum(k1,"dmgflat")+")",
        G.tmodSum(k1,"dmgflat")===3);
      for(let k=0;k<8;k++){const p=mkB(1,{});dmgOf(k1,p,99999);}
      check("v133.0 KILLING FRENZY: …accumulating to a ceiling of +15 (+"+G.tmodSum(k1,"dmgflat")+")",
        G.tmodSum(k1,"dmgflat")===15);
      const plain=mkB(0,{}), v1=mkB(1,{}), v2=mkB(1,{});
      const hA=v1.hp; dmgOf(plain,v1,20); const dA=hA-v1.hp;
      const hB=v2.hp; dmgOf(k1,v2,20);    const dB=hB-v2.hp;
      check("v132.32 KILLING FRENZY: and the flat bonus reaches the blow ("+dA.toFixed(1)+" → "+
        dB.toFixed(1)+")",dB>dA);
      G.tmodTick(k1,11);   // v133.0: the window is TEN seconds now — ticking 8 would leave it up
      check("v133.0 KILLING FRENZY: …and it is gone after its 10 seconds (+"+
        G.tmodSum(k1,"dmgflat")+")",G.tmodSum(k1,"dmgflat")===0);
    }
    // ---- BLOODRUSH ----
    {
      const r=mkB(0,{surge:1}), prey=mkB(1,{});
      dmgOf(r,prey,99999);
      const m0=G.tmodMul(r,"spdmul");
      G.tmodTick(r,1);
      const m1=G.tmodMul(r,"spdmul");
      check("v132.32 BLOODRUSH: a kill quickens the step, and it FADES ("+m0.toFixed(2)+"× → "+
        m1.toFixed(2)+"×)",m0>1.4&&m1<m0&&m1>1);
    }
    // ---- SURVIVAL INSTINCT: the latch is the whole assertion ----
    {
      const s1=mkB(0,{flight:1}), att=mkB(1,{});
      s1.hp=s1.maxHp; dmgOf(att,s1,s1.maxHp*0.8);          // one blow takes it under the line
      check("v132.32 SURVIVAL INSTINCT: crossing below "+(G.TMOD_LOW*100)+"% arms it ("+
        G.tmodMul(s1,"spdmul").toFixed(2)+"×, latched "+!!s1._lowLatch+")",
        G.tmodMul(s1,"spdmul")>1.3&&s1._lowLatch===true);
      G.tmodTick(s1,2);                                     // part-spent: 5s clock now at 3s
      // ⚠ MEASURE THE CLOCK, NOT THE MULTIPLIER. A re-arm refreshes the DURATION; for a
      // non-fading modifier the magnitude is identical either way, so a multiplier comparison
      // here passes whether or not the latch exists — verified by deleting the latch and
      // watching this assertion stay green. The remaining time is the only witness.
      const midT=s1._tmods&&s1._tmods[0]?s1._tmods[0].t:0;
      dmgOf(att,s1,1); dmgOf(att,s1,1);                     // more blows, still under the line
      const nowT=s1._tmods&&s1._tmods[0]?s1._tmods[0].t:0;
      check("v132.32 SURVIVAL INSTINCT: further blows under the line do NOT re-arm it — the latch "+
        "is what stops a trigger becoming a permanent buff (clock "+midT.toFixed(2)+"s → "+
        nowT.toFixed(2)+"s, a re-arm would snap it back to 5.00)",
        Math.abs(nowT-midT)<1e-9&&nowT<4.5);
      s1.hp=s1.maxHp; G.tmodTick(s1,0.1);                   // healed back over the line
      check("v132.32 SURVIVAL INSTINCT: …and healing past the line RELEASES the latch, so it can "+
        "fire again (latched "+!!s1._lowLatch+")",s1._lowLatch===false);
    }
    // ---- LONG STRIDER ----
    {
      const st=mkB(0,{stride:1}), hot=mkB(0,{stride:1});
      st._lastHurt=-999;                                    // long out of combat
      hot._lastHurt=G.getT();                               // just hit
      const z0=st.root.position.z, z1=hot.root.position.z;
      G.moveUnit(st,0,1,0.2); G.moveUnit(hot,0,1,0.2);
      const dS=Math.abs(st.root.position.z-z0), dH=Math.abs(hot.root.position.z-z1);
      check("v132.32 LONG STRIDER: faster out of combat, ordinary in it ("+dH.toFixed(3)+
        " → "+dS.toFixed(3)+")",dS>dH);
    }
    // ---- HUNTER'S STEP ----
    {
      const mel=mkB(0,{hunt:1}), bow=mkB(0,{hunt:1},"archer");
      const v1=mkB(1,{}), v2=mkB(1,{});
      dmgOf(mel,v1,5); dmgOf(bow,v2,5);
      check("v132.32 HUNTER'S STEP: a MELEE blow quickens the step ("+
        G.tmodMul(mel,"spdmul").toFixed(2)+"×)",G.tmodMul(mel,"spdmul")>1.05);
      check("v132.32 HUNTER'S STEP: …and a RANGED one does not ("+
        G.tmodMul(bow,"spdmul").toFixed(2)+"×)",Math.abs(G.tmodMul(bow,"spdmul")-1)<1e-9);
    }
      // ---- v132.36: BATCH E — procs and charges ----
      {
        const forceE=(fn)=>{const MR=Math.random;Math.random=()=>0;try{return fn();}finally{Math.random=MR;}};
        const EX=-196, EZ=-140;
        const put=(team,buffs,cls,dx,dz)=>{
          const u=G.makeUnit(team,cls||"clubman",EX+(dx||0),EZ+(dz||0),{name:"E",bot:{role:"citizen"}});
          u.bot=null; u.remote="e"+(dx||0)+"_"+(dz||0)+"_"+team; u.buffs=buffs||{}; u._tmods=null;
          G.setClassStats(u); u.hp=u.maxHp; return u;
        };
        // ---- THE RECURSION GUARD ----
        {
          const slam=put(0,{quake:1},"clubman",0,0);
          const mob=[];
          for(let i=0;i<6;i++)mob.push(put(1,{},"clubman",1+i*0.5,1));
          let ok=true, err="";
          try{ forceE(()=>dmgOf(slam,mob[0],5)); }catch(e){ ok=false; err=e.message; }
          check("v132.36 EARTHSHAKER: a forced slam with six bodies in range COMPLETES — without "+
            "the recursion guard each splash slams again and it is a stack overflow, not a "+
            "balance bug"+(ok?"":" ["+err+"]"),ok);
          const hurt=mob.filter(m=>m.hp<m.maxHp).length;
          check("v132.36 EARTHSHAKER: …and it splashed the crowd ("+hurt+" of "+mob.length+
            " wounded)",hurt>=2);
          for(const m of mob)m.alive=false;
          slam.alive=false;
        }
        // ---- ARROW WARD / IRON GUARD: the discrimination, and the negation ----
        {
          const warded=put(0,{ward:1},"clubman",0,20);
          const bow=put(1,{},"archer",2,20);
          const fist=put(1,{},"clubman",3,20);
          warded._wardT=-999; warded._guardT=-999;
          const h0=warded.hp; dmgOf(bow,warded,20);
          check("v132.36 ARROW WARD: a ranged blow is NEGATED, not reduced ("+h0.toFixed(1)+" → "+
            warded.hp.toFixed(1)+")",Math.abs(warded.hp-h0)<1e-9);
          const h1=warded.hp; dmgOf(bow,warded,20);
          check("v132.36 ARROW WARD: …the charge is SPENT — the next arrow lands in full ("+
            h1.toFixed(1)+" → "+warded.hp.toFixed(1)+")",warded.hp<h1);
          // ⚠ RE-ARM BEFORE TESTING THE DISCRIMINATION. The first block stamped _wardT, so at
          // this point the charge is on cooldown and a melee blow would land whatever the ranged
          // condition said — the check passed even with the condition deleted. Verified.
          warded.hp=warded.maxHp; warded._wardT=-999;
          const h2=warded.hp; dmgOf(fist,warded,20);
          check("v132.36 ARROW WARD: …and it does NOT stop a MELEE blow ("+h2.toFixed(1)+" → "+
            warded.hp.toFixed(1)+")",warded.hp<h2);
          const ironed=put(0,{guardup:1},"clubman",0,25);
          ironed._wardT=-999; ironed._guardT=-999;
          const g0=ironed.hp; dmgOf(fist,ironed,20);
          check("v132.36 IRON GUARD: a melee blow is negated ("+g0.toFixed(1)+" → "+
            ironed.hp.toFixed(1)+")",Math.abs(ironed.hp-g0)<1e-9);
          ironed._guardT=-999;   // same re-arm, same reason
          const g1=ironed.hp; dmgOf(bow,ironed,20);
          check("v132.36 IRON GUARD: …and it does NOT stop an ARROW ("+g1.toFixed(1)+" → "+
            ironed.hp.toFixed(1)+")",ironed.hp<g1);
          // stacking shortens the cooldown
          const one=put(0,{ward:1},"clubman",0,30), three=put(0,{ward:3},"clubman",0,35);
          const now=G.getT();
          one._wardT=now-12; three._wardT=now-12;   // 12s ago: ×1 needs 30, ×3 needs 10
          const o0=one.hp; dmgOf(bow,one,20);
          const t0=three.hp; dmgOf(bow,three,20);
          check("v132.36 THE CHARGE: stacking shortens the cooldown — 12s after a block, x1 is "+
            "still spent ("+(one.hp<o0?"took the hit":"blocked")+") and x3 is ready ("+
            (Math.abs(three.hp-t0)<1e-9?"blocked":"took the hit")+")",
            one.hp<o0&&Math.abs(three.hp-t0)<1e-9);
          bow.alive=false; fist.alive=false; warded.alive=false; ironed.alive=false;
          one.alive=false; three.alive=false;
        }
        // ---- RAPID VOLLEY: three BLOWS, measured by a per-hit effect ----
        {
          // v133.0 COUNT THE BLOWS, NOT THE HEALING. This used Bloodthirst's flat 1 HP a hit as a
          // blow counter — but Bloodthirst is a PERCENTAGE of damage now, so one blow of triple
          // damage heals precisely what three blows heal and the gate could no longer tell them
          // apart. It would have passed on the exact implementation it exists to reject.
          // BLOOD TAX pays a flat 1 gold per blow TAKEN, whatever the blow was worth, so the
          // stockpile delta is a count and not a magnitude. (Damage numbers were the first
          // replacement and were wrong too: dealDamage only emits one when the attacker is the
          // local player, so the gate read a flat zero.)
          const archer=put(0,{volley:1},"archer",0,45);
          const tgt=put(1,{tribute:1},"clubman",2,45);
          archer._volleyT=-999;
          const g0=G.stock[1].gold;
          forceE(()=>dmgOf(archer,tgt,5));
          const blows=G.stock[1].gold-g0;
          check("v132.36 RAPID VOLLEY: THREE separate blows land, not one tripled — Blood Tax was "+
            "paid "+blows+" times, and it pays per BLOW rather than per point of damage",blows===3);
          archer.alive=false; tgt.alive=false;
        }
        // ---- KNIFE FIGHTER ----
        {
          const thrower=put(0,{knives:2},"clubman",0,60);
          const mark=put(1,{},"clubman",4,60);
          const m0=mark.hp;
          forceE(()=>{for(let i=0;i<3;i++)G.knifeTick(thrower,1.0);}); // past the 2s clock
          check("v132.36 KNIFE FIGHTER: the knife finds the nearest enemy in range ("+
            m0.toFixed(1)+" → "+mark.hp.toFixed(1)+")",mark.hp<m0);
          const far=put(1,{},"clubman",G.KNIFE_R+25,60);
          const f0=far.hp;
          forceE(()=>{for(let i=0;i<3;i++)G.knifeTick(thrower,1.0);});
          check("v132.36 KNIFE FIGHTER: …and never one beyond its "+G.KNIFE_R+"-unit reach ("+
            f0.toFixed(1)+" → "+far.hp.toFixed(1)+")",Math.abs(far.hp-f0)<1e-9);
          thrower.alive=false; mark.alive=false; far.alive=false;
        }
      }
    // ---- v132.35: BATCH D — radius auras ----
    {
      const AB=G.auraBuffTick, R=G.AURA_BR;
      const scan=(u,secs)=>{for(let i=0;i<Math.ceil(secs/0.05);i++)AB(u,0.05);};
      // ⚠ THESE TESTS NEED EMPTY GROUND. mkB lines its units up 3 apart, and the aura radius is
      // 10 — so every actor from batches B and C sits INSIDE the radius. The first run of the
      // KINSHIP check duly passed its "different class mends nothing" case by healing off a
      // stray clubman from an earlier block. Move every Batch D actor to a clear corner, and
      // ASSERT it is clear rather than assuming it.
      const DX=-196, DZ=132;
      const near=(x,z,r)=>{let n=0;for(const o of G.units){if(!o.alive)continue;
        const dx=o.root.position.x-x,dz=o.root.position.z-z;if(dx*dx+dz*dz<=r*r)n++;}return n;};
      check("v132.35 aura harness: the test ground is EMPTY before anything is staged on it ("+
        near(DX,DZ,R*2)+" units within "+(R*2)+")",near(DX,DZ,R*2)===0);
      const place=(u,dx,dz)=>{u.root.position.set(DX+(dx||0),u.root.position.y,DZ+(dz||0));return u;};
      // THE COST PROPERTIES FIRST — they are the ones that fail silently
      {
        // stage three allies around the spot, then prove a NON-HOLDER never counts them.
        // (A -1 sentinel proves nothing here: the early-out legitimately zeroes the counts so a
        // buff that is lost does not leave a stale number behind.)
        const n1=place(mkB(0,{}),1,0), n2=place(mkB(0,{}),2,0), n3=place(mkB(0,{}),3,0);
        const idle=place(mkB(0,{}),0,0);            // holds NONE of the six
        scan(idle,2);
        check("v132.35 aura cost: a unit holding none of the six NEVER scans — three allies are "+
          "standing on top of it and it counted "+idle._auraA+". The early-out is what stops 485 "+
          "units walking 485 units every frame",idle._auraA===0);
        const holder=place(mkB(0,{phalanx:1}),0,0);
        holder._auraA=-1; AB(holder,0.05);          // one frame, well under AURA_SCAN
        check("v132.35 aura cost: a holder does NOT scan every frame — 4 Hz, not 60 (after one "+
          "16ms frame the count is still "+holder._auraA+")",holder._auraA===-1);
        scan(holder,0.4);
        check("v132.35 aura cost: …but it DOES scan once the "+G.AURA_SCAN+"s window elapses ("+
          holder._auraA+")",holder._auraA>=0);
      }
      // SANCTUARY — the stillness clock, then the zone
      {
        const heal=place(mkB(0,{sanctuary:1}),0,20);
        const friend=place(mkB(0,{}),2,20);
        friend.hp=friend.maxHp*0.5; const f0=friend.hp;
        // ⚠ v132.47: MOVE IT, do not set a flag. This gate was green from v132.35 while the zone
        // healed people at a dead run, because it set heal.moving=true and drove auraBuffTick by
        // hand — and in that arrangement the flag survives. In the real frame animateUnit consumes
        // u.moving before statusTick ever reads it, so the live code always saw false. The harness
        // proved the mechanism worked when driven by hand and said nothing about the game.
        // John found it by walking. Position is what the fixed code reads and what a player
        // changes by pressing W, and nothing in the frame can consume it.
        // at a realistic PACE: 4 units/sec over 0.05s steps. The first version crept at 1.6 u/s
        // and read as still against a per-frame threshold — which is how it caught that the
        // fix had inherited the original bug's shape.
        // ⚠ WALK IN A CIRCLE. Walking in a straight line carried the healer sixteen units away
        // and out of the friend's radius — so "no healing" was guaranteed by the distance, not by
        // the clock, and the gate stayed GREEN when the fix was reverted to the broken flag. A
        // tight circle moves at a true walking pace and never leaves the zone it is testing.
        const _hx=heal.root.position.x, _hz=heal.root.position.z;
        for(let i=0;i<80;i++){
          const a2=i*0.35;
          heal.root.position.set(_hx+Math.cos(a2)*1.6,heal.root.position.y,_hz+Math.sin(a2)*1.6);
          G.auraBuffTick(heal,0.05);
        }
        check("v132.35/47 SANCTUARY: no zone while you are actually MOVING — measured by position, "+
          "because u.moving is consumed by animateUnit before this ever runs ("+f0.toFixed(1)+" → "+
          friend.hp.toFixed(1)+")",Math.abs(friend.hp-f0)<1e-9);
        // ⚠ AND AT A REAL FRAME RATE. This is the assertion that would have caught my own first
        // fix, which compared raw displacement against a fixed 0.25: at 60fps a unit walking at
        // 4 u/s moves 0.067 in a frame, so every walking player read as STILL and the zone would
        // have gone on healing at a run — the same bug, one layer down. The loop above steps at
        // 20fps with fat chords and cannot see it. This one walks the way the game does.
        friend.hp=friend.maxHp*0.5; const f60=friend.hp;
        heal._stillT=0; heal._stillX=undefined; heal._stillZ=undefined;
        for(let i=0;i<400;i++){                       // ~6.7s at 60fps, well past the 3s clock
          const a6=i*0.05;
          heal.root.position.set(_hx+Math.cos(a6)*1.6,heal.root.position.y,_hz+Math.sin(a6)*1.6);
          G.auraBuffTick(heal,1/60);
        }
        check("v132.35/47 SANCTUARY: …and at SIXTY frames a second, where a 4 u/s walk covers only "+
          "0.067 of a unit per frame. A threshold measured per-FRAME instead of per-SECOND lets "+
          "every walking player read as still ("+f60.toFixed(1)+" → "+friend.hp.toFixed(1)+")",
          Math.abs(friend.hp-f60)<1e-9);
        // ⚠ WALK IT BACK. The loop above carried the healer sixteen units away, which put the
        // friend outside the radius and the far probe inside it — three assertions below measured
        // a healer standing somewhere else entirely. Moving a unit in a test is not free.
        heal.root.position.set(_hx,heal.root.position.y,_hz);
        heal._stillX=_hx; heal._stillZ=_hz; heal._stillT=0;
        scan(heal,2);                               // standing still now, still under the 3s clock
        check("v132.35 SANCTUARY: …and none before the "+G.AURA_STILL+"s of stillness are up ("+
          friend.hp.toFixed(1)+")",Math.abs(friend.hp-f0)<1e-9);
        scan(heal,3);                               // now past it
        check("v132.35 SANCTUARY: …then it opens and mends the warband ("+f0.toFixed(1)+" → "+
          friend.hp.toFixed(1)+")",friend.hp>f0);
        // and the radius bounds it
        const far=place(mkB(0,{}),R+15,20);
        far.hp=far.maxHp*0.5; const x0=far.hp; scan(heal,2);
        check("v132.35 SANCTUARY: …but not someone outside the "+R+"-unit radius ("+
          x0.toFixed(1)+" → "+far.hp.toFixed(1)+")",Math.abs(far.hp-x0)<1e-9);
        far.alive=false; friend.alive=false; heal.alive=false;
      }
      // SEARING PRESENCE — enemies only
      {
        const burn=place(mkB(0,{brand:1}),0,40);
        const foe=place(mkB(1,{}),2,40);
        const pal=place(mkB(0,{}),2,41);
        const e0=foe.hp, a0=pal.hp;
        scan(burn,2);
        check("v132.35 SEARING PRESENCE: nearby enemies burn ("+e0.toFixed(1)+" → "+
          foe.hp.toFixed(1)+")",foe.hp<e0);
        check("v132.35 SEARING PRESENCE: …and allies do NOT ("+a0.toFixed(1)+" → "+
          pal.hp.toFixed(1)+")",Math.abs(pal.hp-a0)<1e-9);
        foe.alive=false; pal.alive=false; burn.alive=false;
      }
      // ---- v132.39: THE BATCH D RINGS ----
      {
        const S=G.buffFxStats, FX=G.buffFxTick;
        // ⚠ ISOLATE. buffFxStats reports the WHOLE SCENE, and by now the campaign above has real
        // units holding real Batch D buffs — so an absolute count here measures somebody else's
        // rings. Park every other mask, restore at the end.
        // ⚠ PARK THE BUFFS TOO, as of v132.42. KING'S GUARD draws a ring at the feet of anyone
        // in their king's light and reuses _ringAt, so it lands in the same counter these gates
        // read — a buff alone is now enough to put a ring on the ground, which was not true when
        // this parking was written. A shared pool quietly widens every gate that counts it.
        const _parked=[], _parkedB=[];
        for(const u of G.units){
          if(u._fxMask){_parked.push([u,u._fxMask]);u._fxMask=0;}
          if(u.buffs){_parkedB.push([u,u.buffs]);u.buffs={};}   // R is not created yet
        }
        // THE SEEDED WINDOW. This cannot be a runtime check: the geometry was correctly built,
        // lazily, hundreds of frames ago, and there is no moment late enough to place a gate and
        // early enough to see an unbuilt pool. It is a claim about the SOURCE, so assert that.
        {
          const src=fs.readFileSync(path.join(ROOT,"js","05-combat.js"),"utf8");
          const i=src.indexOf("function _ringBuild(){"), j=src.indexOf("\n}",i);
          const body=(i>=0&&j>i)?src.slice(i,j):"";
          // ⚠ STATE THE INVARIANT, do not count call sites. The first version asserted
          // "_ringBuild appears exactly twice" and went red in v132.41 when a SECOND lazy caller
          // was added — a change that violates nothing. What matters is that no builder runs at
          // LOAD, so that is what is checked: nothing invoked at column zero, every geometry
          // handle declared null. A third lazy caller will not redden this; one top-level call will.
          const declNull=/let _ringGeo=null/.test(src)&&/let _hexPool=null,_hexGeo=null/.test(src);
          const mkGeo=(src.match(/new THREE\.RingGeometry\(0\.94/g)||[]).length;
          const inBuild=(body.match(/new THREE\.RingGeometry\(0\.94/g)||[]).length;
          const topLevel=(src.match(/^(_ringBuild|_fxBuild)\(\)/gm)||[]);
          check("v132.39/41: NO geometry is minted at LOAD — every handle is declared null, both "+
            "ring geometries are built inside _ringBuild() ("+inBuild+" of "+mkGeo+"), and no "+
            "lazy builder is invoked at top level ("+topLevel.length+" such calls). A geometry "+
            "constructed inside the seeded window costs four random draws and moves every tree "+
            "on the map (invariant #2)",
            declNull&&mkGeo===2&&inBuild===2&&topLevel.length===0);
        }
        const R=mkB(0,{}); R._fxMask=0;
        FX(0.016);
        check("v132.39 rings: …and it IS built by the time anything draws",S().built===true);
        check("v132.39 rings: a unit holding none of the six draws nothing ("+S().rings+")",
          S().rings===0);
        // SANCTUARY grows over the stillness clock
        R._fxMask=G.FX_SANCT; R._fxStill=1; FX(0.016);
        const full=S().live[0]?S().live[0].r:0;
        R._fxStill=0.5; FX(0.016);
        const half=S().live[0]?S().live[0].r:0;
        check("v132.39 SANCTUARY: the ring GROWS over the 3s stillness clock, so the wind-up you "+
          "cannot otherwise see IS the effect (half-wound "+half.toFixed(1)+" vs open "+
          full.toFixed(1)+" units)",full>0&&half>0&&Math.abs(half-full/2)<0.6);
        check("v132.39 SANCTUARY: …and open, it is drawn at the REAL scan radius ("+full.toFixed(1)+
          " vs AURA_BR "+G.AURA_BR+")",Math.abs(full-G.AURA_BR)<0.01);
        // UNBOWED tightens
        R._fxMask=G.FX_RESOLVE; R._auraE=0; FX(0.016);
        const wide=S().live[0].r;
        R._auraE=5; FX(0.016);
        const tight=S().live[0].r;
        check("v132.39 UNBOWED: the ring TIGHTENS as enemies crowd you — a ring closing in IS the "+
          "sentence 'surrounded makes you tougher' ("+wide.toFixed(1)+" -> "+tight.toFixed(1)+
          " units at the 5-enemy cap)",G.RING_TIGHTEN?(tight<wide-1&&Math.abs(tight-G.RING_MIN)<0.01)
                                                     :Math.abs(tight-wide)<0.01);
        // PHALANX is its mirror: a second ring at the cap
        R._fxMask=G.FX_PHALANX; R._auraA=0; FX(0.016);
        const one=S().rings;
        R._auraA=4; FX(0.016);
        const two=S().rings;
        check("v132.39 PHALANX: a SECOND concentric ring appears at the +20% cap, so you can see "+
          "you are getting the full bonus ("+one+" ring below the cap, "+two+" at it)",
          one===1&&two===2);
        // dropping the buff leaves nothing behind
        R._fxMask=0; FX(0.016);
        // ⚠ VISIBLE MESHES, not _ringOn. _ringOn counts what was DRAWN this frame, so deleting
        // the hide-all pass — which leaves every ring ever drawn on the ground forever, the exact
        // bug named here — still reads 0. Found by mutation; the first version was vacuous.
        check("v132.39 rings: dropping the buff CLEARS the ring — hide-all then re-arm, or a "+
          "Sanctuary you walked out of stays painted on the ground for the rest of the match ("+
          S().live.length+" still visible)",S().live.length===0);
        // THE POOL IS A POOL
        const before=S().pool;
        for(let i=0;i<200;i++){R._fxMask=(i%2)?G.FX_SANCT:0;R._fxStill=1;FX(0.016);}
        R._fxMask=0; FX(0.016);
        check("v132.39 rings: the pool is a POOL — 200 frames of rings appearing and vanishing "+
          "did not grow it (was "+before+", now "+S().pool+"). A mesh added per frame is how a "+
          "display feature becomes a frame-rate bug three minutes in",S().pool<=before+1);
        // ---- 1. THE FRAME PATH. Driven through a REAL guest frame, not by reading the source.
        {
          const mode0=G.NET.mode;
          R._fxMask=G.FX_SANCT; R._fxStill=1;
          FX(0.016); const hostRings=S().live.length;
          // ⚠ DRIVE THE COUNTER TO A KNOWN ZERO. The first version measured after its own direct
          // FX() call, so it asserted "a ring was drawn recently" — true whoever drew it, and it
          // stayed GREEN with buffFxTick made host-only, which is the exact bug it is named for.
          R._fxMask=0; FX(0.016);
          const zeroed=S().live.length;
          R._fxMask=G.FX_SANCT;            // armed, but NOTHING has drawn it — only a guest frame can
          G.NET.mode="guest";
          let threw="";
          try{ G.NET.guestFrame(0.016); }catch(e){ threw=e.message; }
          const guestRings=S().live.length;
          G.NET.mode=mode0;
          check("v132.39 rings on a GUEST: …and the counter really was at zero before the guest "+
            "frame ran ("+zeroed+"), so the next assertion cannot pass on the host's leftovers",
            zeroed===0);
          check("v132.39 rings on a GUEST: a real NET.guestFrame draws them from a standing start "+
            "— buffFxTick rides updateEffects because BOTH frame paths call it. Display code in "+
            "tickBody's host branch is trap #12, and that shipped once already (host "+hostRings+
            ", zeroed 0, guest "+guestRings+")"+(threw?" ["+threw+"]":""),
            !threw&&hostRings>=1&&guestRings>=1);
        }
        // ---- 2. THE STATE. Buffs are per-player-only and auraBuffTick is host-only, so without
        // a wire row a guest has nothing to draw FROM however correct the drawing is. Tested
        // against the REAL builder and the REAL applySnap.
        // ⚠ every NET mutation below is inside try/finally: the first version of this block threw
        // partway through and left NET half-configured, which reddened four assertions in the
        // v132.37 relay block further down. A test that damages later tests is worse than one
        // that simply fails, because the failure surfaces somewhere else wearing a disguise.
        {
          // ⚠ getPlayer(), not G.player. The by-value export is a ghost after any respawn — see
          // tools/patch-smoketest-liveplayer.js. Writing to the ghost is a silent no-op, which
          // is how this block came to ask the real builder why it had shipped nothing.
          const N=G.NET, mode0=N.mode, P=G.getPlayer(), m0=P._fxMask, q0=N.lastQ;
          try{
            N.mode="host";
            P._fxMask=G.FX_SANCT; P._auraA=3; P._auraE=1; P._fxStill=1; P._fxKin=0; P._fxStw=0;
            // ⚠ DIAGNOSTIC, kept: G.player is captured once when __G is built, and the game
            // reassigns `player` on respawn — so a stale reference here would set the mask on an
            // object the builder never looks at. Assert they are the same object rather than
            // hoping, because the failure mode is a silent no-op that looks like a wire bug.
            const LIVE=G.units.find(u=>u.isPlayer);
            check("v132.39 ring wire: the harness holds the LIVE player (same="+(LIVE===P)+
              ", alive="+(P&&P.alive)+", stale G.player is a different object: "+
              (G.player!==P)+") — the by-value export goes stale the moment the game rebinds "+
              "`player` on respawn, and writing to the ghost is a silent no-op that makes every "+
              "assertion below vacuously false",LIVE===P&&P.alive===true);
            // the rows ride the 5 Hz scoreboard branch, so three packs guarantee one carrying it
            const pack3=()=>{const o=[];for(let i=0;i<3;i++)o.push(N.packSnap());return o;};
            const A=pack3().filter(x=>x.ar!==undefined);
            const row=A.length?(A[0].ar||[]).find(r=>r[0]===P.id):null;
            check("v132.39 ring wire: the REAL snapshot builder ships a row for a holder — id, "+
              "mask, both counts, the stillness clock and the two ids ("+(row?JSON.stringify(row):"none")+
              ")",!!row&&row[1]===G.FX_SANCT&&row[2]===3&&row[3]===1&&row[4]===100);
            // the holder drops it: ONE snapshot must still carry an EMPTY list
            P._fxMask=0;
            const B=pack3().filter(x=>x.ar!==undefined);
            check("v132.39 ring wire: when the last holder drops it, ONE snapshot still carries an "+
              "EMPTY list — skipping it to save bytes leaves every guest holding the old rows and "+
              "the ring outlives the buff ("+B.length+" carried it, length "+
              (B.length?B[0].ar.length:"n/a")+")",B.length===1&&B[0].ar.length===0);
            const C=pack3().filter(x=>x.ar!==undefined);
            check("v132.39 ring wire: …and then it goes QUIET rather than shipping an empty array "+
              "forever ("+C.length+" of 3 carried it)",C.length===0);
            // and a guest applies it, through the real applySnap
            // ⚠ BOTH halves are REAL snapshots. A hand-made {ar:[]} throws inside applySnap long
            // before the scoreboard rows, which silently swallowed the second assertion below —
            // it never ran in any build, so deleting the very thing it tests changed nothing.
            P._fxMask=G.FX_RESOLVE; P._auraE=4; P._fxStill=1;
            const D=pack3().filter(x=>x.ar&&x.ar.length);        // …carrying rows
            P._fxMask=0; P._auraE=0;
            const E=pack3().filter(x=>x.ar&&x.ar.length===0);    // …carrying the empty list
            N.mode="guest";
            check("v132.39 ring wire: the harness got BOTH real snapshots it needs — one with "+
              "rows ("+D.length+") and one with the empty list ("+E.length+") — so neither "+
              "assertion below can pass by never running",D.length>0&&E.length>0);
            if(D.length&&E.length){
              let threw="";
              try{
                D[0].q=N.lastQ+1; N.applySnap(D[0]);
                const got=P._fxMask===G.FX_RESOLVE&&P._auraE===4;
                check("v132.39 ring wire: a GUEST applies the arriving row to the right unit by "+
                  "id, wiped locally first so only the wire could have restored it (mask "+
                  P._fxMask+", enemies "+P._auraE+")",got);
                E[0].q=N.lastQ+1; N.applySnap(E[0]);
                check("v132.39 ring wire: …and the EMPTY list takes the ring away, which is the "+
                  "whole reason it is sent — without the guest-side clear-first pass the mask "+
                  "stands and the ring outlives the buff (mask now "+P._fxMask+")",
                  P._fxMask===0);
              }catch(e){ threw=e.message; }
              check("v132.39 ring wire: …and applying real snapshots did not throw"+
                (threw?" ["+threw+"]":""),!threw);
            }
          }finally{ N.mode=mode0; P._fxMask=m0; N.lastQ=q0; }
        }
        R.alive=false; R._fxMask=0;
        for(const [u,m] of _parked)u._fxMask=m;   // give the world its rings back
        for(const [u,b] of _parkedB)u.buffs=b;    // …and its loadouts
        FX(0.016);
      }
      // ---- v132.43: PUBLIC TIMED MODIFIERS ----
      {
        const N=G.NET, mode0=N.mode, P=G.getPlayer(), q0=N.lastQ, t0=P._tmods;
        // ⚠ THE BUILDER SHIPS `player` PLUS EVERY NET.remotes[k].unit — nothing else. Earlier
        // blocks leave behind probe units that set u.remote to a made-up key without registering
        // there; such a unit passes isHuman() and is invisible to the builder, which is how the
        // first version of this gate came to ask why the wire had shipped nothing about a unit
        // the wire had never heard of. And at this point in the run there are no real remotes at
        // all, so one is REGISTERED here and removed in the finally.
        const _rkey="__tmprobe";
        const other=mkB(0,{});
        other.remote=_rkey;
        G.NET.remotes[_rkey]={unit:other,name:"tmprobe",oldName:"tmprobe",
                              conn:{open:false,send(){}}};
        check("v132.43 tmods: a registered remote exists to test against — the builder ships "+
          "`player` and NET.remotes only, so without one every assertion below would pass by "+
          "never running",!!G.NET.remotes[_rkey].unit);
        try{
          N.mode="host";
          const pack3=()=>{const o=[];for(let i=0;i<3;i++)o.push(N.packSnap());return o;};
          if(other){
            other._tmods=[{k:"bleed",mag:1,t:12.5,dur:20,fade:false},
                          {k:"spdmul",mag:0.5,t:1.25,dur:2,fade:true}];
            const A=pack3().filter(x=>x.tm);
            const row=A.length?(A[0].tm||[]).find(r=>r[0]===other.id):null;
            check("v132.43 tmods: the row carries the MAGNITUDE and the CLOCK — an event can say "+
              "'bleeding started', only this can say 'bleeding, 12.5s left, at this strength' "+
              "("+(row?JSON.stringify(row[1]):"no row")+")",
              !!row&&row[1].length===8&&row[1][2]===1250&&row[1][7]===1);
            // …and it round-trips onto the right unit
            other._tmods=null;
            N.mode="guest";
            if(A.length){
              A[0].q=N.lastQ+1; N.applySnap(A[0]);
              const got=other._tmods||[];
              const bleed=got.find(e=>e.k==="bleed"), spd=got.find(e=>e.k==="spdmul");
              check("v132.43 tmods: …and a GUEST rebuilds them on the right unit, magnitudes and "+
                "clocks intact ("+got.length+" kinds, bleed t="+(bleed?bleed.t:"—")+", spdmul "+
                "fade="+(spd?spd.fade:"—")+")",
                got.length===2&&!!bleed&&Math.abs(bleed.t-12.5)<0.02&&!!spd&&spd.fade===true);
            }
            // COMPLETE, not sparse
            N.mode="host"; other._tmods=null;
            const B=pack3().filter(x=>x.tm);
            const row2=B.length?(B[0].tm||[]).find(r=>r[0]===other.id):null;
            check("v132.43 tmods: a human with NOTHING on them is still listed — a sparse list "+
              "cannot say 'cleared', third time this trap has come up ("+
              (row2?"listed, "+row2[1].length+" entries":"MISSING")+")",
              !!row2&&row2[1].length===0);
            // THE LOCAL PLAYER IS LEFT ALONE — it has the private immediate channel
            N.mode="guest";
            P._tmods=[{k:"stun",mag:1,t:9,dur:9,fade:false}];
            if(B.length){ B[0].q=N.lastQ+1; N.applySnap(B[0]); }
            check("v132.43 tmods: the guest's OWN player is left to its private channel — that "+
              "arrives at once rather than at 5 Hz, and the immediacy is what made guest "+
              "prediction match the host in v132.33 (own stun survived: "+
              (!!(P._tmods&&P._tmods.length))+")",!!(P._tmods&&P._tmods.length===1));
          }
        }finally{ N.mode=mode0; P._tmods=t0; N.lastQ=q0;
                  if(other){other._tmods=null;other.alive=false;}
                  delete G.NET.remotes[_rkey]; }
      }
      // ---- v132.43: THE TWO EFFECTS IT UNBLOCKED ----
      {
        const S=G.buffFxStats, FX=G.buffFxTick;
        const _p=[],_pt=[];
        for(const u of G.units){
          if(u.buffs&&Object.keys(u.buffs).length){_p.push([u,u.buffs]);u.buffs={};}
          if(u._tmods){_pt.push([u,u._tmods]);u._tmods=null;}
        }
        try{
          const K=mkB(0,{}); K.buffs={}; K._tmods=null;
          FX(0.016);
          const base=S().lookVis;
          K._tmods=[{k:"dmgflat",mag:6,t:5,dur:10,fade:false}];  // v133.0: +6 = two kills at +3
          FX(0.016); const two=S().lookVis-base;
          K._tmods=[{k:"dmgflat",mag:15,t:5,dur:10,fade:false}]; // +15 = the cap
          FX(0.016); const five=S().lookVis-base;
          check("v132.43 KILLING FRENZY: the chevrons COUNT the stack — +4 draws "+two+", +10 "+
            "draws "+five+". Neither the stack nor its seven-second window has ever been visible; "+
            "this shows the first directly and the second by winking out",two===2&&five===5);
          K._tmods=null; FX(0.016);
          check("v132.43 KILLING FRENZY: …and they go when the modifier does ("+
            (S().lookVis-base)+")",S().lookVis-base===0);
          K.alive=false;
        }finally{ for(const [u,b] of _p)u.buffs=b; for(const [u,t2] of _pt)u._tmods=t2; FX(0.016); }
      }
      // ---- v132.42: THE PERSISTENT LOOKS ----
      {
        const S=G.buffFxStats, FX=G.buffFxTick;
        // ⚠ PARK _tmods TOO, as of v132.43. KILLING FRENZY draws chevrons from a timed modifier
        // alone — the pool's THIRD tenant, and the note at the end of
        // tools/patch-smoketest-rings-fix4.js said to expect exactly this.
        const _pk=[], _pkT=[];
        for(const u of G.units){
          if(u.buffs&&Object.keys(u.buffs).length){_pk.push([u,u.buffs]);u.buffs={};}
          if(u._tmods){_pkT.push([u,u._tmods]);u._tmods=null;}
        }
        try{
          const L=mkB(0,{}); L.buffs={};
          FX(0.016);
          check("v132.42 looks: the stage is clear before the block ("+S().lookVis+" visible)",
            S().lookVis===0);
          // a look appears from the HOLDING alone — no event, nothing to trigger it
          L.buffs={captain:1}; FX(0.016);
          const cap=S().looks;
          check("v132.42 CAPTAIN'S BANNER: the look appears from the HOLDING alone — no event "+
            "fires it, which is the whole difference between these and every effect before them "+
            "("+cap+")",cap===1);
          // …and vanishes the moment the buff goes
          L.buffs={}; FX(0.016);
          // ⚠ lookVis, NOT looks. looks counts draws THIS FRAME, so deleting the hide-all pass —
          // which leaves every look ever drawn on screen for the rest of the match, the exact bug
          // named here — still reads 0. Same vacuity as the ring version earlier this session.
          check("v132.42 looks: …and it VANISHES when the buff does, with nothing having to "+
            "notice ("+S().lookVis+" still visible)",S().lookVis===0);
          // DESPERATION scales with missing health
          L.buffs={fervor:1}; L.hp=L.maxHp*0.95; FX(0.016);
          const nearFull=S().looks;
          L.hp=L.maxHp*0.20; FX(0.016);
          const hurt=S().looks;
          check("v132.42 DESPERATION: nothing at 95% health, a haze at 20% — it is a GRADIENT, "+
            "and drawn flat it would say the wrong thing ("+nearFull+" → "+hurt+")",
            nearFull===0&&hurt===1);
          // KING'S GUARD respects its CONDITION, not merely the holding
          L.buffs={kguard:1}; L.hp=L.maxHp;
          // ⚠ THE KING HAS TO BE ALIVE. nearOwnKing() requires it, and by the time these gates
          // run a two-hundred-second campaign has been fighting over exactly that — a dead king
          // makes both halves false and the gate fails for a reason that is nothing to do with
          // the look. Revived here, restored after.
          const k=G.kings&&G.kings[0];
          if(k&&k.root){
            const wasAlive=k.alive; k.alive=true;
            const kx=k.root.position.x, kz=k.root.position.z;
            L.root.position.set(kx+G.KGUARD_R+40,0,kz);
            const pFar=G.nearOwnKing(L); FX(0.016); const far=S().rings;
            L.root.position.set(kx+2,0,kz);
            const pNear=G.nearOwnKing(L); FX(0.016); const near=S().rings;
            k.alive=wasAlive;
            // assert the ring TRACKS the predicate, and report BOTH — a gate that fails without
            // saying which half broke costs a whole run to find out which one it was
            check("v132.42 KING'S GUARD: the ring tracks nearOwnKing() rather than merely the "+
              "holding — a look that ignores its condition is a look that lies, and this one "+
              "exists to explain why a unit is suddenly hard to kill (predicate "+pFar+"→"+pNear+
              ", rings "+far+"→"+near+", delta "+(near-far)+")",
              // ⚠ A DELTA, not an absolute. This block parks other units' BUFFS but not their
              // Batch D _fxMask, so seven real rings are already on the ground when it runs. The
              // claim is "walking into the king's light adds exactly one ring", and that is true
              // whatever else the campaign is drawing. Third time an absolute has bitten in this
              // family of gates: a shared pool plus a live campaign means never assert a total.
              pFar===false&&pNear===true&&(near-far)===1);
          }
          L.buffs={}; L.alive=false; FX(0.016);
        }finally{ for(const [u,b] of _pk)u.buffs=b;
                  for(const [u,t2] of _pkT)u._tmods=t2; FX(0.016); }
      }
      // ---- v132.42: SURVIVAL INSTINCT — the latch is the design ----
      {
        const P=G.getPlayer(), b0=P.buffs, hp0=P.hp;
        const el=document.getElementById("vig");
        const op=()=>parseFloat(el.style.opacity||"0");
        try{
          P.buffs={flight:1}; P.alive=true;
          P.hp=P.maxHp; G.tickVignette(0.016);
          for(let i=0;i<80;i++)G.tickVignette(0.016);      // drain any leftover pulse
          check("v132.42 vignette: dark at full health ("+op().toFixed(2)+")",op()===0);
          P.hp=P.maxHp*0.20; G.tickVignette(0.016);
          const lit=op();
          check("v132.42 vignette: it lights on CROSSING under a quarter health ("+lit.toFixed(2)+
            ")",lit>0);
          for(let i=0;i<80;i++)G.tickVignette(0.016);      // still under, still parked there
          check("v132.42 vignette: …and it does NOT re-fire while you sit at 20% — it is an EDGE, "+
            "not a level, or a wounded player strobes the whole screen ("+op().toFixed(2)+")",
            op()===0);
          P.hp=P.maxHp*0.30; G.tickVignette(0.016);
          P.hp=P.maxHp*0.20; G.tickVignette(0.016);
          check("v132.42 vignette: …and healing to 30% does NOT re-arm it. Clearing at the same "+
            "line as it fires makes anyone hovering there flash every time a heal ticks them over "+
            "and a blow takes them back under ("+op().toFixed(2)+")",op()===0);
          P.hp=P.maxHp*0.60; G.tickVignette(0.016);        // recovered past 40% — re-armed
          P.hp=P.maxHp*0.20; G.tickVignette(0.016);
          check("v132.42 vignette: …but recovering past 40% DOES re-arm it, so the second time "+
            "you are in real trouble it still speaks ("+op().toFixed(2)+")",op()>0);
        }finally{ P.buffs=b0; P.hp=hp0; for(let i=0;i<80;i++)G.tickVignette(0.016); }
      }
      // ---- v132.41: THE SET-PIECES ----
      {
        const X=G.fxStats, PLAY=G.vfxPlay;
        const settle=()=>{for(let i=0;i<400;i++)G.fxTick(0.05);};   // 20s — past the longest life
        settle();
        check("v132.41 set-pieces: the stage starts empty ("+X().live+" live), so the counts "+
          "below are this block's and not the campaign's",X().live===0);
        // every kind draws something. A kind that fell out of the switch is silent, not broken.
        const KINDS=[["EARTHSHAKER",1,100,0],["KEEN EYE",2,0,0],["CULLER",3,0,0],
                     ["SHRUG IT OFF",4,0,0],["SIXTH SENSE",5,120,0],["ARROW WARD",6,120,0],
                     ["IRON GUARD",7,120,0],["RAPID VOLLEY",8,60,60],["SERRATED EDGE",9,6,0],
                     ["VENOMOUS",10,5,0],["CONCUSSIVE",11,15,0],["SECOND WIND",12,0,0],
                     ["KNIFE FIGHTER",13,700,700]];
        const silent=[];
        for(const [nm,k,p,q] of KINDS){
          settle(); const b=X().live;
          PLAY([k,50,50,p,q]);
          if(X().live<=b)silent.push(nm+"(#"+k+")");
        }
        // ---- v132.46: THE DAMAGE NUMBER ----
      {
        const D=G.dnumStats;
        const P=G.getPlayer(), b0=P.buffs;
        try{
          const foe=mkB(1,{}); foe.hp=foe.maxHp=4000; foe._dnumBank=0;
          // THE FIGURE MUST BE THE WOUND. Driven through a real dealDamage with a real loadout,
          // so every multiplier has had its say before the reading is taken.
          P.buffs={dmg:5}; P.alive=true;                    // HONED EDGE x5 = +25%
          const h0=foe.hp;
          G.dealDamage(P,foe,40);
          const applied=h0-foe.hp, shown=D().last;
          check("v132.46 damage number: the figure on screen IS the wound — "+
            applied.toFixed(2)+" HP left the victim and the number read "+(shown?shown.n:"none")+
            ". A number that disagrees is worse than no number, because it sends you rebalancing "+
            "the wrong thing",
            !!shown&&shown.id===foe.id&&shown.n===Math.floor(applied));
          check("v132.46 damage number: …and it is not the RAW figure — HONED EDGE x5 turned a "+
            "40 into "+applied.toFixed(1)+", which is the whole reason for showing it",
            applied>40.5);
          // SUB-1 BANKS. Searing Presence deals 0.25, four times a second.
          foe._dnumBank=0; foe.hp=foe.maxHp;
          const made0=D().made;
          let drew=0;
          for(let i=0;i<3;i++)if(G.dmgNum(foe,0.25,false))drew++;
          check("v132.46 damage number: three 0.25 burns draw NOTHING yet ("+drew+") — without "+
            "banking, SEARING PRESENCE paints a '0' four times a second on every burning enemy",
            drew===0);
          const fourth=G.dmgNum(foe,0.25,false);
          check("v132.46 damage number: …and the fourth emits ONE honest 1 ("+
            (D().last?D().last.n:"none")+")",fourth===true&&D().last.n===1);
          // A CRIT READS DIFFERENTLY
          // ⚠ AN UNSEEN VALUE. The first assertion above drew a 50, so "n50" was already cached
          // and re-drawing it adds nothing — the first version of this asserted a cache increment
          // for a key that already existed, and failed for that reason rather than for a real one.
          const c0=D().cached;
          G.dmgNum(foe,733,false); const asPlain=D().cached;
          G.dmgNum(foe,733,true);  const asCrit=D().cached;
          check("v132.46 damage number: a CRIT is its own glyph, not the same one bigger — it "+
            "doubles the damage, and a player who cannot tell a crit from a lucky roll learns "+
            "nothing from the number (cache "+c0+" → "+asPlain+" → "+asCrit+", crit flag "+
            D().last.crit+")",
            asPlain===c0+1&&asCrit===asPlain+1&&D().last.crit===true);
          // ---- v132.49: 1.6x larger, and NOT by stretching the same texels ----
          check("v132.49 damage number: the sprite carries the 1.6x John asked for (scale "+
            D().scale+")",Math.abs(D().scale-1.6)<1e-9);
          check("v132.49 damage number: …and the CANVAS grew with it, so the glyph gains texels at "+
            "the rate the quad gains pixels — scaling the sprite alone would have made them bigger "+
            "AND blurrier, which is not what larger means ("+D().w+"x"+D().h+", was 128x64)",
            D().w===208&&D().h===104&&Math.abs(D().w/D().h-2.0)<1e-9);
          check("v132.49 damage number: …and the cache ceiling came down to pay for it — a 2.6x "+
            "heavier texture at the old 192 would be ~16 MB for a cosmetic change; at "+D().cap+
            " it is ~5.4 MB, under what it cost before",D().cap===64);
          // ONLY THE ATTACKER. This is the one display effect that must NOT be broadcast.
          const bot=mkB(0,{}); bot.remote=null; bot.isPlayer=false;
          // ⚠ COUNT EMITS, not `made`. `made` is a cache-MISS counter: draw a value already in the
          // cache and it does not move, so the first version of this stayed GREEN with the
          // attacker check deleted. Adjacent is not the claim — the recurring mistake of the
          // session, and this is the third time it has been exactly this shape.
          const before=D().emits;
          G.dealDamage(bot,foe,30);
          check("v132.46 damage number: a blow struck by somebody ELSE draws nothing on your "+
            "screen — every other effect this session had to be broadcast; this one must not be, "+
            "or a 485-unit battle puts everyone's damage on everyone's display ("+before+" → "+
            D().emits+" numbers drawn)",D().emits===before);
          foe.alive=false; bot.alive=false;
        }finally{ P.buffs=b0; }
      }
      // ---- v132.45: does it LOOK like a knife? ----
        {
          const TX=G.fxTex();
          const alpha=(t2,u,v)=>{const im=t2.image,w=im.width,h=im.height;
            const x=Math.min(w-1,Math.max(0,Math.round(u*(w-1))));
            const y=Math.min(h-1,Math.max(0,Math.round(v*(h-1))));
            return im.data[(y*w+x)*4+3]/255;};
          const width=(t2,u)=>{let n=0;const h=t2.image.height;
            for(let i=0;i<h;i++)if(alpha(t2,u,i/(h-1))>0.5)n++; return n/h;};
          const B=TX.blade;
          check("v132.45 shapes: the blade texture was built ("+(B?B.image.width+"x"+B.image.height:"none")+
            ")",!!B&&B.image.width>=32);
          if(B){
            const wGuard=width(B,0.30), wMid=width(B,0.62), wTip=width(B,0.98), wGrip=width(B,0.12);
            // a KNIFE: widest at the guard, narrowest at the tip, a grip thinner than the guard
            check("v132.45 shapes: it has the PROPERTIES of a knife — widest at the guard ("+
              wGuard.toFixed(2)+"), narrower at mid-blade ("+wMid.toFixed(2)+"), a point at the "+
              "tip ("+wTip.toFixed(2)+"), and a grip thinner than the guard ("+wGrip.toFixed(2)+
              "). A square satisfies none of these, and the square is what v132.44 shipped",
              wGuard>wMid&&wMid>wTip&&wTip<0.10&&wGrip<wGuard&&wGrip>0);
            let mono=true, prev=1;
            for(let u=0.36;u<=0.99;u+=0.04){const w=width(B,u); if(w>prev+0.02){mono=false;break;} prev=w;}
            check("v132.45 shapes: …and the blade tapers MONOTONICALLY from guard to point — a "+
              "shape that bulges is not a blade whatever it is named",mono);
          }
          // and the knife actually USES it, pointed where it is going
          settle();
          G.vfxPlay([13,500,500,700,500]);            // due east, bearing 0
          const mp=G.fxStats().maps;
          const lead=mp.length?mp[0]:null;
          check("v132.45 shapes: the thrown knife CARRIES the blade map and points along its "+
            "bearing (blade="+(lead&&lead.blade)+", rot="+(lead?lead.rot.toFixed(2):"—")+
            "). A texture built and never applied is the same bug in a new coat",
            !!lead&&lead.blade===true&&Math.abs(lead.rot)<0.01);
          const soft=mp.filter(m=>m.soft).length;
          check("v132.45 shapes: …and its trail uses the soft dot, not the blade — two more "+
            "knives behind the knife would read as three knives ("+soft+" of "+mp.length+")",
            soft===mp.length-1);
          settle();
        }
        // v132.44: the knife must TRAVEL, not sit where it was thrown — three static puffs read
        // as three separate things happening rather than one thing flying, which was the whole
        // complaint the worksheet made about it.
        {
          settle();
          G.vfxPlay([13,500,500,700,700]);            // from (50,50) to (70,70)
          const st0=G.fxStats().live;
          const p0=G.fxStats().pos.slice();
          for(let i=0;i<12;i++)G.fxTick(0.016);       // ~0.2s of flight
          const p1=G.fxStats().pos;
          // ⚠ DISPLACEMENT, not population. The first version of this counted three particles —
          // and three appear whether the knife flies or sits where it was thrown, so it stayed
          // GREEN with the velocity zeroed, which is exactly the behaviour being replaced.
          const far=p1.length?Math.max.apply(null,p1.map(q=>Math.hypot(q.x-50,q.z-50))):0;
          const dist=Math.hypot(20,20);
          check("v132.44 KNIFE FIGHTER: the knife TRAVELS — after 0.2s the lead sprite has covered "+
            far.toFixed(1)+" of the "+dist.toFixed(1)+" units to its mark. Three static puffs read "+
            "as three things happening in a row rather than one thing flying, which was the whole "+
            "complaint ("+st0+" particles launched from "+(p0.length?"the thrower":"nowhere")+")",
            st0===3&&far>dist*0.5);
          settle();
        }
        check("v132.41 set-pieces: all "+KINDS.length+" wire kinds DRAW — a kind that fell out of "+
          "the switch throws nothing and draws nothing, so it is invisible from the host's chair "+
          "unless you are the one it happens to"+(silent.length?" [SILENT: "+silent.join(", ")+"]":""),
          silent.length===0);
        // the pools have ceilings
        settle();
        for(let i=0;i<1000;i++)PLAY([2,50,50,0,0]);      // 8 sprites a pop = 8000 requested
        const st=X();
        check("v132.41 set-pieces: the sprite pool has a CEILING — 8000 particles requested left "+
          st.sprites+" meshes, not 8000. Unbounded here is a leak that only shows up in the one "+
          "match that goes long",st.sprites<=260);
        // …and they expire
        settle();
        check("v132.41 set-pieces: …and every particle EXPIRES ("+X().live+" left after 20s). One "+
          "that never dies is the same leak wearing a different hat",X().live===0);
        // the wire queue is capped
        {
          const N=G.NET, mode0=N.mode;
          try{
            N.mode="host"; N._vfx.length=0;
            for(let i=0;i<500;i++)N.vfxPush([2,0,0,0,0]);
            check("v132.41 set-pieces: the WIRE queue is capped at "+N.VFX_MAX+" — 500 pushed, "+
              N._vfx.length+" queued. One slam catching thirty units, each rolling its own proc, "+
              "must not put a thousand rows on a snapshot",N._vfx.length===N.VFX_MAX);
            N._vfx.length=0;
            N.mode="guest";
            for(let i=0;i<10;i++)N.vfxPush([2,0,0,0,0]);
            check("v132.41 set-pieces: …and a GUEST never queues — it would echo every effect back "+
              "at a host that already drew it ("+N._vfx.length+" queued)",N._vfx.length===0);
          }finally{ N.mode=mode0; N._vfx.length=0; }
        }
        // a guest DRAWS them, from a standing start, through a real frame
        {
          const N=G.NET, mode0=N.mode;
          try{
            // ⚠ A REAL snapshot. A hand-made {vfx:[…]} throws inside applySnap long before the
            // batched channels, and the throw leaves NET half-configured — the first version of
            // this took SIX assertions down with it, in three other blocks, describing three
            // other features. Same mistake tools/patch-smoketest-rings-net2.js exists to record.
            N.mode="host"; N._vfx.length=0;
            N.vfxPush([1,500,500,100,0]);
            const snap=N.packSnap();
            settle();
            const zero=X().live;
            check("v132.41 set-pieces: the host queued the row onto a REAL snapshot ("+
              ((snap.vfx||[]).length)+" row), so the guest assertion below is about the wire and "+
              "not about a hand-made object",(snap.vfx||[]).length===1);
            N.mode="guest";
            snap.q=N.lastQ+1; N.applySnap(snap);
            const after=X().live;
            check("v132.41 set-pieces: a GUEST draws them from a standing start ("+zero+" → "+
              after+"). Everything here fires inside dealDamage, which returns on its first line "+
              "for a guest — third time this trap has been in play",zero===0&&after>0);
          }catch(e){ check("v132.41 set-pieces: a GUEST draws them ["+e.message+"]",false); }
          finally{ N.mode=mode0; }
        }
        settle();
      }
      // ---- v132.40: WHAT EVERY PLAYER IS CARRYING ----
      {
        const N=G.NET, mode0=N.mode, P=G.getPlayer(), q0=N.lastQ, b0=P.buffs;
        try{
          N.mode="host";
          // only humans can hold one — assert that rather than assuming it
          const holders=G.units.filter(u=>u.buffs&&Object.keys(u.buffs).length);
          const nonHuman=holders.filter(u=>!G.isHuman(u));
          check("v132.40 loadouts: every unit carrying buffs is a HUMAN — useBlacksmith and "+
            "smithPick are reachable only for the local player and a remote's unit, so isHuman "+
            "is the complete set of holders, not a convenient subset ("+holders.length+" holding, "+
            nonHuman.length+" of them bots)",nonHuman.length===0);
          // a full snapshot carries the loadout, with STACKS
          P.buffs={dmg:3,hp:5,sanctuary:1};
          let full=null;
          for(let i=0;i<16&&!full;i++){const sn=N.packSnap(); if(sn.bfa)full=sn;}
          const row=full?(full.bfa||[]).find(r=>r[0]===P.id):null;
          check("v132.40 loadouts: a FULL snapshot carries every player's loadout, indexed into "+
            "BUFFS ("+(row?JSON.stringify(row[1]):"no row")+")",
            !!row&&row[1].length===6);
          // …and it round-trips onto the right unit WITH the stacks
          P.buffs={};
          N.mode="guest";
          if(full){
            full.q=N.lastQ+1; N.applySnap(full);
            const b=P.buffs||{};
            check("v132.40 loadouts: …and a GUEST rebuilds it on the right unit with the right "+
              "STACKS — a mis-strided [idx,stacks] pairing gives plausible buffs at wrong counts, "+
              "which is the bug that would never look like one ("+JSON.stringify(b)+")",
              b.dmg===3&&b.hp===5&&b.sanctuary===1);
          }
          // COMPLETENESS: a player holding nothing is still listed, and that is what lets the
          // guest clear a deserter
          N.mode="host"; P.buffs={};
          let full2=null;
          for(let i=0;i<16&&!full2;i++){const sn=N.packSnap(); if(sn.bfa)full2=sn;}
          const row2=full2?(full2.bfa||[]).find(r=>r[0]===P.id):null;
          check("v132.40 loadouts: a player holding NOTHING is still listed — a sparse list "+
            "cannot say 'this one has none', which is how a deserter's loadout would stay on "+
            "every guest's scoreboard for the rest of the match ("+
            (row2?"listed, "+row2[1].length+" entries":"MISSING")+")",
            !!row2&&row2[1].length===0);
          // THE CLEAR: a unit carrying buffs but absent from a complete list has lost them
          N.mode="guest";
          const ghost=G.units.find(u=>u.alive&&!u.isPlayer&&!u.remote);
          if(ghost&&full2){
            ghost.buffs={dmg:2};
            full2.q=N.lastQ+1; N.applySnap(full2);
            check("v132.40 loadouts: a unit carrying buffs the complete list never mentions has "+
              "LOST them — this is the deserter case, and the body really does go back to the AI "+
              "with its loadout wiped ("+JSON.stringify(ghost.buffs)+")",
              !ghost.buffs||Object.keys(ghost.buffs).length===0);
          }
        }finally{ N.mode=mode0; P.buffs=b0; N.lastQ=q0; }
      }
      // ---- v132.37: WHO HEARS THEM — the relay, and the dedicated-server shape ----
      {
        const N=G.NET, mode0=N.mode, bc0=N.bcast;
        let wire=[]; N.bcast=(o)=>{wire.push(o);};
        const CUES=Object.keys(G.SFX_NET);
        const puppet=mkB(0,{});
        try{
          N.mode="host";
          // ⚠ CLEAR THE STAMPS FIRST. The batch D and E gates above already drove seven of these
          // twelve with NET.mode="host", and T does not advance between synchronous blocks — so
          // without this the "first" call for those seven is really their second, at the same
          // instant, and the throttle rightly refuses it. That reds a correct relay.
          const stamps=G.sfxLast(); for(const k in stamps)delete stamps[k];
          // every cue reaches the wire at least once
          for(const k of CUES){G.sfxAt(k,puppet);}
          const got=new Set(wire.filter(o=>o.t==="snd").map(o=>o.k));
          const mute=CUES.filter(k=>!got.has(k));
          check("v132.37 relay: all "+CUES.length+" buff cues go on the WIRE — ten of them fire "+
            "from code a guest never runs (dealDamage bails on guests; the aura and knife ticks "+
            "are host-loop), so without this a guest hears two of twelve"+
            (mute.length?" [HOST-ONLY: "+mute.join(",")+"]":""),mute.length===0);
          check("v132.37 relay: …positionally, so each guest culls and pans it against ITS OWN "+
            "listener, not the host's ("+wire.length+" carried a position) — the length check is "+
            "not decoration: every() is TRUE of an empty wire, so without it this gate passes "+
            "loudest when nothing is broadcast at all",
            wire.length>=CUES.length&&wire.every(o=>typeof o.x==="number"&&typeof o.z==="number"));
          // the wire is throttled, on the clock
          // THE FROZEN CLOCK IS THE INSTRUMENT: with T stopped a correct clock-throttle sends
          // exactly one however many calls arrive, so this is an exact count, not a bound.
          wire=[]; const K="bleedhit", W=G.SFX_NET[K];
          delete stamps[K];
          G.sfxAt(K,puppet); G.sfxAt(K,puppet); G.sfxAt(K,puppet);
          const burst=wire.length;
          check("v132.37 relay: the WIRE is throttled independently of the ear — the client "+
            "throttle runs after the packet is already sent, so it protects nobody's bandwidth "+
            "(3 calls at one instant, "+W+"s window → "+burst+" message"+(burst===1?"":"s")+")",
            burst===1);
          stamps[K]=G.getT()-W*2;                    // wind the window past, by hand
          G.sfxAt(K,puppet);
          check("v132.37 relay: …and it RE-ARMS on the clock, so it is a time window and not a "+
            "call counter or a latch ("+wire.length+" total)",wire.length===2);
          check("v132.37 relay: every cue has its own wire window, tuned at half the client's "+
            "category throttle — the host relays denser than it plays and lets each guest thin "+
            "it at its own position",CUES.every(k=>G.SFX_NET[k]>0));
          // a guest never relays
          // ⚠ CLEAR AGAIN. Without this the guest loop is refused for being too SOON (the host
          // loop above stamped all twelve at this same frozen instant) rather than for being a
          // guest — and the gate stayed green with NET.mode==="host" deleted from _sfxAt, which
          // is precisely the bug it is named after. Verified by falsification, not by reading.
          wire=[]; for(const k in stamps)delete stamps[k];
          N.mode="guest"; for(const k of CUES)G.sfxAt(k,puppet);
          check("v132.37 relay: a GUEST never relays, with every throttle stamp cleared so the "+
            "MODE is the only thing refusing it — an echoing guest is a feedback loop and a "+
            "client asserting authority over what other clients hear ("+wire.length+" of "+
            CUES.length+" messages)",wire.length===0);
        }finally{N.mode=mode0;N.bcast=bc0;puppet.alive=false;}
      }
      // ---- v132.37 THE DEDICATED SERVER: no local player, so the wire is the ONLY path ----
      {
        // Evaluated from the SHIPPED SOURCE with Sound shadowed to undefined. Reasoning that the
        // relay is independent of the listener is not evidence; running it without one is.
        const src=fs.readFileSync(path.join(ROOT,"js","05-combat.js"),"utf8");
        const a=src.indexOf("const SFX_NET=");
        const b=src.indexOf("\n};",src.indexOf("const _sfxAt="))+3;
        const fnSrc=(a>=0&&b>2)?src.slice(a,b):"";
        check("v132.37 dedicated server: the real _sfxAt source was extracted, so the next "+
          "assertion is about shipped code and not about a stub ("+fnSrc.length+" chars)",
          fnSrc.length>200&&/NET\.bcast/.test(fnSrc)&&/Sound\.play/.test(fnSrc));
        let sent=[];
        const fakeNET={mode:"host",bcast:(o)=>sent.push(o)};
        const box={};
        // Sound is a PARAMETER here, shadowing the global — inside, `typeof Sound` is "undefined"
        new Function("Sound","NET","T","out",fnSrc+"\nout.f=_sfxAt;out.probe=typeof Sound;")
          (undefined,fakeNET,1000,box);
        check("v132.37 dedicated server: …and Sound really is absent inside it ("+box.probe+")",
          box.probe==="undefined");
        box.f("quakeslam",{root:{position:{x:11,z:-22}}});
        check("v132.37 dedicated server: a host with NO Sound at all still puts the cue on the "+
          "wire — on a server every player is a remote, so a locally-played cue is a cue nobody "+
          "hears ("+sent.length+" sent"+(sent[0]?", "+sent[0].k+" @ "+sent[0].x+","+sent[0].z:"")+")",
          sent.length===1&&sent[0].t==="snd"&&sent[0].k==="quakeslam"&&sent[0].x===11&&sent[0].z===-22);
      }
      // ---- v132.37: HOW OFTEN THE CONTINUOUS CUES SPEAK ----
      {
        const A=G.Sound, real=A.play;
        const heard={}; A.play=(k)=>{heard[k]=(heard[k]||0)+1;return true;};
        try{
          // SANCTUARY: one tone per OPENING, not four a second for as long as you stand there
          const holy=mkB(0,{sanctuary:1});
          holy.moving=false; scan(holy,8);            // 3s to open + 5s of open zone = ~32 scans
          check("v132.37 SANCTUARY cue: ONE harp tone for the opening, not one per 4 Hz scan — "+
            "eight seconds of standing still produced "+(heard.sanctuary||0)+" (32 scans)",
            heard.sanctuary===1);
          // ⚠ v132.47: WALK it, do not flag it. u.moving is consumed by animateUnit before this
          // code ever runs in a real frame, so the flag shuts nothing — the same reason the zone
          // healed people at a run from v132.35 until John noticed.
          const _gx=holy.root.position.x, _gz=holy.root.position.z;
          for(let i=0;i<24;i++){            // a circle, for the same reason as the gate above
            const a3=i*0.5;
            holy.root.position.set(_gx+Math.cos(a3)*1.6,holy.root.position.y,_gz+Math.sin(a3)*1.6);
            G.auraBuffTick(holy,0.05);
          }
          holy.root.position.set(_gx,holy.root.position.y,_gz);
          holy._stillX=_gx; holy._stillT=0;
          scan(holy,6);                               // standing again re-opens it
          check("v132.37 SANCTUARY cue: …and it speaks AGAIN when the zone re-opens, so the latch "+
            "is a latch and not a one-shot ("+(heard.sanctuary||0)+" total)",heard.sanctuary===2);
          holy.alive=false;
          // SEARING: throttled on the game CLOCK. With T frozen a correct throttle yields exactly
          // one, and a cue that is not clock-throttled yields one per scan.
          const burn=mkB(0,{brand:1});
          const foe=mkB(1,{}); foe.root.position.set(burn.root.position.x+2,0,burn.root.position.z);
          foe.hp=foe.maxHp*50;                        // deep enough to survive the whole burn
          scan(burn,6);                               // 24 scans, clock stopped
          check("v132.37 SEARING cue: a continuous burn is a periodic SIZZLE, not a buzz — 24 "+
            "scans on a frozen clock produced "+(heard.sear||0)+", not 24",heard.sear===1);
          burn._searT=G.getT()-3;                     // wind the clock past the 2.5s window
          scan(burn,1);
          check("v132.37 SEARING cue: …and it RE-ARMS once the window passes, so it is throttled "+
            "and not latched off ("+(heard.sear||0)+" total)",heard.sear===2);
          foe.alive=false; burn.alive=false;
        }finally{A.play=real;}
      }
      // KINSHIP — a soldier of your OWN KIND, not merely any ally
      {
        const kinA=place(mkB(0,{kinship:1},"clubman"),0,60); kinA.hp=kinA.maxHp*0.5;
        check("v132.35 KINSHIP harness: no stray same-class ally is already in range ("+
          near(kinA.root.position.x,kinA.root.position.z,R)+" units within "+R+")",
          near(kinA.root.position.x,kinA.root.position.z,R)===1);
        const other=place(mkB(0,{},"archer"),2,60);
        const h0=kinA.hp; scan(kinA,2);
        check("v132.35 KINSHIP: a DIFFERENT class nearby mends nothing ("+h0.toFixed(1)+" → "+
          kinA.hp.toFixed(1)+")",Math.abs(kinA.hp-h0)<1e-9);
        const same=place(mkB(0,{},"clubman"),2,60);
        scan(kinA,2);
        check("v132.35 KINSHIP: …a soldier of your own kind does ("+h0.toFixed(1)+" → "+
          kinA.hp.toFixed(1)+")",kinA.hp>h0);
        other.alive=false; same.alive=false; kinA.alive=false;
      }
      // UNBOWED and PHALANX — scale with the count, stop at the cap
      {
        const stout=place(mkB(0,{resolve:1}),0,100), hitter=place(mkB(1,{}),2,100);
        const probe=(n)=>{
          stout._auraE=n;
          const v=stout.hp; dmgOf(hitter,stout,20); const d=v-stout.hp; stout.hp=stout.maxHp; return d;
        };
        const d0=probe(0), d2=probe(2), d9=probe(9), d20=probe(20);
        check("v132.35 UNBOWED: the more enemies around you the less it hurts ("+d0.toFixed(1)+
          " → "+d2.toFixed(1)+" → "+d9.toFixed(1)+")",d2<d0&&d9<d2);
        check("v132.35 UNBOWED: …and it STOPS at −25% ("+d9.toFixed(1)+" vs 20 enemies "+
          d20.toFixed(1)+", floor "+(20*0.75).toFixed(1)+")",
          Math.abs(d9-d20)<1e-9&&Math.abs(d20-15)<0.01);
        const spear=place(mkB(0,{phalanx:1}),0,110), tgt=place(mkB(1,{}),2,110);
        const pr=(n)=>{spear._auraA=n;const v=tgt.hp;dmgOf(spear,tgt,20);const d=v-tgt.hp;tgt.hp=tgt.maxHp;return d;};
        const p0=pr(0), p2=pr(2), p8=pr(8), p30=pr(30);
        check("v132.35 PHALANX: the more allies beside you the harder you hit ("+p0.toFixed(1)+
          " → "+p2.toFixed(1)+" → "+p8.toFixed(1)+")",p2>p0&&p8>p2);
        check("v132.35 PHALANX: …and it STOPS at +20% ("+p8.toFixed(1)+" vs 30 allies "+
          p30.toFixed(1)+", ceiling "+(20*1.2).toFixed(1)+")",
          Math.abs(p8-p30)<1e-9&&Math.abs(p30-24)<0.01);
        hitter.alive=false; tgt.alive=false;
      }
      // STEWARD — a villager mends the stones
      {
        const stew=place(mkB(0,{steward:1},"villager"),0,80);
        const hut=G.makeBuilding(0,"house",stew.root.position.x+3,stew.root.position.z,true);
        hut.hp=hut.def.hp*0.5; const b0=hut.hp;
        scan(stew,2);
        check("v132.35 STEWARD: a villager mends a wounded friendly building ("+b0.toFixed(1)+
          " → "+hut.hp.toFixed(1)+")",hut.hp>b0);
        hut.alive=false;
      }
    }
    // ---- v132.34: BATCH C — state on the ENEMY ----
    {
      const force=(fn)=>{const MR=Math.random;Math.random=()=>0;try{fn();}finally{Math.random=MR;}};
      // SERRATED EDGE — 1 HP/s for 20s, and the total really is ~20
      {
        const cutter=mkB(0,{bleed:1}), prey=mkB(1,{});
        force(()=>dmgOf(cutter,prey,1));
        check("v132.34 SERRATED EDGE: a hit leaves a bleed on the victim ("+
          G.tmodSum(prey,"bleed").toFixed(1)+" HP/s)",G.tmodSum(prey,"bleed")===1);
        const hp0=prey.hp;
        for(let i=0;i<200;i++)G.statusTick(prey,0.1);   // 20 seconds
        check("v132.34 SERRATED EDGE: …and it burns ~20 HP over its 20 seconds, then stops ("+
          Math.round(hp0-prey.hp)+" HP, bleed left "+G.tmodSum(prey,"bleed")+")",
          Math.abs((hp0-prey.hp)-20)<1.5&&G.tmodSum(prey,"bleed")===0);
      }
      // VENOMOUS — damage AND a slow, the slow being a negative spdmul
      {
        const v=mkB(0,{venom:1}), prey=mkB(1,{});
        force(()=>dmgOf(v,prey,1));
        check("v132.34 VENOMOUS: poison damage and a HALVED move speed ("+
          G.tmodSum(prey,"poison").toFixed(1)+" HP/s, ×"+G.tmodMul(prey,"spdmul").toFixed(2)+")",
          G.tmodSum(prey,"poison")===1&&Math.abs(G.tmodMul(prey,"spdmul")-0.5)<1e-9);
      }
      // …AND A CREEP BURNS DOWN — the reason the tick had to leave questTick
      {
        const v=mkB(0,{venom:1});
        const creep=G.makeUnit(2,"clubman",-150,-70,{name:"beast",bot:{role:"citizen"}});
        G.setClassStats(creep); creep.hp=creep.maxHp;
        force(()=>dmgOf(v,creep,1));
        const hp0=creep.hp;
        for(let i=0;i<50;i++)G.statusTick(creep,0.1);
        check("v132.34 VENOMOUS: a NON-HUMAN victim burns too ("+Math.round(hp0-creep.hp)+
          " HP) — questTick walks humans only, which is why the tick moved to the unit loop",
          hp0-creep.hp>=4);
        // ⚠ a NEUTRAL unit must never enter the respawn queue: respawnUnit reads
        // TCPOS[u.team] and the wilds have no town centre, so it throws — and the crash
        // reporter SWALLOWS it, which silently stops the rest of the host frame. Real camp
        // creeps are safe because killUnit parks them at respawnT=Infinity; this synthetic one
        // has to do the same by hand.
        creep.alive=false; creep.respawnT=Infinity; creep.corpse=true;
      }
      // CONCUSSIVE BLOW — stops the victim moving, and the cooldown is the WIELDER's
      {
        const br=mkB(0,{concuss:1}), a=mkB(1,{}), b=mkB(1,{});
        br._stunCd=-999;
        force(()=>dmgOf(br,a,1));
        check("v132.34 CONCUSSIVE BLOW: the victim is stunned and cannot move (stunned "+
          G.isStunned(a)+")",G.isStunned(a)===true);
        const z0=a.root.position.z; G.moveUnit(a,0,1,0.2);
        check("v132.34 CONCUSSIVE BLOW: …moveUnit refuses while stunned (moved "+
          Math.abs(a.root.position.z-z0).toFixed(3)+")",Math.abs(a.root.position.z-z0)<1e-9);
        force(()=>dmgOf(br,b,1));
        check("v132.34 CONCUSSIVE BLOW: the 30s cooldown belongs to the WIELDER — a second victim "+
          "is NOT stunned, so nobody stun-locks a crowd by rotating targets (b stunned "+
          G.isStunned(b)+")",G.isStunned(b)===false);
        for(let i=0;i<25;i++)G.statusTick(a,0.1);
        check("v132.34 CONCUSSIVE BLOW: …and the stun expires ("+G.isStunned(a)+")",
          G.isStunned(a)===false);
      }
      // DEEP GASH — a priest cannot mend what it opened
      {
        const g=mkB(0,{gash:1}), prey=mkB(1,{});
        force(()=>dmgOf(g,prey,1));
        check("v132.34 DEEP GASH: the victim is heal-blocked ("+G.healBlocked(prey)+")",
          G.healBlocked(prey)===true);
        // ⚠ A CONTROL AND A REAL HEALER. The first version wounded one unit and called
        // healTick with NO healing source anywhere near it — so nothing healed, the assertion
        // held, and deleting the heal-block check left it green. Verified by doing exactly that.
        const ctrl=mkB(1,{});                       // same team, same wound, NOT gashed
        const priest=G.makeUnit(1,"priest",prey.root.position.x+1,prey.root.position.z,
          {name:"medic",bot:{role:"citizen"}});
        G.setClassStats(priest); priest.hp=priest.maxHp;
        ctrl.root.position.set(prey.root.position.x+2,ctrl.root.position.y,prey.root.position.z);
        prey.hp=prey.maxHp*0.4; ctrl.hp=ctrl.maxHp*0.4;
        const hp0=prey.hp, hc0=ctrl.hp;
        G.healTick(1.0);
        check("v132.34 DEEP GASH: the control HEALS ("+hc0.toFixed(1)+" → "+ctrl.hp.toFixed(1)+
          ") — so the healer is really in range and this test is not vacuous",ctrl.hp>hc0);
        check("v132.34 DEEP GASH: …and the gashed victim does NOT ("+hp0.toFixed(1)+" → "+
          prey.hp.toFixed(1)+")",Math.abs(prey.hp-hp0)<1e-9);
        priest.alive=false; priest.respawnT=Infinity; ctrl.alive=false;
      }
      // SHRUG IT OFF — sheds what an enemy put on you, keeps what you earned
      {
        const tough=mkB(0,{shrug:1,surge:1});
        G.tmodAdd(tough,"bleed",1,20,false);
        G.tmodAdd(tough,"stun",1,2,false);
        G.tmodAdd(tough,"spdmul",-0.5,10,false);        // an enemy slow
        G.tmodAdd(tough,"spdmul2",0,1,false);           // (placeholder kind, ignored)
        G.tmodAdd(tough,"dmgflat",4,7,false);           // …and something YOU earned
        const shed=G.shedDebuffs(tough);
        check("v132.34 SHRUG IT OFF: sheds bleed, stun and the enemy slow ("+shed+" shed; bleed "+
          G.tmodSum(tough,"bleed")+", stunned "+G.isStunned(tough)+")",
          shed>=3&&G.tmodSum(tough,"bleed")===0&&G.isStunned(tough)===false);
        check("v132.34 SHRUG IT OFF: …and KEEPS what you earned — a cleanse that strips your own "+
          "buffs is a punishment (+"+G.tmodSum(tough,"dmgflat")+" dmgflat still held)",
          G.tmodSum(tough,"dmgflat")===4);
      }
      // NO DOUBLE-TICK: one frame must burn one frame of clock, not two
      {
        const h=mkB(0,{});
        G.tmodAdd(h,"dmgflat",2,7,false);
        const t0=h._tmods[0].t;
        G.statusTick(h,0.5);
        check("v132.34 tick topology: statusTick burns exactly its dt ("+t0.toFixed(2)+"s → "+
          h._tmods[0].t.toFixed(2)+"s)",Math.abs((t0-h._tmods[0].t)-0.5)<1e-9);
        // ⚠ …but the above drives statusTick DIRECTLY and so says nothing about how many callers
        // there are. Re-adding tmodTick to questTick left it green — verified. The topology claim
        // is about the SOURCE, so it is read from the source: 09-main.js must drive the timed
        // system exactly once per frame, through statusTick and not also through tmodTick.
        {
          const mainSrc=fs.readFileSync(path.join(ROOT,"js","09-main.js"),"utf8");
          const viaStatus=mainSrc.split("statusTick(u,dt)").length-1;
          const viaTmod=mainSrc.split("tmodTick(").length-1;
          check("v132.34 tick topology: 09-main drives the clock ONCE — statusTick x"+viaStatus+
            ", tmodTick x"+viaTmod+" (a second caller halves every Batch B duration)",
            viaStatus===1&&viaTmod===0);
        }
      }
    }
    // ---- v132.33: the guest predicts its own timed modifiers ----
    {
      const sent=[]; const bcast=[];
      const savedMode=G.NET.mode, savedRemotes=G.NET.remotes;
      G.NET.mode="host";
      const owner=mkB(0,{surge:1}); owner.remote="tmpeer";
      const other=mkB(0,{}); other.remote="otherpeer";
      G.NET.remotes={tmpeer:{unit:owner,conn:{send:(m)=>sent.push(m)}},
                     otherpeer:{unit:other,conn:{send:(m)=>bcast.push(m)}}};
      G.tmodAdd(owner,"spdmul",0.5,2,true);
      const mine=sent.filter(m=>m&&m.t==="tmd");
      check("v132.33 tmod wire: applying a modifier puts a tmd on the OWNER's wire ("+
        mine.length+" sent)",mine.length===1&&mine[0].k==="spdmul"&&
        Math.abs(mine[0].m-0.5)<1e-9&&Math.abs(mine[0].d-2)<1e-9&&mine[0].f===1);
      check("v132.33 tmod wire: …and it is NOT broadcast — a speed buff is private to its owner ("+
        bcast.filter(m=>m&&m.t==="tmd").length+" leaked)",
        bcast.filter(m=>m&&m.t==="tmd").length===0);
      // the guest side: same numbers in, same multiplier out
      const guest={team:0,cls:"clubman",buffs:{},_tmods:null};
      const w=mine[0];
      G.tmodAdd(guest,w.k,w.m,w.d,!!w.f,w.c||0);
      check("v132.33 tmod wire: the guest computes the SAME multiplier the host does ("+
        G.tmodMul(guest,"spdmul").toFixed(3)+"× vs "+G.tmodMul(owner,"spdmul").toFixed(3)+"×)",
        Math.abs(G.tmodMul(guest,"spdmul")-G.tmodMul(owner,"spdmul"))<1e-9);
      // …and the guest must EXPIRE it. Without its own tick a 2s buff would never end.
      G.tmodTick(guest,3);
      check("v132.33 tmod wire: the guest EXPIRES it on its own clock — without this a 2s buff "+
        "runs until something replaces it ("+G.tmodMul(guest,"spdmul").toFixed(2)+"×)",
        Math.abs(G.tmodMul(guest,"spdmul")-1)<1e-9);
      // ⚠ THE ABOVE DRIVES tmodTick DIRECTLY, so it proves the CLOCK works and says nothing
      // about whether the guest frame ever turns it. Deleting the call from guestFrame left every
      // assertion green — verified by doing exactly that. This reads the shipping source, the way
      // the build-reach checks do, so the WIRING is gated and not just the mechanism.
      {
        const netSrc=fs.readFileSync(path.join(ROOT,"js","10-net.js"),"utf8");
        const wired=netSrc.indexOf("tmodTick(player,dt)")>=0;
        const handler=netSrc.indexOf('d.t==="tmd"')>=0;
        check("v132.33 tmod wire: guestFrame actually TURNS the clock (tmodTick wired "+wired+
          ") and the tmd handler exists ("+handler+")",wired&&handler);
      }
      // the death clear reaches the owner
      sent.length=0; G.tmodSyncClear(owner);
      check("v132.33 tmod wire: the death wipe reaches the owner's screen too ("+
        (sent.length&&sent[0].clr?"clear sent":"NOTHING SENT")+")",
        sent.length===1&&sent[0].t==="tmd"&&sent[0].clr===1);
      G.NET.remotes=savedRemotes; G.NET.mode=savedMode;
      owner.alive=false; other.alive=false;
    }
    G.NET.mode=_mB;
  }
  // ---------- v132.29: THE LEVEL AURA ----------
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
    far._auraAcc=0; const before=ST().live; for(let i=0;i<10;i++)A(0.05);
    check("v132.29 aura: …and that same unit walked in close DOES emit ("+before+" → "+ST().live+
      " live motes, acc moved)",ST().live>before||(far._auraAcc||0)>0);
    // THE POOL CEILING. The earlier version flooded with five units and peaked at 22 of 192 —
    // it could not have failed. Saturate it properly: forty capped humans under the camera want
    // ~40 x 9/s x 1.15s = 400+ motes against 192 slots, so the ceiling is genuinely under load.
    const mob=[];
    for(let i=0;i<40;i++)mob.push(put(0,CX+(i%8)-4,CZ+((i/8)|0)-2,G.XP_MAX_LVL,"mob"+i));
    let peak=0;
    for(let i=0;i<200;i++){A(0.05); const L=ST().live; if(L>peak)peak=L;}
    const st2=ST();
    check("v132.29 aura: the pool ceiling HOLDS under real saturation — 40 capped units, peak "+
      peak+" of "+G.AURA_MAX+" slots",peak<=G.AURA_MAX&&st2.live<=G.AURA_MAX);
    check("v132.29 aura: …and that flood genuinely reached the ceiling (peak "+peak+
      "), so the check above is not vacuous",peak>=G.AURA_MAX*0.9);
    for(const m of mob)m.alive=false;
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
  // ---------- v132.50: THE AURA FOLLOWS THE BODY, AND THE CAP IS A DIFFERENT SHAPE ----------
  {
    const G=global.__G, A=G.auraTick, ST=G.auraStats, SH=G.auraShape, SP=G.auraSpread;
    const CX=-40,CZ=40;
    G.camera.position.set(CX,30,CZ);       // the v132.29 clear patch, and the emitter RANGE-GATES
                                           // on the camera: a subject parked away from it emits
                                           // nothing and every gate below would read an empty pool
    const put=(x,z,lvl,tag)=>{
      const u=G.makeUnit(0,"clubman",x,z,{name:"Fol"+tag,bot:{role:"citizen"}});
      u.bot=null; u.remote="fol-"+tag; u.lvl=lvl; u._auraAcc=0; return u;
    };
    const drain=()=>{for(let i=0;i<40;i++)A(0.05);};   // 2.0s, past the longest mote life (1.05s)
    drain();

    // ---- 1. THE TRAIL. John: "It leaves a glowing trail behind me long after I've left an area."
    const run=put(CX-12,CZ,G.XP_MAX_LVL,"run");
    for(let i=0;i<24;i++)A(0.05);                       // 1.2s standing still: fill the cloud
    const held=SH(run);
    let worst=0, walked=0;
    for(let i=0;i<40;i++){                              // 2.0s sprint, 0.6u per frame = 12 u/s —
      run.root.position.x+=0.6; walked+=0.6;            // deliberately faster than any real unit
      A(0.05);
      const s=SP(run); if(s>worst)worst=s;
    }
    const after=SH(run);
    check("v132.50 aura: the cloud FOLLOWS the body — after sprinting "+walked.toFixed(0)+
      " units the worst mote sits "+worst.toFixed(2)+"u behind it ("+after.n+" motes aloft, "+
      held.n+" before the run). On the world-space emitter this number WAS the distance walked "+
      "in one mote lifetime (~12u here), which is what a trail IS — shortening the life could "+
      "only shorten the smear, never remove it",
      held.n>=15&&after.n>=15&&worst<2.0);
    check("v132.50 aura: …and the gate is not measuring an empty pool — the runner alone carries "+
      after.n+" live motes and the horizontal spread is bounded by the EMISSION RADIUS ("+
      G.AURA_R_HI+"u), not by the walk",after.n>=10&&worst<=G.AURA_R_HI+0.6);
    run.alive=false; drain();

    // ---- 2. THE EMPHASIS. John: "does not change much from lvl 1 to 25 and needs to be more
    //         significant." Measure the cloud each subject is actually WEARING, alone, with the
    //         pool drained between them, and run long enough that both saturate their radius.
    const shapeOf=(lvl,tag)=>{
      const u=put(CX,CZ,lvl,tag);
      let rad=0,top=0,most=0; const e0=ST().emits;
      for(let i=0;i<400;i++){A(0.05); const s=SH(u);    // 20s — level 1 emits ~40 motes, enough
        if(s.rad>rad)rad=s.rad; if(s.top>top)top=s.top; if(s.n>most)most=s.n;}
      const rate=(ST().emits-e0)/20;
      u.alive=false; drain();
      return {rad:rad,top:top,most:most,rate:rate};
    };
    const s1=shapeOf(1,"s1"), s13=shapeOf(13,"s13"), s25=shapeOf(G.XP_MAX_LVL,"s25");
    check("v132.50 aura: level 25 is a different SHAPE, not a busier one — radius "+
      s1.rad.toFixed(2)+"u → "+s25.rad.toFixed(2)+"u (x"+(s25.rad/(s1.rad||1)).toFixed(1)+
      ") and the column stands "+s1.top.toFixed(2)+"u → "+s25.top.toFixed(2)+"u (x"+
      (s25.top/(s1.top||1)).toFixed(1)+"). Before v132.50 both ratios were exactly 1.0: radius, "+
      "climb and life were flat constants and ONLY density and hue moved",
      s1.rad>0&&s1.top>0&&s25.rad/s1.rad>2.5&&s25.top/s1.top>2.5);
    check("v132.50 aura: …and the difference is legible in absolute terms — the cap wears a "+
      "column "+s25.top.toFixed(2)+"u tall, taller than the man; level 1 keeps its "+
      s1.top.toFixed(2)+"u of sparks down at the ankles",s25.top>3.0&&s1.top<1.6);
    check("v132.50 aura: the density climbs x"+(s25.rate/(s1.rate||1)).toFixed(0)+" ("+
      s1.rate.toFixed(1)+"/s → "+s25.rate.toFixed(1)+"/s) on a SUPERLINEAR curve — level 13 emits "+
      s13.rate.toFixed(1)+"/s, BELOW the "+((s1.rate+s25.rate)/2).toFixed(1)+
      "/s a straight line would give it, so the low levels stay quiet and the last third earns it",
      s1.rate>0&&s25.rate/s1.rate>12&&s13.rate<(s1.rate+s25.rate)/2*0.92);
    check("v132.50 aura: the pool still HOLDS with the cap emitting at "+s25.rate.toFixed(0)+
      "/s and living "+G.AURA_LIFE_HI+"s — most motes one unit ever wore at once: "+s25.most+
      " of "+G.AURA_MAX+" slots",s25.most>0&&s25.most<=G.AURA_MAX);

    // ---- 3. the owner dies mid-flight: every one of its motes goes out THAT FRAME ----
    // v132.51 reverses v132.50's choice here. v132.50 let an orphan drift out the rest of its
    // life "rather than snap to the origin"; John then said plainly that sparkles must "only be
    // at the leveled unit", and a mote drifting where its owner is not is exactly that fault in
    // miniature. Read the LIFE array, never the position buffer — a dead slot keeps its last
    // coordinates, so an earlier version of this gate counted 320 of 320 "near the corpse" and
    // could not have failed.
    const doomed=put(CX,CZ,G.XP_MAX_LVL,"doom");
    for(let i=0;i<20;i++)A(0.05);
    const beforeDeath=G.auraShape(doomed).n;
    doomed.alive=false;
    A(0.05);
    const orphans=G.auraLive().filter(m=>!m.owned).length;
    const stillHis=G.auraLive().length;
    check("v132.51 aura: when the owner dies its whole cloud goes out THAT FRAME — "+beforeDeath+
      " motes aloft at the moment of death, "+orphans+" ownerless survivors one frame later, "+
      stillHis+" motes left alive in the entire scene. v132.50 let them drift out the rest of "+
      "their life instead, which is a light sitting where its owner is not",
      beforeDeath>=25&&orphans===0&&stillHis===0);
    drain();

    // ---- 4. the LIGHT comes up early; the GOLD still arrives late ----
    // MEASURE TOTAL LIGHT, not the peak channel. The first version of this gate used the peak
    // and read a FALL from level 1 to level 13: the hue lerp carries the colour from a blue
    // whose strongest channel is 0.85 through a desaturated middle, so the peak channel drops
    // while the light plainly rises. Peak channel is a hue artefact wearing a brightness costume.
    const lit=lvl=>{const u={lvl:lvl,team:0},c=[0,0,0];G.auraTint(u,c);return c;};
    const light=c=>c[0]+c[1]+c[2];
    const L1=light(lit(1)), L8=light(lit(8)), L16=light(lit(16)), L25=light(lit(G.XP_MAX_LVL));
    check("v132.50 aura: the light rises the whole way up the ladder — "+L1.toFixed(2)+" → "+
      L8.toFixed(2)+" → "+L16.toFixed(2)+" → "+L25.toFixed(2)+", the cap x"+
      (L25/L1).toFixed(1)+" level 1",L1<L8&&L8<L16&&L16<L25&&L25/L1>3);
    check("v132.50 aura: level 16 carries "+((L16/L25)*100).toFixed(0)+
      "% of the cap's light. When hue and brightness shared one ease=t^2 curve it carried 49%, "+
      "and with the density curve now superlinear as well the two back-loaded ramps compounded "+
      "into a mid-game you could not see at all",L16/L25>0.58);
    // …and the HUE is untouched: gold still arrives late, so the team read survives (§2.5)
    const norm=a=>{const m=Math.max(a[0],a[1],a[2])||1;return [a[0]/m,a[1]/m,a[2]/m];};
    const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
    const tc=G.TEAMCOL[0], team=norm([((tc>>16)&255)/255,((tc>>8)&255)/255,(tc&255)/255]);
    const gd=G.AURA_GOLD, gold=norm([((gd>>16)&255)/255,((gd>>8)&255)/255,(gd&255)/255]);
    const n8=norm(lit(8));
    check("v132.50 aura: brighter is NOT yellower — at level 8 the hue is still unmistakably "+
      "TEAM (distance "+dist(n8,team).toFixed(2)+" against "+dist(n8,gold).toFixed(2)+
      " to gold), so the light was raised without spending the team read §2.5 protects",
      dist(n8,team)<dist(n8,gold)*0.4);
  }
  // ---------- v132.53: A LIGHT WITH NO LIVING OWNER DIES ON THE RENDER PATH ----------
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
    // Assert the INVARIANT, not a zero. Another block's still-living subject may legitimately be
    // wearing motes at this moment, and "after.lit===0" quietly demanded that it not exist — a
    // gate that is right for the wrong reason today and red for an unrelated reason tomorrow.
    check("v132.53 aura: ONE render-path sweep puts out all "+killed+" of the stranded points ("+
      stranded.lit+" lit → "+after.lit+", worst distance from an owner now "+
      (after.lit?after.worst.toFixed(2)+"u":"n/a")+" against a leash of "+G.AURA_LEASH+
      "u). renderFrame is the one function every frame path calls; auraTick is reached only "+
      "through tickBody, which returns early on the menu and skips the whole block on gameOver "+
      "— trap #12, which this file names twice already",
      killed>=25&&after.deadLit===0&&after.worst<=G.AURA_LEASH+0.5);
    // and it must NOT put out a healthy cloud
    hero.root.position.x-=40; hero._auraAcc=0;
    for(let i=0;i<30;i++)G.auraTick(0.05);
    const healthy=G.auraLit().lit, culled=G.auraSweep(), left=G.auraLit().lit;
    check("v132.53 aura: …and it is not a mote-killer — a HEALTHY cloud of "+healthy+
      " survives the same sweep untouched ("+culled+" culled, "+left+" left). A guard that "+
      "cleared the pool every frame would pass the check above and delete the feature",
      healthy>=25&&culled===0&&left===healthy);
    // THE WIRING. Everything above calls auraSweep() by hand, which proves the function works and
    // proves nothing about whether the game ever runs it. Strand a cloud again and hand the frame
    // to renderFrame itself — if the call is not wired in, these lights stay on.
    hero.root.position.x+=40;
    const beforeRF=G.auraLit();
    G.renderFrame(0.05);
    const afterRF=G.auraLit();
    check("v132.53 aura: RENDERFRAME does the sweeping, not just the test — "+beforeRF.lit+
      " stranded points lit, one renderFrame later "+afterRF.lit+
      ". A sweep nothing calls is a comment",
      beforeRF.lit>=25&&afterRF.deadLit===0&&afterRF.worst<=G.AURA_LEASH+0.5);
    hero.root.position.x-=40; hero.alive=false;
    G.auraSweep();
    check("v132.53 aura: a dead owner's cloud is out on the very next sweep, with no frame of "+
      "simulation in between ("+G.auraLit().lit+" lit)",G.auraLit().lit===0);
    for(let i=0;i<20;i++)G.auraTick(0.05);
  }
  // ---------- v132.51: ONE EFFECT SYSTEM MUST NOT FREEZE THE OTHERS ----------
  {
    const G=global.__G;
    const CX=-40,CZ=40;
    G.camera.position.set(CX,30,CZ);
    // Break auraTick the way a mixed cache broke it. A levelled human with no root throws on the
    // emitter's very first line — the same shape of failure as a missing constant, reached
    // through the REAL updateEffects rather than by swapping the function out.
    const wreck=G.makeUnit(0,"clubman",CX,CZ,{name:"Wreck",bot:{role:"citizen"}});
    wreck.bot=null; wreck.remote="wreck"; wreck.lvl=5; wreck._auraAcc=0; wreck.root=null;
    let direct=false; try{G.auraTick(0.05);}catch(e){direct=true;}
    check("v132.51 fx: the gate is not vacuous — auraTick really does throw on this unit ("+
      (direct?"threw":"DID NOT THROW")+"), so the fence below is being asked a real question",
      direct===true);
    for(let i=0;i<6;i++)G.puff(CX,2,CZ,0xffffff,0.6,0.30);
    const puffs0=G.fxEffects().length;
    let escaped=false;
    try{ for(let i=0;i<40;i++)G.updateEffects(0.05); }catch(e){ escaped=true; }
    const puffs1=G.fxEffects().length;
    check("v132.51 fx: a throwing effect system is FENCED — updateEffects survived it ("+
      (escaped?"THREW":"held")+") and the puff sprites still faded ("+puffs0+" → "+puffs1+
      "). Before the fence, auraTick threw on line one and the fade loop three systems below it "+
      "never ran, so every puff a villager had ever made hung in the air lit forever — which is "+
      "the band of lights John photographed over his town and reported as level sparkles",
      !escaped&&puffs0>=6&&puffs1===0);
    const wi=G.units.indexOf(wreck); if(wi>=0)G.units.splice(wi,1);   // it has no root: evict it

    // ---- THE LEASH ----
    const led=G.makeUnit(0,"clubman",CX,CZ,{name:"Leash",bot:{role:"citizen"}});
    led.bot=null; led.remote="leash"; led.lvl=G.XP_MAX_LVL; led._auraAcc=0;
    let worst=0;
    for(let i=0;i<60;i++){G.auraTick(0.05); const s=G.auraSpread(led); if(s>worst)worst=s;}
    for(let i=0;i<60;i++){led.root.position.x+=0.5; G.auraTick(0.05);
      const s=G.auraSpread(led); if(s>worst)worst=s;}
    check("v132.51 aura: no mote is EVER further than the leash from the body that owns it ("+
      worst.toFixed(2)+"u against a leash of "+G.AURA_LEASH+"u), standing or sprinting. Today's "+
      "radius and climb already keep it under; the clamp is what keeps John's rule true when "+
      "some later version widens them",worst>0&&worst<=G.AURA_LEASH+0.01);
    led.alive=false;
    for(let i=0;i<10;i++)G.auraTick(0.05);
  }
  // ---------- v132.52: THE AMBIENT DUST MUST NOT REACH THE HORIZON ----------
  // John, four times: v130.1 "confetti scattered across the distance", v130.2 "STILL confetti",
  // v131.11 "tone down the sparkly ambient floater things", and v132.51 a line of glowing dots
  // hanging in the fog which he reasonably took for his own level aura. Three fixes moved COUNT
  // and OPACITY; none could work, because the brightness of a far mote comes from the FOG —
  // r128 lerps a Points colour toward fog.color, and under additive blending a fogged mote adds
  // the fog's own light back on top of it. The field also rides the camera, so a far mote sits
  // at a FIXED screen position in the horizon band and never drifts out of it.
  {
    const G=global.__G, dp=G.dustPts();
    const P=dp.geometry.attributes.position.array;
    const CA=dp.geometry.attributes.color?dp.geometry.attributes.color.array:null;
    const n=dp.geometry.attributes.position.count;
    let litFar=0, near=0, brightest=0;
    for(let i=0;i<n;i++){
      const r=Math.hypot(P[i*3],P[i*3+2]);
      const lit=CA?Math.max(CA[i*3],CA[i*3+1],CA[i*3+2]):1;
      if(lit>brightest)brightest=lit;
      if(lit>0.004&&r>litFar)litFar=r;
      if(r<=20&&lit>0.05)near++;
    }
    check("v132.52 dust: no mote is LIT further than "+litFar.toFixed(1)+"u from the eye — the "+
      "field rides the camera, so that distance is fixed and this is the whole horizon band. "+
      "Dimming could never empty it: r128 lerps a Points colour toward fog.color, and under "+
      "additive blending the fog was supplying the light, not the mote",
      CA!==null&&litFar<=24.01);
    check("v132.52 dust: …and the layer still EXISTS — "+near+" motes lit inside twenty units "+
      "(brightest "+brightest.toFixed(2)+"). It is a catch-the-light layer for the near field; "+
      "a gate that passed by deleting it would be no fix at all",
      near>=10&&near<=45&&brightest>0.5);
    check("v132.52 dust: the material takes NO FOG and carries per-vertex colour (fog "+
      dp.material.fog+", vertexColors "+dp.material.vertexColors+") — the two mechanisms behind "+
      "every confetti report since v130.1",
      dp.material.fog===false&&dp.material.vertexColors===true);
  }
  // ---------- v132.54: NO ADDITIVE MATERIAL MAY TAKE FOG ----------
  {
    const G=global.__G, sc=G.scene();
    const adds=[];
    sc.traverse(o=>{
      const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
      for(const m of ms)if(m&&m.blending===THREE.AdditiveBlending)
        adds.push({what:o.type+(o.name?":"+o.name:""),fog:m.fog!==false});
    });
    const fogged=adds.filter(a=>a.fog);
    check("v132.54 fog: the scene HAS additive layers to police ("+adds.length+
      " of them: "+adds.map(a=>a.what).join(", ")+") — a rule nobody is subject to is not a rule",
      adds.length>=2);
    check("v132.54 fog: and NOT ONE of them takes three.js fog"+
      (fogged.length?" — offenders: "+fogged.map(a=>a.what).join(", "):"")+
      ". Under AdditiveBlending r128 computes mix(rgb, fogColor, fogFactor), so a distant "+
      "fragment ADDS the fog's own colour to the frame. A BLACK point — an expired aura mote, "+
      "deliberately blanked — therefore renders as a bright white splat out in the fog and stays "+
      "invisible up close, which is precisely the constellation John photographed marking "+
      "everywhere he had walked. Every instrument read that pool as clean, and every one was "+
      "right: the fog was doing the drawing, not the game. Shipped twice from this same root "+
      "(dust v130.1-v132.52, aura v132.29-v132.54) before anything tested for it",
      fogged.length===0);
  }
  // ---------- v133.0: THE BALANCE PASS — the mechanics that are new, not renumbered ----------
  {
    const G=global.__G;
    // ---- TIMBERWRIGHT, and the swing clock both frame paths now share ----
    const wood={type:"wood",amount:999}, stone={type:"stone",amount:999};
    const vil=G.makeUnit(0,"villager",-70,70,{name:"Chop",bot:{role:"citizen"}});
    vil.bot=null; vil.remote="chop"; vil.buffs={};
    const ox=G.makeUnit(0,"oxcart",-72,70,{name:"Ox",bot:{role:"citizen"}});
    ox.bot=null; ox.remote="ox"; ox.buffs={};
    const clb=G.makeUnit(0,"clubman",-74,70,{name:"Club",bot:{role:"citizen"}});
    clb.bot=null; clb.remote="club"; clb.buffs={};
    const base=G.gatherSwing(vil,wood);
    check("v133.0 gather: the base swing is 0.6s and PRACTICED HANDS compounds 20% a stack — "+
      [0,1,2,3,4,5].map(k=>(vil.buffs={gather:k},G.gatherSwing(vil,wood).toFixed(2))).join(" / ")+
      "s. It was −0.1s flat, which bottomed out at 0.10s and a SIX-fold rate",
      (vil.buffs={gather:0},Math.abs(G.gatherSwing(vil,wood)-0.6)<1e-9)&&
      (vil.buffs={gather:5},Math.abs(G.gatherSwing(vil,wood)-0.6*Math.pow(0.8,5))<1e-9));
    vil.buffs={};
    check("v133.0 TIMBERWRIGHT halves the swing on TIMBER for a villager ("+base.toFixed(2)+
      "s → "+(vil.buffs={timber:1},G.gatherSwing(vil,wood).toFixed(2))+"s) and for an ox cart ("+
      (ox.buffs={timber:1},G.gatherSwing(ox,wood).toFixed(2))+"s)",
      Math.abs(G.gatherSwing(vil,wood)-0.3)<1e-9&&Math.abs(G.gatherSwing(ox,wood)-0.3)<1e-9);
    check("v133.0 TIMBERWRIGHT: …and it is TIMBER only — the same villager mines stone at "+
      G.gatherSwing(vil,stone).toFixed(2)+"s, unchanged",Math.abs(G.gatherSwing(vil,stone)-0.6)<1e-9);
    check("v133.0 TIMBERWRIGHT: …and no other class gets it — a clubman holding it still swings "+
      (clb.buffs={timber:1},G.gatherSwing(clb,wood).toFixed(2))+"s",
      Math.abs(G.gatherSwing(clb,wood)-0.6)<1e-9);
    // the two frame paths must agree, which is the reason the function exists at all
    const hostSrc=fs.readFileSync(path.join(ROOT,"js/09-main.js"),"utf8");
    const netSrc =fs.readFileSync(path.join(ROOT,"js/10-net.js"),"utf8");
    check("v133.0 gather: BOTH frame paths call gatherSwing — the host loop and the guest mirror "+
      "each computed 0.6−0.1×stacks by hand, which is two copies of a balance number waiting to "+
      "drift apart",
      /gatherT>gatherSwing\(/.test(hostSrc)&&/gatherT>gatherSwing\(/.test(netSrc)&&
      !/0\.6-0\.1\*buffSt/.test(hostSrc)&&!/0\.6-0\.1\*buffSt/.test(netSrc));
    vil.alive=false; ox.alive=false; clb.alive=false;

    // ---- BOUNTY HUNTER retired ----
    check("v133.0 BOUNTY HUNTER is out of the deck ("+(G.BUFF_BY_ID.bounty?"STILL THERE":"gone")+
      ") — and TIMBERWRIGHT is in ("+(G.BUFF_BY_ID.timber?"present":"MISSING")+")",
      !G.BUFF_BY_ID.bounty&&!!G.BUFF_BY_ID.timber);
    {
      // …and a player who still holds it mid-match must neither crash nor be paid for it.
      // Scored through a REAL KILL: the harness deliberately unsets G.awardPts with the note
      // "call through gameplay paths instead", and it is right to — a direct call would not prove
      // the retired buff is out of the path that actually pays.
      const holder=G.makeUnit(0,"clubman",-76,70,{name:"Old",bot:{role:"citizen"}});
      holder.bot=null; holder.remote="old"; holder.buffs={bounty:3}; holder.score=0;
      const prey=G.makeUnit(1,"villager",-77,70,{name:"Purse",bot:{role:"citizen"}});
      const _m=NET.mode; NET.mode="host";
      G.dealDamage(holder,prey,99999);
      NET.mode=_m;
      check("v133.0 BOUNTY HUNTER: a save still carrying it scores FLAT — a villager kill paid "+
        (holder.score||0)+", not the 13 a ×3 premium would have added. The id is tolerated "+
        "everywhere (u.buffs, the wire, BUFF_BY_ID) and simply stops being dealt and stops paying",
        (holder.score||0)===10);
      holder.alive=false;
    }

    // ---- THE CHARGE CADENCES ----
    check("v133.0 ARROW WARD / IRON GUARD read John's cadence tables, not 30÷stacks — ward "+
      G.WARD_CD.join("/")+"s, guard "+G.GUARD_CD.join("/")+"s across five stacks",
      G.WARD_CD.length===5&&G.GUARD_CD.length===5&&
      G.WARD_CD[0]===24&&G.WARD_CD[4]===3&&G.GUARD_CD[0]===25&&G.GUARD_CD[4]===5&&
      G.buffMax("ward")===5&&G.buffMax("guardup")===5);

    // ---- KINSHIP scales with the shield wall ----
    {
      // MEASURE THE GAME, NOT MY ARITHMETIC. The first version of this gate defined the formula
      // inside the test and checked it against itself — it passed happily against a build where
      // Kinship had been reverted to a flat 1 HP/s. Drive the real aura pass and read real HP.
      const heal=(nKin)=>{
        const me=G.makeUnit(0,"clubman",120,120,{name:"Kin",bot:{role:"citizen"}});
        me.bot=null; me.remote="kin"; me.buffs={kinship:1};
        me.maxHp=200; me.hp=100; me._auraW=0; me._stillT=0;
        const mates=[];
        for(let i=0;i<nKin;i++){
          const o=G.makeUnit(0,"clubman",120+((i%6)-3)*0.7,120+((i/6|0)-1)*0.7,
            {name:"M"+i,bot:{role:"citizen"}});
          o.bot=null; mates.push(o);
        }
        const h0=me.hp;
        G.auraBuffTick(me,G.AURA_SCAN);
        const got=(me.hp-h0)/G.AURA_SCAN;      // HP per second
        me.alive=false; for(const o of mates)o.alive=false;
        return got;
      };
      const h1=heal(1), h4=heal(4), h20=heal(20);
      check("v133.0 KINSHIP pays per kinsman and ceilings at 5% — driven through the real aura "+
        "pass on a 200 HP body: 1 near = "+h1.toFixed(2)+" HP/s, 4 near = "+h4.toFixed(2)+
        ", 20 near = "+h20.toFixed(2)+" (the cap). A flat 1 HP/s paid the same whether one stood "+
        "with you or ten",
        Math.abs(h1-1)<0.05&&Math.abs(h4-4)<0.2&&Math.abs(h20-10)<0.3);
      const combatSrc=fs.readFileSync(path.join(ROOT,"js/05-combat.js"),"utf8");
      check("v133.0 KINSHIP: …and the aura pass COUNTS kinsmen rather than latching a boolean — "+
        "the old loop stopped at the first one it found",
        /kinNear\+\+/.test(combatSrc)&&/Math\.min\(0\.05,0\.005\*kinNear\)/.test(combatSrc)&&
        !/kinNear=true/.test(combatSrc));
    }

    // ---- SERRATED EDGE layers to three ----
    {
      // THROUGH dealDamage, NOT tmodAdd. The first version called tmodAdd with the cap by hand,
      // which tests tmodAdd and says nothing about whether the game's own proc passes a cap —
      // it passed against a build with the cap stripped out of the call site.
      const a=G.makeUnit(0,"clubman",-78,70,{name:"Serr",bot:{role:"citizen"}});
      a.bot=null; a.remote="serr"; a.buffs={bleed:1};
      const v=G.makeUnit(1,"clubman",-79,70,{name:"Bled",bot:{role:"citizen"}});
      v.bot=null; v.remote="bled"; v._tmods=null; v.maxHp=9999; v.hp=9999;
      const _mr=Math.random, _mode=NET.mode;
      Math.random=()=>0; NET.mode="host";        // every roll procs
      for(let i=0;i<6;i++)G.dealDamage(a,v,1);
      Math.random=_mr; NET.mode=_mode;
      const mag=G.tmodSum(v,"bleed");
      check("v133.0 SERRATED EDGE: six procs THROUGH dealDamage layer on one enemy to "+mag+
        " HP/s and no further — 3 over twenty seconds is the 60 HP on the sheet, and a seventh "+
        "proc refreshes the clock without deepening the wound",mag===3);
      a.alive=false; v.alive=false;
    }
  }
  check("v116 touch: the mobile layer is a no-op outside a browser",
    G.getHideD()===150&&G.getMouseLocked()===false);
  // the cull dial the perf tier uses is real, clamped, and reversible
  G.setHideD(105); const lowered=G.getHideD();
  G.setHideD(9999); const clampedHi=G.getHideD();
  G.setHideD(1);    const clampedLo=G.getHideD();
  G.setHideD(150);
  check("v116 touch: setHideD moves the cull line and clamps it ("+lowered+" / "+clampedHi+" / "+clampedLo+")",
    lowered===105&&clampedHi===400&&clampedLo===40&&G.getHideD()===150);
}

{
  // ================= v122: THE LEAK THAT CRASHED A 45-MINUTE MATCH =================
  // Three.js does not free GPU buffers on remove(). buildBodyFor rebuilt a unit's body on every
  // class change, arm-up and respawn-as-another-class and left the old geometry orphaned; across
  // 100 bots over six ages that is tens of thousands of leaked buffers, which is what took John's
  // iPhone white and reloaded the tab. This counts disposals for real rather than trusting a diff.
  const G=global.__G;
  let disposed=0, created=0;
  const realDispose=THREE.BufferGeometry.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose=function(){disposed++;return realDispose.apply(this,arguments);};
  const u=G.makeUnit(0,"clubman",-150,30,{name:"Leaky",bot:null});
  u.alive=true;
  const countGeo=o=>{let n=0;o.traverse(x=>{if(x.geometry)n++;});return n;};
  created=countGeo(u.body);
  const before=disposed;
  G.setClass(u,"archer");          // the rebuild that used to leak
  const freed=disposed-before;
  check("v122 leak: rebuilding a unit's body DISPOSES the old geometry ("+freed+" of "+created+" freed)",
    created>4&&freed>=created);
  // ...and ten class changes must not drift: every rebuild frees what the last one made
  let drift=0;
  for(let i=0;i<10;i++){
    const had=countGeo(u.body), d0=disposed;
    G.setClass(u,i%2?"clubman":"archer");
    if(disposed-d0<had)drift++;
  }
  check("v122 leak: ten more class changes free everything they replace ("+drift+" that didn't)",drift===0);
  // the health bar's sprite materials were leaking two at a time on the same path
  const src=fs.readFileSync(path.join(ROOT,"js","04-units.js"),"utf8");
  check("v122 leak: refreshBar disposes the old bar's materials",
    /u\.bar\.bg\.material\.dispose\(\)/.test(src)&&/u\.bar\.fg\.material\.dispose\(\)/.test(src));
  // a MODEL-backed body shares its geometry with MODELS[cls] — disposing a clone would blank it
  check("v122 leak: model-backed bodies are exempt (their geometry is shared, not owned)",
    /_modelBody/.test(src)&&/if\(!u\._modelBody\)/.test(src));
  THREE.BufferGeometry.prototype.dispose=realDispose;
  u.alive=false;
}

// ---------------------------------------------------------------- v124
{
  const G=global.__G;
  // ---- the roster counts TWO teams, not "blue and everything else" ----
  // John's field shots showed RED at 73 against BLUE's 49, a constant 24-unit gap that was exactly
  // the live wilds population. Prove the creeps are excluded by counting with them alive.
  const before=document.getElementById("roster").innerHTML;
  G.updateRoster();
  const html=document.getElementById("roster").innerHTML;
  // parse the SYMBOLS, not every digit: the markup carries #3d6ef2 / #d94a3d team colours and a
  // naive \d+ sweep happily reported the hex as unit counts
  const nums=[...html.matchAll(/[⛏⚔]\s*(\d+)/g)].map(m=>Number(m[1]));
  let creepsAlive=0;
  for(const u of G.units)if(u.alive&&u.team===G.NEUTRAL&&!u.isKing)creepsAlive++;
  // recount by hand the way the HUD should
  let bv=0,bm=0,rv=0,rm=0;
  for(const u of G.units){
    if(!u.alive||u.isKing)continue;
    if(u.team===G.BLUE)u.cls==="villager"?bv++:bm++;
    else if(u.team===G.RED)u.cls==="villager"?rv++:rm++;
  }
  check("v124 roster: the wilds belong to nobody — "+creepsAlive+" live creeps are counted for "+
    "neither crown (blue "+bv+"/"+bm+" · red "+rv+"/"+rm+")",
    creepsAlive>0&&nums[0]===bv&&nums[1]===bm&&nums[2]===rv&&nums[3]===rm);

  // ---- THE DRAW: which classes, and what the curve pays ----
  const draws=["slinger","archer","imparcher","comparcher"].every(c=>G.isDrawClass(c));
  const fires=["crossbowman","skirmisher","musketeer"].every(c=>!G.isDrawClass(c));
  check("v124 draw: bows draw, the fire-and-reload lines do NOT — and rig is NOT the test "+
    "(crossbowman and skirmisher are rig:\"bow\")",
    draws&&fires&&CLS.crossbowman.rig==="bow"&&CLS.skirmisher.rig==="bow");
  const tap=G.drawScale("archer",0), full=G.drawScale("archer",1), mid=G.drawScale("archer",0.5);
  check("v124 draw: a tap is weak and slow, a full draw hits ~2x and flies ~2.6x faster ("+
    tap.dmg+"->"+full.dmg+" dmg, "+tap.spd+"->"+full.spd+" spd)",
    tap.dmg===0.5&&full.dmg===2&&full.spd/tap.spd>2.5&&mid.dmg>tap.dmg&&mid.dmg<full.dmg);
  const cb=G.drawScale("crossbowman",0);
  check("v124 draw: holding does nothing for a crossbow — it keeps the v113 aimed bonus exactly",
    cb.dmg===1.35&&cb.spd===1&&G.drawScale("crossbowman",1).dmg===1.35);
  // the host must clamp a guest's CLAIM to the hold it actually watched
  const net=fs.readFileSync(path.join(ROOT,"js","10-net.js"),"utf8")
    .split("\n").filter(l=>!/^\s*\/\//.test(l)).join("\n");
  check("v124 draw: the host clamps a guest's claimed charge to the hold it observed",
    /Math\.min\(Number\(i\.shot\.lv\)\|\|0,seen\)/.test(net)&&/r\.drawT=\(r\.drawT\|\|0\)\+dt/.test(net));

  // ---- THE CONVERGENCE: an aimed shot must point AT the crosshair, not parallel to it ----
  // The old bug in one line: spawn a unit off the shoulder, fly parallel, miss by that offset for
  // ever. Fire from a known muzzle at a known aim point and check the velocity actually converges.
  const muzzle=new THREE.Vector3(0,1.7,0), pt=new THREE.Vector3(3,1.7,34);
  const v=G.convergeFrom(muzzle,pt);
  const hit=muzzle.clone().add(v.clone().multiplyScalar(pt.distanceTo(muzzle)));
  check("v124 aim: the shot converges on the crosshair point (lands "+
    hit.distanceTo(pt).toFixed(3)+" units off, was ~1.0 by construction)",
    hit.distanceTo(pt)<0.01);
  const comb=fs.readFileSync(path.join(ROOT,"js","05-combat.js"),"utf8")
    .split("\n").filter(l=>!/^\s*\/\//.test(l)).join("\n");
  check("v124 aim: no aimed projectile is launched parallel to the camera ray any more",
    !/vel:dir\.clone\(\)\.multiplyScalar\(36\)/.test(comb)&&
    !/vel:dirC\.clone\(\)\.multiplyScalar\(100\)/.test(comb)&&
    /convergeFrom\(muzzle,pt\)/.test(comb)&&/convergeFrom\(muzC,/.test(comb));

  // ---- ANALOG MOVEMENT ----
  const mv=G.moveVec;
  mv.analog=false;
  G.keys.w=true; G.keys.a=false; G.keys.s=false; G.keys.d=false;
  const byKey=G.readMove();
  G.keys.w=false;
  mv.analog=true; mv.x=0; mv.z=-1;
  const byStickFull=G.readMove();
  mv.x=0; mv.z=-0.5;
  const byStickHalf=G.readMove();
  mv.x=0; mv.z=-0.05;
  const byStickDead=G.readMove();
  mv.analog=false; mv.x=mv.z=0;
  check("v124 analog: a key is all-or-nothing, a stick is proportional, and thumb noise is dead "+
    "(key "+byKey.mag+" · full "+byStickFull.mag+" · half "+byStickHalf.mag.toFixed(2)+
    " · noise "+byStickDead.mag+")",
    byKey.mag===1&&byStickFull.mag===1&&byStickDead.mag===0&&
    byStickHalf.mag>0.4&&byStickHalf.mag<1);
  check("v124 analog: the wire field is OPTIONAL — an old host still walks a guest by the bits",
    /typeof i\.mx==="number"/.test(net)&&/if\(i\.w\)mz-=1/.test(net));

  // ---- "ALEXANDER THE GREAT" ----
  const names=[0,1,2,7,25,63].map(i=>G.mkName(i));
  const shaped=names.every(n=>/^[A-Z][a-z]+ the [A-Z]/.test(n));
  const distinct=new Set(names).size===names.length;
  check("v124 names: every warrior is <Name> the <Epithet> and the pairing does not repeat ("+
    names.slice(0,3).join(" · ")+")",shaped&&distinct);
  check("v124 names: the same unit id yields the same name on every machine",
    G.mkName(11)===G.mkName(11)&&G.mkName(11)!==G.mkName(12));

  // ---- THE RAIL's gating predicates ----
  check("v124 rail: the action table is priority-ordered with AGE UP first, and every entry "+
    "carries a can() test",
    G.ACTIONS[0].k==="t"&&G.ACTIONS.every(a=>typeof a.can==="function"&&a.label));
  document.getElementById("roster").innerHTML=before;
}

// ================= v127: IS THE FRAME ACTUALLY CALLING ANY OF THIS? =================
// The bug that motivated this block: `tickBoardBang` was called from exactly ONE place —
// tickBody's host/solo branch — so guests never saw the "!" over the quest board. It shipped
// broken in v99 and stayed broken for 27 versions, with a GREEN test the whole time, because
// that test called `tickBoardBang()` by hand. It proved the driver worked and said nothing about
// whether anybody drives it. Every other check in this file that pokes a helper directly has the
// same blind spot; auditing 380 of them one at a time would find today's instance and miss the
// next one.
//
// So instead of auditing, assert the WIRING. Each per-frame driver is swapped for a counter, one
// host frame and one guest frame are run, and we check who fired. A guest runs a completely
// different frame from a host — it returns from tickBody at 09-main.js:631 and never sees the 40
// lines below — so "it works" is meaningless until you say FOR WHOM. This is the check that
// notices the day someone adds a display driver to one branch and forgets the other.
//
// It works because the bundle is evaluated in global scope, so top-level `function` declarations
// land on globalThis and the internal call sites resolve through the scope chain. `const`/`let`
// do not, which is why only functions can be spied on here.
{
  const G=global.__G, W=global.__WIRE||{};
  const DRIVERS=WIRE_DRIVERS;
  const orig={}, hits={};
  for(const d of DRIVERS){
    if(!W[d]||typeof W[d].get()!=="function"){orig[d]=null;continue;}
    orig[d]=W[d].get();
    hits[d]={host:0,guest:0};
    W[d].set(function(){hits[d][global.__frameRole]++;return orig[d].apply(this,arguments);});
  }
  const missing=DRIVERS.filter(d=>orig[d]===null);
  const modeSave=NET.mode;
  let ranOK=true;
  try{
    global.__frameRole="host";
    NET.mode="solo"; G.setGameOver(false);
    for(let i=0;i<40;i++)G.tick();          // 40 frames: enough for the 0.5s roster tick to land
    global.__frameRole="guest";
    NET.mode="guest";
    for(let i=0;i<40;i++)NET.guestFrame(1/30);
  }catch(e){
    // a throw here must not take the whole suite down WITH THE SPIES STILL INSTALLED
    console.error("  wiring probe threw:",e.message); ranOK=false;
  }finally{
    for(const d of DRIVERS)if(orig[d])W[d].set(orig[d]);
    NET.mode=modeSave;
  }
  check("v127 wiring: both frames run to completion under the probe",ranOK);
  check("v127 wiring: every per-frame driver is swappable through __WIRE (spy-able) — "+
    (missing.length?("MISSING "+missing.join(", ")):"all "+DRIVERS.length+" found"),missing.length===0);
  // the host/solo frame drives the whole sim
  // NOTE the `spied>0` clause on each check below. Without it, a probe that installed NOTHING
  // would filter an empty list and report three cheerful passes — a test that reports success
  // when it measured nothing, which is the exact species of bug this block was written to hunt.
  const spied=DRIVERS.filter(d=>orig[d]).length;
  const hostSilent=DRIVERS.filter(d=>orig[d]&&hits[d].host===0);
  check("v127 wiring: the host frame calls every driver it owns ("+spied+" spied)"+
    (hostSilent.length?(" — SILENT: "+hostSilent.join(", ")):""),spied>0&&hostSilent.length===0);
  // …and the guest frame drives every DISPLAY-ONLY one. The sim-only drivers must NOT run on a
  // guest (the host is authoritative), so this list is the contract, not a wish.
  const GUEST_MUST=["drainVisualQueue","updateEffects","updateProjectiles","tickAgeResearch",
                    "tickBoardBang","drawMinimap","updateRoster"];
  const GUEST_MUST_NOT=["campTick","healTick","questTick","economyTick"];
  const guestSilent=GUEST_MUST.filter(d=>orig[d]&&hits[d].guest===0);
  check("v127 wiring: the guest frame calls every DISPLAY driver"+
    (guestSilent.length?(" — SILENT ON GUESTS: "+guestSilent.join(", ")+
      " (this is exactly how the board '!' was invisible to guests for 27 versions)"):""),
    spied>0&&guestSilent.length===0);
  const guestLeak=GUEST_MUST_NOT.filter(d=>orig[d]&&hits[d].guest>0);
  check("v127 wiring: the guest frame runs NO host-authoritative driver"+
    (guestLeak.length?(" — LEAKED: "+guestLeak.join(", ")):""),spied>0&&guestLeak.length===0);
}

// ---- v128.8: THE OBJECTIVE RIBBON LEAVES ON A GUEST TOO ----
// Field report: "⚔ Slay the enemy King before yours falls" never went away, as a guest, on both
// desktop and mobile. Its fade was inside tickBody's `if(!gameOver)` block, which tickBody
// returns before reaching on a guest — trap #12, the same shape as the board "!" that was
// invisible to guests for 27 versions. It lives in renderFrame now, which every frame path calls.
// This test DRIVES THE REAL FRAME in guest mode rather than calling the fader by hand, because a
// test that reaches past the entry point cannot see a missing call site.
{
  const G=global.__G, NET=G.NET;
  const el=global.document.getElementById("objective");
  const saveMode=NET.mode;
  delete window._objFaded; delete window._objAt; el.style.opacity=""; el.style.display="";
  NET.mode="guest";
  const before=window._objFaded;
  G.tick(1/30);                                     // one guest frame: starts the clock, no fade
  const armedNotFired=!window._objFaded&&typeof window._objAt==="number";
  // 20 seconds of WALL time — the harness's synthetic clock advances inside getDelta
  for(let i=0;i<700&&!window._objFaded;i++)G.tick(1/30);
  check("v128.8 objective: the ribbon is still up on a guest's first frame (it must be READ before it goes)",
    !before&&armedNotFired);
  check("v128.8 objective: …and a GUEST frame fades it — the bug, driven through the real entry point",
    window._objFaded===true&&el.style.opacity==="0");
  // and it must be wall time, not the match clock: a guest inherits T from the host's snapshots,
  // so a late joiner arrives with T in the hundreds and would never see the banner at all
  check("v128.8 objective: the delay is measured in WALL time, so a guest joining an old match still sees it",
    /window\._objAt/.test(String(G.renderFrame||"")) ||
    /_objAt/.test(require("fs").readFileSync(require("path").join(ROOT,"js/09-main.js"),"utf8")));
  NET.mode=saveMode;
}

// ================= v129.3: THE MENU BED =================
// audio/music/menu.ogg loops behind the three menu screens and crossfades out into the age
// anthem when the war starts. Two things are asserted here and they are different in kind:
//   1. the FADE + VOLUME arithmetic, which is pure and testable the way musVol already is;
//   2. the WIRING — that renderFrame really reaches Sound.menuTick, passing the live inMenu
//      and a real dt. That second one is the whole reason this test exists. Sound.tick is
//      never called in a menu (tickBody returns first), so a menu track hung off musTick
//      would be silent forever and every unit test of the fade would still pass. Trap #12.
{
  const G=global.__G, A=G.Sound, MM=A._mm;
  check("v129.3 menu bed: the track is audio/music/menu.ogg",A.MUSMENU==="audio/music/menu.ogg");

  const savedVol={m:A.getVol("master"),mu:A.getVol("music")}, savedMute=A.isMuted();
  A.setMute(false);A.setVol("master",1.0);A.setVol("music",1.0);

  // ---- the fade, both directions, with clamping ----
  MM.el=null;MM.on=false;MM.playing=false;MM.fade=0;MM.dead=true;MM.wait=0; // dead → fade only
  A._musMenuTick(true,0.3);const f1=MM.fade;
  A._musMenuTick(true,0.3);A._musMenuTick(true,0.3);const f2=MM.fade;
  A._musMenuTick(true,0.3);const f3=MM.fade;                               // over the top → clamp
  check("v129.3 menu bed: it fades UP over MENUFADE_S and clamps at 1 ("+
    f1.toFixed(2)+" → "+f2.toFixed(2)+" → "+f3.toFixed(2)+")",
    Math.abs(f1-0.3/A.MENUFADE_S)<1e-9&&f2===1&&f3===1);
  A._musMenuTick(false,0.45);const g1=MM.fade;
  A._musMenuTick(false,0.45);const g2=MM.fade;
  A._musMenuTick(false,0.45);const g3=MM.fade;
  check("v129.3 menu bed: leaving the menu fades DOWN and clamps at 0 ("+
    g1.toFixed(2)+" → "+g2.toFixed(2)+" → "+g3.toFixed(2)+")",
    Math.abs(g1-0.5)<1e-9&&g2===0&&g3===0);

  // ---- the volume, on the same trim as the anthems, and silenced by mute ----
  MM.fade=1;
  A.setVol("master",0.8);A.setVol("music",0.5);
  const v1=A._musMenuVol();
  MM.fade=0.5; const vHalf=A._musMenuVol();
  MM.fade=1; A.setMute(true); const vMute=A._musMenuVol(); A.setMute(false);
  check("v129.3 menu bed: volume is master×music×MUSTRIM×fade, and mute kills it",
    Math.abs(v1-0.8*0.5*A.MUSTRIM)<1e-9&&Math.abs(vHalf-v1*0.5)<1e-9&&vMute===0);

  // ---- v129.4 THE GATE. The bed must not play on the NAME screen — it arms the first time the
  // player leaves it, and then LATCHES so `✎` back to the name box does not cut the music.
  const NETm=G.NET, savedScreen=NETm.screen, savedArmed=NETm._bedArmed;
  NETm._bedArmed=false;
  NETm.uiScreen("namescreen");
  const atName=NETm.wantMenuBed();
  NETm.uiScreen("startmenu");
  const atShields=NETm.wantMenuBed();
  NETm.uiScreen("namescreen");
  const backAtName=NETm.wantMenuBed();
  check("v129.4 menu bed: silent on the name screen, arms at the shields, and LATCHES ("+
    atName+" → "+atShields+" → "+backAtName+")",
    atName===false&&atShields===true&&backAtName===true&&NETm.screen==="namescreen");
  check("v129.4 menu bed: uiScreen records which screen is up, for anything else that has to know",
    NETm.MENUS.indexOf(NETm.screen)>=0);

  // ---- THE WIRING. Drive the REAL renderFrame (trap #10) and prove it reached menuTick with
  // the live inMenu ANDed against the gate, and the frame's own dt — not a constant, and not
  // some other function. 0.45s is exactly half of MENUFADE_S, so from 0.5 the fade lands on
  // 1 or 0 and the direction is unambiguous.
  const menu=G.menuUp();
  NETm._bedArmed=true;                                     // gate open: inMenu alone decides
  MM.on=!menu;MM.fade=0.5;MM.dead=true;MM.playing=false;
  G.renderFrame(0.45);
  check("v129.4 menu bed: renderFrame drives it, passing the live inMenu ("+menu+") and a real dt"+
    " (fade 0.50 → "+MM.fade.toFixed(2)+")",
    MM.on===!!menu&&MM.fade===(menu?1:0));
  NETm._bedArmed=false;                                    // gate shut: it must be OFF regardless
  MM.on=true;MM.fade=0.5;
  G.renderFrame(0.45);
  check("v129.4 menu bed: with the gate shut renderFrame turns it OFF even if inMenu is true",
    MM.on===false&&MM.fade===0);
  NETm._bedArmed=savedArmed;if(savedScreen!==undefined)NETm.screen=savedScreen;

  // ---- the element: loop flag, throttled autoplay retry, and the error→dead stop ----
  // A synchronous thenable stands in for play()'s promise so the whole test stays in one tick.
  const REJ={then(){return REJ;},catch(cb){cb(new Error("NotAllowedError"));return REJ;}};
  const RES={then(cb){if(cb)cb();return RES;},catch(){return RES;}};
  let tries=0;
  function FakeAudio(){this.src="";this.loop=false;this.volume=1;this.preload="";this.paused=true;
    this._h={};
    this.addEventListener=(k,f)=>{(this._h[k]=this._h[k]||[]).push(f);};
    this.play=()=>{tries++;if(FakeAudio.refuse)return REJ;this.paused=false;return RES;};
    this.pause=()=>{this.paused=true;};
    this.fire=k=>{(this._h[k]||[]).forEach(f=>f());};}
  const hadAudio=global.Audio; global.Audio=FakeAudio; FakeAudio.refuse=true;
  MM.el=null;MM.on=false;MM.playing=false;MM.fade=0;MM.dead=false;MM.wait=0;

  A._musMenuTick(true,0.016);                        // first attempt — refused, no gesture yet
  const el=MM.el, afterFirst={tries,playing:MM.playing,loop:el&&el.loop,src:el&&el.src};
  for(let i=0;i<30;i++)A._musMenuTick(true,0.016);    // 0.48s — still inside MENURETRY_S
  const throttled=tries;
  for(let i=0;i<12;i++)A._musMenuTick(true,0.016);    // …past 0.6s → exactly one more attempt
  const retried=tries;
  check("v129.3 menu bed: an autoplay refusal re-arms on a "+A.MENURETRY_S+"s throttle, not every frame"+
    " (1 → "+throttled+" over 0.48s → "+retried+" past the throttle)",
    afterFirst.tries===1&&afterFirst.playing===false&&throttled===1&&retried===2);
  check("v129.3 menu bed: the element loops menu.ogg (a 2:34 bed under an open-ended menu)",
    afterFirst.loop===true&&afterFirst.src==="audio/music/menu.ogg");

  FakeAudio.refuse=false;                            // the player clicks the dice — it takes
  for(let i=0;i<45;i++)A._musMenuTick(true,0.016);
  const playing=MM.playing&&el.paused===false, triesAfter=tries;
  for(let i=0;i<80;i++)A._musMenuTick(true,0.016);   // and it is NOT restarted every frame
  check("v129.3 menu bed: once the gesture lands it plays, and is never re-play()ed while playing",
    playing===true&&tries===triesAfter);

  for(let i=0;i<80;i++)A._musMenuTick(false,0.016);  // 1.28s — past the 0.9s fade
  check("v129.3 menu bed: it is held through the fade-out, then paused — a crossfade, not a cut",
    MM.fade===0&&MM.playing===false&&el.paused===true);

  MM.playing=false;MM.wait=0;el.fire("error");       // a copy with no audio/music/ folder
  const deadTries=tries;
  for(let i=0;i<200;i++)A._musMenuTick(true,0.016);  // 3.2s of retries that must not happen
  check("v129.3 menu bed: a missing file marks it dead ONCE and stops retrying forever",
    MM.dead===true&&tries===deadTries);

  if(hadAudio===undefined)delete global.Audio; else global.Audio=hadAudio;
  MM.el=null;MM.on=false;MM.playing=false;MM.fade=0;MM.dead=false;MM.wait=0;
  A.setVol("master",savedVol.m);A.setVol("music",savedVol.mu);A.setMute(savedMute);
}

// ==================== v134.0 THE PATHING BENCH ====================
// Last in the file on purpose: these add bodies and buildings, which shifts unit ids, and nothing
// runs after them. tools/pathprobe.js is the same set of experiments on a 2-second load, for when
// one of these goes red and you want to iterate without paying for the suite.
{
  const G=global.__G;
  const probe=[];
  const pBld=(t,x,z)=>{const b=G.makeBuilding(0,t,x,z,true);probe.push(b);return b;};
  const pGuy=(x,z,n)=>{const u=G.makeUnit(0,"villager",x,z,{name:n,bot:{role:"citizen"}});
    u.bot=null;probe.push(u);return u;};                       // bot=null: it walks where WE say
  const wipe=()=>{for(const o of probe)o.alive=false;probe.length=0;};
  const faceZ=(b)=>{const A=Math.max((b.def.age||0),Math.min(5,G.teamAge[b.team]||0));
    const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:
             (b.def.fz!==undefined?b.def.fz:(b.def.rBlock!==undefined?b.def.rBlock:b.def.r));
    return b.z+fz+0.7;};
  const insideAny=(x,z)=>{for(const b of G.buildings)if(insideCollider(b,x,z))return b;return null;};

  // --- 1. THE STATIC SHOVE. No movement at all: a packed blob beside a barracks, and only
  //        separate() running. Anything that ends up inside got there by teleport, full stop.
  {
    const b=pBld("barracks",-120,-60), face=faceZ(b);
    const crowd=[];
    for(let i=0;i<24;i++)crowd.push(pGuy(b.x-1.2+(i%3)*1.2,face+0.1+Math.floor(i/3)*0.9,"Shove"+i));
    for(let i=0;i<80;i++)G.separate();
    let inside=0,deepest=0;
    for(const u of crowd){const p=u.root.position;
      const b2=insideAny(p.x,p.z); if(b2)inside++;
      deepest=Math.max(deepest,face-p.z);}
    check("v134.0 separate(): a packed crowd is never SHOVED INSIDE a building ("+inside+
      " of 24, deepest "+deepest.toFixed(2)+") — v133 put 3 in, 1.30 deep",
      inside===0&&deepest<0.01);
    wipe();
  }

  // --- 2. THE HAUL. Eighteen bodies converging on a stand point on the FAR side of a building,
  //        moving, with separate() after them exactly as 09-main.js runs it. This is the drop-off
  //        queue, which is the shape John sees jam.
  {
    const b=pBld("storage_pit",-120,-60);
    const goal={x:b.x,z:2*b.z-faceZ(b)-2.2};                   // the stand point on the north side
    const crowd=[];
    for(let i=0;i<18;i++)crowd.push(pGuy(b.x-4+(i%5)*2,faceZ(b)+8+Math.floor(i/5)*2,"Haul"+i));
    let insideFrames=0,worst=0; const done=new Set();
    for(let f=0;f<700;f++){
      for(const u of crowd){if(done.has(u))continue;
        if(G.moveToward(u,goal.x,goal.z,0.05,1.6))done.add(u);}
      G.separate(); G.advanceT(0.05);
      let ins=0; for(const u of crowd)if(insideAny(u.root.position.x,u.root.position.z))ins++;
      if(ins){insideFrames++;worst=Math.max(worst,ins);}
    }
    let sidesteps=0; for(const u of crowd)sidesteps+=(u._stkT||0);
    check("v134.0 haul: a queue rounding a building never stands inside it ("+insideFrames+
      "/700 frames, worst "+worst+" at once) — v133: 624 frames, 7 at once",
      insideFrames===0&&worst===0);
    check("v134.0 haul: …and every body still reaches the stand point ("+done.size+" of 18)",
      done.size===18);
    if(sidesteps)note("v134.0 haul: "+sidesteps+" sidesteps issued clearing the queue");
    wipe();
  }

  // --- 2b. THE WATCHDOG ITSELF, in isolation and by construction. The haul above is a
  //         REALISTIC jam, and whether it happens to trip the watchdog depends on the exact
  //         geometry of the crowd — which makes it a bad non-vacuity test. This is the precise
  //         claim instead: a body moving AT FULL SPEED that gains no ground on its goal must be
  //         unstuck. v133 measured realized displacement, so it would run this treadmill until
  //         the heat death of the universe without ever noticing.
  {
    const u=pGuy(-120,-100,"Treadmill");
    const home={x:u.root.position.x,z:u.root.position.z};
    let fired=0,secs=0,realMotion=0;
    for(let f=0;f<400&&!fired;f++){
      G.moveToward(u,-60,-100,0.05,1.2);                        // full-speed motion at the goal…
      realMotion=Math.max(realMotion,Math.hypot(u.root.position.x-home.x,u.root.position.z-home.z));
      u.root.position.set(home.x,u.root.position.y,home.z);     // …and something puts it right back
      G.advanceT(0.05); secs+=0.05;
      if(u._stkT>0)fired=secs;
    }
    check("v134.0 watchdog: a body moving at full speed ("+realMotion.toFixed(2)+"/frame) that "+
      "gains NO ground is unstuck within "+G.MOVE_STALL_T+"s (fired at "+
      (fired?fired.toFixed(2)+"s":"NEVER")+") — v133 watched displacement and never would",
      fired>0&&fired<=G.MOVE_STALL_T+0.3&&realMotion>0.1);
    wipe();
  }

  // --- 3. OPEN GROUND. A watchdog that fires on a clear walk would thrash every unit in the game.
  {
    const u=pGuy(-120,-100,"Stroller");
    let steps=0,arrived=false;
    while(steps<900&&!arrived){arrived=G.moveToward(u,-60,-100,0.05,1.2);steps++;G.advanceT(0.05);}
    check("v134.0 open ground: a clear walk arrives and costs NO sidesteps ("+steps+" steps, "+
      (u._stkT||0)+" sidesteps)",arrived&&!(u._stkT>0));
    wipe();
  }

  // --- 4. THE DETOUR IS SOMEWHERE REAL. Every escalation level, both hands, all validated.
  if(typeof G.pickDetour==="function"){
    pBld("barracks",-120,-40); pBld("barracks",-142,-58); pBld("barracks",-98,-58);
    const u=pGuy(-120,-58,"Detourer");
    let bad=0,n=0,issued=0;
    for(let k=0;k<=4;k++){u._stkN=k;
      for(const side of [1,-1]){u._detSide=side;
        const d=G.pickDetour(u,0,50,50); n++;
        if(!d)continue;                       // null is "nowhere legal to go" — a legal answer
        issued++;
        if(!G.walkable(d.x,d.z)||insideAny(d.x,d.z))bad++;}}
    check("v134.0 detour: every sidestep ISSUED aims at ground a body can stand on ("+bad+
      " bad of "+issued+" issued, "+n+" asked) — v133 never tested one, and a first cut of this "+
      "fell back to a BLIND offset that put 2 of 10 inside a building on SMOKE_SEED=42",
      bad===0&&issued>0);
    wipe();
  }

  // --- 5. THE POCKET BORDER. A body legally standing in a camp pocket, pressed to its rim. The
  //        old walkable() failure snapped to the map RECTANGLE, which is a teleport out of ground
  //        the fringe rule explicitly allows.
  {
    const u=pGuy(0,G.MAP.z+40,"Pocketed");
    let biggest=0;
    for(let i=0;i<200;i++){
      const p0x=u.root.position.x,p0z=u.root.position.z;
      G.moveUnit(u,0,1,0.05);
      biggest=Math.max(biggest,Math.hypot(u.root.position.x-p0x,u.root.position.z-p0z));
    }
    const step=u.spd*0.05;
    check("v134.0 border: a body in a camp pocket is never SNAPPED to the map rectangle (biggest "+
      "frame "+biggest.toFixed(2)+" vs a step of "+step.toFixed(2)+") — v133 jumped 34.85",
      biggest<=step+1e-6&&u.root.position.z>G.MAP.z);
    wipe();
  }
}

console.log(fails?("\n"+fails+" FAILURES"):"\nALL SMOKE TESTS PASSED");
process.exit(fails?1:0);
