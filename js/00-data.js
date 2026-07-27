/* REGICIDE PVP — 00-data.js */
"use strict";
/* ============================================================
   KINGSLAYER — single-file vertical slice
   You are one villager among many. Gather, build, take up arms,
   and slay the enemy king. Bots stand in for the other players.
   ============================================================ */

// ---------- data ----------
const BLUE=0, RED=1, NEUTRAL=2; // team 2: the wilds — creep camps, hostile to both crowns
const TEAMCOL=[0x3d6ef2,0xd94a3d,0x8a8f7a];
const TEAMNAME=["Blue","Red","Wilds"];

const CLS={
  villager:   {name:"Villager",hp:60,dmg:6,spd:8.2,rng:2.4,cd:0.7,cost:null,col:0xd9b38c,line:"civil",rig:"villager",tier:0,age:0},
  king:       {name:"King",hp:320,dmg:13,spd:8,rng:2.6,cd:0.8,cost:null,col:0xc9a227,line:"royal",rig:"king",tier:0,age:0},
  // ---- Primary Melee Line (Barracks) ----
  clubman:    {name:"Club Man",hp:100,dmg:10,spd:8,rng:2.4,cd:0.8,cost:{food:40,gold:0},bMult:1.5,col:0x9c7b5a,line:"melee",rig:"sword",tier:0,age:0},
  shortsword: {name:"Short Swordsman",hp:130,dmg:13,spd:8,rng:2.5,cd:0.8,cost:{food:50,gold:15},bMult:1.5,col:0x9aa2ad,line:"melee",rig:"sword",tier:1,age:1},
  broadsword: {name:"Broad Swordsman",hp:155,dmg:16,spd:8,rng:2.6,cd:0.8,cost:{food:60,gold:20},bMult:1.5,col:0xa8b0ba,line:"melee",rig:"sword",tier:2,age:2},
  legionaire: {name:"Legionaire",hp:185,dmg:19,spd:8,rng:2.6,cd:0.8,cost:{food:70,gold:30},bMult:1.5,col:0xb03a3a,line:"melee",rig:"sword",tier:3,age:3},
  vanguard:   {name:"Vanguard",hp:220,dmg:23,spd:8,rng:2.6,cd:0.8,cost:{food:85,gold:40},bMult:1.5,col:0x5a6578,line:"melee",rig:"sword",tier:4,age:4},
  musketeer:  {name:"Musketeer",hp:110,dmg:30,spd:7.6,rng:26,cd:2.2,cost:{food:70,gold:90},col:0x35455e,line:"melee",rig:"musket",tier:5,age:5,ranged:true,bayonet:{dmg:14,rng:2.6,cd:0.8}},
  // ---- Primary Anti-Cavalry Line (Barracks) ----
  spearman:    {name:"Spear Man",hp:90,dmg:9,spd:8,rng:3.2,cd:0.9,cost:{food:35,gold:0},col:0x8a7a58,line:"anticav",rig:"pike",tier:0,age:0},
  spearfighter:{name:"Spearfighter",hp:115,dmg:11,spd:8,rng:3.2,cd:0.9,cost:{food:45,wood:10},col:0x8f7f5d,line:"anticav",rig:"pike",tier:1,age:1},
  impspear:    {name:"Improved Spearfighter",hp:135,dmg:13,spd:8,rng:3.3,cd:0.9,cost:{food:55,wood:15},col:0x93875f,line:"anticav",rig:"pike",tier:2,age:2},
  hoplite:     {name:"Hoplite",hp:160,dmg:16,spd:7.8,rng:3.4,cd:0.9,cost:{food:65,wood:25},col:0xb08a3f,line:"anticav",rig:"pike",tier:3,age:3},
  pikeman:     {name:"Pikeman",hp:190,dmg:19,spd:7.6,rng:3.5,cd:0.9,cost:{food:75,wood:35},col:0x7a6a4f,line:"anticav",rig:"pike",tier:4,age:4},
  halberdier:  {name:"Halberdier",hp:225,dmg:23,spd:7.6,rng:3.6,cd:0.9,cost:{food:90,wood:45},col:0x4e5a3a,line:"anticav",rig:"pike",tier:5,age:5},
  // ---- Primary Ranged Line (Archery Range; Slingers muster at the Barracks in the Stone Age) ----
  slinger:     {name:"Slinger",hp:70,dmg:8,spd:8.2,rng:16,cd:1.2,cost:{gold:10,wood:30},col:0x6b8a4a,line:"ranged",rig:"bow",tier:0,age:0,ranged:true},
  archer:      {name:"Archer",hp:85,dmg:11,spd:8,rng:21,cd:1.25,cost:{gold:40,wood:40},col:0x5d7a4a,line:"ranged",rig:"bow",tier:1,age:1,ranged:true},
  imparcher:   {name:"Improved Archer",hp:95,dmg:13,spd:8,rng:22,cd:1.25,cost:{gold:45,wood:45},col:0x567a44,line:"ranged",rig:"bow",tier:2,age:2,ranged:true},
  comparcher:  {name:"Composite Archer",hp:110,dmg:15,spd:8,rng:23,cd:1.2,cost:{gold:55,wood:50},col:0x4e7a3e,line:"ranged",rig:"bow",tier:3,age:3,ranged:true},
  crossbowman: {name:"Crossbowman",hp:125,dmg:19,spd:7.8,rng:24,cd:1.5,cost:{gold:65,wood:60},col:0x46603a,line:"ranged",rig:"bow",tier:4,age:4,ranged:true},
  skirmisher:  {name:"Skirmisher",hp:140,dmg:23,spd:9,rng:25,cd:1.3,cost:{gold:80,wood:70},col:0x3e5a44,line:"ranged",rig:"bow",tier:5,age:5,ranged:true},
  // ---- Primary Cavalry Line (Stable) ----
  chariot:     {name:"Chariot",hp:150,dmg:13,spd:11,rng:2.8,cd:0.85,cost:{food:90,gold:40},col:0xa8703d,line:"cavalry",rig:"cavalry",tier:1,age:1,mounted:true},
  heavycav:    {name:"Heavy Cavalry",hp:180,dmg:16,spd:12,rng:2.8,cd:0.85,cost:{food:105,gold:55},col:0x9a6a3a,line:"cavalry",rig:"cavalry",tier:2,age:2,mounted:true},
  cataphract:  {name:"Cataphract",hp:215,dmg:19,spd:13,rng:2.8,cd:0.85,cost:{food:120,gold:70},col:0xb08a3f,line:"cavalry",rig:"cavalry",tier:3,age:3,mounted:true},
  knight:      {name:"Knight",hp:250,dmg:23,spd:13.5,rng:2.8,cd:0.85,cost:{food:135,gold:85},col:0xb9c0c9,line:"cavalry",rig:"cavalry",tier:4,age:4,mounted:true},
  dragoon:     {name:"Dragoon",hp:270,dmg:26,spd:14,rng:2.8,cd:0.85,cost:{food:150,gold:100},col:0x3a4a6e,line:"cavalry",rig:"cavalry",tier:5,age:5,mounted:true},
  // ---- Scout Line (Stable) ----
  scout:       {name:"Scout",hp:125,dmg:9,spd:14.5,rng:2.8,cd:0.7,cost:{food:80,gold:0},col:0xa8703d,line:"scoutline",rig:"scout",tier:1,age:1,mounted:true},
  elitescout:  {name:"Elite Scout Cavalry",hp:170,dmg:13,spd:15.5,rng:2.8,cd:0.7,cost:{food:100,gold:20},col:0xc9a86a,line:"scoutline",rig:"scout",tier:4,age:4,mounted:true},
  // ---- Siege (Siege Workshop) — devastate buildings, feeble vs troops ----
  batteringram:{name:"Battering Ram",hp:420,dmg:12,spd:4.5,rng:3.0,cd:1.2,cost:{gold:200,wood:200},col:0x6b4a2b,line:"meleesiege",rig:"ram",tier:2,age:2,bMult:8,uMult:0.25},
  cannon:      {name:"Cannon",hp:180,dmg:65,spd:5,rng:30,cd:4.2,cost:{gold:300,wood:300},col:0x2b2b2b,line:"meleesiege",rig:"cannon",tier:5,age:5,ranged:true,bMult:3,splash:2.2},
  catapult:    {name:"Catapult",hp:200,dmg:45,spd:4.5,rng:30,cd:5,cost:{gold:200,wood:200},col:0x8a6a3f,line:"rangedsiege",rig:"catapult",tier:2,age:2,ranged:true,bMult:3,splash:3,arc:true},
  trebuchet:   {name:"Trebuchet",hp:220,dmg:70,spd:3.8,rng:54,cd:6.5,cost:{gold:250,wood:250},col:0x7a5a34,line:"rangedsiege",rig:"treb",tier:4,age:4,ranged:true,bMult:3.5,splash:3.5,arc:true},
  culverin:    {name:"Culverin",hp:190,dmg:60,spd:5.2,rng:32,cd:4,cost:{gold:150,wood:250},col:0x3a3a42,line:"rangedsiege",rig:"cannon",tier:5,age:5,ranged:true,bMult:3,splash:2},
  // ---- Trade (Market) ----
  tradecart:  {name:"Trade Cart",hp:80, dmg:0,spd:7.5,rng:2,cd:1,cost:null,          col:0x8a6a3f,line:"trade",rig:"cart",tier:0,age:3},
  trader:     {name:"Trader",    hp:130,dmg:0,spd:9.5,rng:2,cd:1,cost:{food:25,gold:100},col:0xc9a227,line:"trade",rig:"cart",tier:0,age:3},
  oxcart:     {name:"Ox Cart",   hp:220,dmg:0,spd:7,  rng:2,cd:1,cost:{food:75,gold:75}, col:0x8a6a3f,line:"trade",rig:"oxcart",tier:0,age:0}, // v99: the heavy timber hauler — trained at Storage Pits, human-only
  // ---- Healer Line (Temple) ----
  priest:      {name:"Priest",hp:90,dmg:0,spd:8,rng:2,cd:1,cost:{food:60,gold:100},col:0xe8e2d0,line:"healer",rig:"priest",tier:3,age:3,heal:{rng:16,rate:4}},
  // ---- The Wilds (creep camps) — appended LAST so CLS_KEYS snapshot indices stay stable ----
  // cost = the kill bounty (costPts). Packs of 4-5 are tuned so 2-3 grouped players clear a camp; one alone dies.
  wolf:      {name:"Wild Wolf",hp:155,dmg:14,spd:11,rng:2.2,cd:0.9, cost:{food:30},col:0x8a8f96,line:"wilds",rig:"wolf",tier:0,age:0},
  barbarian: {name:"Barbarian",hp:155,dmg:18,spd:8.5,rng:2.5,cd:0.95,cost:{gold:40},col:0x8a5a3a,line:"wilds",rig:"barbarian",tier:0,age:0},
  // the shore raid (v79) — bounties: 40 pts a viking, 300 for the chieftain's head
  viking:    {name:"Viking Raider",hp:160,dmg:20,spd:8.5,rng:2.5,cd:0.9,cost:{food:20,gold:20},col:0x6a7a8c,line:"wilds",rig:"viking",tier:0,age:0},
  vikingboss:{name:"Viking Chieftain",hp:500,dmg:42,spd:7.5,rng:3.2,cd:1.4,cost:{food:150,gold:150},col:0x4a5a6c,line:"wilds",rig:"vikingboss",tier:0,age:0}
};

// unit lines: pick a LINE at its building; your team's AGE decides the tier you get
const LINES={
  melee:    {name:"Melee",building:"barracks",tiers:["clubman","shortsword","broadsword","legionaire","vanguard","musketeer"]},
  anticav:  {name:"Anti-Cavalry",building:"barracks",tiers:["spearman","spearfighter","impspear","hoplite","pikeman","halberdier"]},
  ranged:   {name:"Ranged",building:"archery_range",tiers:["slinger","archer","imparcher","comparcher","crossbowman","skirmisher"]},
  cavalry:  {name:"Cavalry",building:"stable",tiers:[null,"chariot","heavycav","cataphract","knight","dragoon"]},
  scoutline:{name:"Scout",building:"stable",tiers:[null,"scout",null,null,"elitescout",null]},
  meleesiege:{name:"Melee Siege",building:"siege_workshop",tiers:[null,null,"batteringram",null,null,"cannon"]},
  rangedsiege:{name:"Ranged Siege",building:"siege_workshop",tiers:[null,null,"catapult",null,"trebuchet","culverin"]},
  healer:   {name:"Healer",building:"temple",tiers:[null,null,null,"priest",null,null]}
};
function lineUnitFor(line,team){
  const t=LINES[line].tiers;
  for(let a=Math.min(teamAge[team],5);a>=0;a--)if(t[a])return t[a];
  return null;
}
function linesAt(type,team){
  const ls=Object.keys(LINES).filter(l=>LINES[l].building===type);
  if(type==="barracks"&&teamAge[team]===0)ls.push("ranged"); // Stone Age slingers
  return ls;
}
const TRAIN_BUILDINGS=["barracks","archery_range","stable","temple","market","siege_workshop","storage_pit"]; // v99: pits train the Ox Cart
function canBlock(u){
  return !u.ranged&&(["melee","anticav","cavalry","scoutline","royal"].includes(CLS[u.cls].line));
}
// rock–paper–scissors by LINE
function isSiege(cls){const l=CLS[cls].line;return l==="meleesiege"||l==="rangedsiege";}
function rps(attCls,defCls){ // ---- the v84 wheel ----
  if(CLS[attCls].uMult!==undefined)return CLS[attCls].uMult; // rams stay clumsy vs troops (artillery hits FULL since v84)
  const a=CLS[attCls].line,d=CLS[defCls].line;
  const dMounted=!!CLS[defCls].mounted, dSiege=isSiege(defCls);
  if((a==="ranged"||attCls==="musketeer")&&dSiege)return 0.15; // arrows & musket balls barely scratch war engines
  if(a==="anticav"&&dMounted)return 3.8;   // scouts die in 3 spear hits, same-age cavalry in 4
  if(a==="ranged"&&d==="anticav")return 1.8;
  if(a==="melee"&&!CLS[attCls].ranged){    // the SWORD tiers (the musket shot is a projectile; its bayonet has its own path)
    if(d==="ranged")return 1.8;
    if(d==="anticav")return 1.25;          // swords push through spear lines
    if(dSiege)return 2.0;                  // and DISMANTLE war engines
  }
  if(a==="cavalry"){                       // cavalry DOMINATES all but the spear
    if(d==="ranged")return 1.8;
    if(d==="melee")return 1.5;
    if(dSiege)return 1.5;
  }
  if(a==="scoutline"){
    if(d==="ranged")return 1.5;
    if(defCls==="villager"||defCls==="trader"||defCls==="tradecart")return 4.85; // economy killers: traders die in exactly 3 scout hits, villagers & carts in 2
  }
  return 1.0;
}
const BLD={
  towncenter:{name:"Town Center",hp:1500,r:11,cost:null,hits:0},
  house:     {name:"House",      hp:220, r:4.6,cost:{wood:40}, hits:8},
  barracks:  {name:"Barracks",   hp:480, r:7.2,cost:{gold:30,wood:100},hits:14},
  tower:     {name:"Guard Tower",hp:400, r:4.0,cost:{stone:250,wood:100},hits:10,atk:{dmg:9,rng:18,cd:1.1}}
};
BLD.storage_pit={name:"Storage Pit",hp:250,r:6.6,cost:{wood:75},hits:8};
BLD.archery_range={name:"Archery Range",hp:420,r:6.4,cost:{wood:125},hits:12};
BLD.stable={name:"Stable",hp:450,r:6.8,cost:{wood:125},hits:12};
BLD.temple={name:"Temple",hp:380,r:5.6,cost:{wood:150},hits:12,heal:{rng:10,rate:2}};
BLD.farm={name:"Farm",hp:150,r:6.6,cost:{wood:75},hits:8,flat:true};
BLD.market={name:"Market",hp:520,r:7.2,cost:{gold:25,stone:25,wood:125},hits:14};
BLD.siege_workshop={name:"Siege Workshop",hp:480,r:7.2,cost:{wood:200},hits:14};
BLD.watch_tower={name:"Watch Tower",hp:220,r:2.4,cost:{stone:50,wood:50},hits:6,vision:80};
BLD.blacksmith={name:"Blacksmith",hp:420,r:5.6,cost:{wood:100},hits:12}; // v87: spend quest XP here (E) — max 1 per team
BLD.wood_wall={name:"Wood Wall",hp:650,r:5.5,cost:{wood:55},hits:6,wall:true};
BLD.wood_gate={name:"Wood Gate",hp:560,r:5.8,cost:{wood:85},hits:7,wall:true,gate:true};
BLD.stone_wall={name:"Stone Wall",hp:1700,r:5.5,cost:{stone:100},hits:8,wall:true};
BLD.stone_gate={name:"Stone Gate",hp:1400,r:5.8,cost:{stone:75},hits:8,wall:true,gate:true};
BLD.fort_wall={name:"Fortified Wall",hp:3400,r:5.5,cost:{stone:200},hits:10,wall:true};
BLD.fort_gate={name:"Fortified Gate",hp:2800,r:5.8,cost:{stone:75},hits:10,wall:true,gate:true};
BLD.castle={name:"Castle",hp:3000,r:11,cost:{stone:500,wood:150},hits:30,
  atk:{dmg:14,rng:22,cd:4.5,volley:5,vcd:0.15},vision:75}; // v84: five arrows in rapid succession, then the long wind-down (DPS-neutral with the old 0.9s single shots)
BLD.towncenter.age=0; BLD.house.age=0; BLD.storage_pit.age=0; BLD.barracks.age=0;
BLD.archery_range.age=1; BLD.stable.age=1; BLD.farm.age=1; BLD.watch_tower.age=1;
BLD.siege_workshop.age=2; BLD.wood_wall.age=2; BLD.wood_gate.age=2; BLD.blacksmith.age=2;
BLD.tower.age=3; BLD.temple.age=3; BLD.market.age=3; BLD.stone_wall.age=3; BLD.stone_gate.age=3;
BLD.castle.age=4; BLD.fort_wall.age=4; BLD.fort_gate.age=4;

// ---------- the seven ages ----------
const AGES=[
  {name:"Stone Age"},
  {name:"Bronze Age",    cost:{food:600, gold:0}},
  {name:"Iron Age",      cost:{food:1200,gold:150}},
  {name:"Classical Age", cost:{food:1800,gold:300}},
  {name:"Medieval Age",  cost:{food:2400,gold:500}},
  {name:"Enlightenment Age",cost:{food:3000,gold:1000}}
];
const teamAge=[0,0,0]; // [2] is the wilds: ageless — keeps ageBuff/setClassStats sane for creeps
// v107: T at the Town Center no longer flips the age instantly — it starts a 90-second
// ADVANCE (pay now, no cancel). The age lands when the research timer does.
const AGE_RESEARCH_S=90;
const ageResT=[0,0,0];  // remaining research seconds per team ([2] wilds: always 0)
// units trained in later ages are stronger; Enlightenment adds a capstone
function ageBuff(team){return 1+0.06*teamAge[team]+(teamAge[team]>=5?0.15:0);} // Enlightenment curbstomps

const MAP={x:212,z:125};                // half-extents (+25% in v34)
const TCPOS=[[-175,0],[175,0]];        // blue, red town centers

// ---------- neutral creep camps (v77) ----------
// Six pockets of ground BUMPED OUT past the map border: one at each corner,
// two at the midpoints of the long (north/south) edges. Units may walk outside
// the border only inside these circles; creeps never leave them.
const CAMP_R=26;        // pocket radius — DOUBLED in v82: each camp is a proper hollow in the mountains
const CAMP_AGGRO=11.5;  // (legacy fallback — per-camp aggro is set from the pocket radius now)
const CREEP_N=5;        // creep bodies per camp (a 4-pack leaves the fifth dead) — fixed for net id order
const CAMP_RESPAWN=180; // seconds from pack wipe to the next wave (runs even if the chest sits)
const CAMP_CHEST=300;   // the treasure: 300 food (wolves) or 300 gold (barbarians)
// ---- the RAID BOSS shore (v79): the south-mid camp is a DOUBLE-size beachfront ----
const BOSS_R=52;        // twice a (doubled) camp — a whole bay
const BOSS_N=11;        // 1 Viking chieftain + 10 vikings, fixed body count for net id order
const BOSS_RESPAWN=900; // the raid lands at 15:00, and 15 minutes after every wipe
const BOSS_CHEST=500;   // TWO chests: 500 food AND 500 gold
// centers sit r-8 beyond the border: each pocket opens onto the map through a ~8-unit mouth,
// with the bulk of the hollow carved DEEP into the mountain ring
const CAMPS=[
  {x:-(MAP.x+CAMP_R-8),z:-(MAP.z+CAMP_R-8),r:CAMP_R},{x:MAP.x+CAMP_R-8,z:-(MAP.z+CAMP_R-8),r:CAMP_R}, // south corners
  {x:-(MAP.x+CAMP_R-8),z:MAP.z+CAMP_R-8,r:CAMP_R},{x:MAP.x+CAMP_R-8,z:MAP.z+CAMP_R-8,r:CAMP_R},       // north corners
  {x:0,z:-(MAP.z+BOSS_R-8),r:BOSS_R,boss:true},                                                       // SOUTH SHORE: the Viking bay
  {x:0,z:MAP.z+CAMP_R-8,r:CAMP_R}                                                                     // north-mid: a normal camp
];
function inCampGround(x,z){ // is this spot on a camp pocket's ground?
  for(const C of CAMPS){const dx=x-C.x,dz=z-C.z;if(dx*dx+dz*dz<C.r*C.r)return true;}
  return false;
}
// v83: the invisible wall sits at the MOUNTAINS, not the map line — a walkable apron
// rings the whole field (the ground between the border and the peaks' feet), and the
// camp pockets open straight off it. No more bumping into thin air on open grass.
const BORDER_FRINGE=9; // how far past the border the apron runs (the foothill line)
function walkable(x,z){
  if(Math.abs(x)<=MAP.x+BORDER_FRINGE&&Math.abs(z)<=MAP.z+BORDER_FRINGE)return true;
  return inCampGround(x,z);
}

// ---------- state ----------
let scene,camera,renderer,clock;
const units=[],buildings=[],nodes=[],projectiles=[],effects=[];
const stock=[{food:150,gold:50,stone:0,wood:75},{food:150,gold:50,stone:0,wood:75}];
let player=null;
const kings=[null,null];
let T=0, gameOver=false;
function setGameOver(v){gameOver=v;} // the test harness needs to reopen a finished war
function costPts(c){return c?((c.food||0)+(c.gold||0)+(c.stone||0)+(c.wood||0)):0;}
function awardPts(u,n){ // humans only: the host player and possessed guests
  if(u&&(u.isPlayer||u.remote)&&n>0)u.score=(u.score||0)+n*(1+0.10*buffSt(u,"bounty")); // Bounty Hunter pays a premium
}
function isHuman(u){return !!(u&&(u.isPlayer||u.remote));}

// ---------- QUESTING & THE BLACKSMITH (v87) ----------
// The Town Board by each Town Center hands out random quests (E). A finished quest
// pays +1 Level and +1 XP (the monsters pay 2). XP is the ONLY player-personal
// currency: spend it at the Blacksmith (Iron Age) for a random stacking buff.
// Death wipes level, XP and every buff. Max level 20. Bots never quest.
const XP_MAX_LVL=20, BUFF_MAX_STACK=3, BOARD_REACH=5; // v99: the reroll cooldown died — the board DRAFTS three, and rerolls are banked one per level
const RALLY_CAP=5; // v89: G rallies your five NEAREST soldiers — the Bannerman buff adds one per stack
const QUESTS=[ // {id,name,desc,ev,n,xp} — ev is the progress event; xp doubles as levels gained
  {id:"food100", name:"Provisioner",         desc:"Bank 100 food",                          ev:"dep_food",  n:100,xp:1},
  {id:"wood100", name:"Lumberjack",          desc:"Bank 100 wood",                          ev:"dep_wood",  n:100,xp:1},
  {id:"stone100",name:"Quarryman",           desc:"Bank 100 stone",                         ev:"dep_stone", n:100,xp:2},
  {id:"gold100", name:"Prospector",          desc:"Bank 100 gold",                          ev:"dep_gold",  n:100,xp:1},
  {id:"farm5",   name:"Green Thumb",         desc:"Build 5 farms",                          ev:"build_farm",n:5,  xp:1},
  {id:"house5",  name:"Town Planner",        desc:"Build 5 houses",                         ev:"build_house",n:5, xp:1},
  {id:"market1", name:"Merchant Prince",     desc:"Build a Market",                         ev:"build_market",n:1,xp:1},
  {id:"castle1", name:"Castellan",           desc:"Build a Castle",                         ev:"build_castle",n:1,xp:2},
  {id:"walls4",  name:"Mason of the Line",   desc:"Build 4 wall segments",                  ev:"build_wall",n:4,  xp:1},
  {id:"burn3",   name:"Crop Burner",         desc:"Raze 3 enemy farms",                     ev:"raze_farm", n:3,  xp:1},
  {id:"raze3",   name:"Demolitionist",       desc:"Raze 3 enemy buildings (farms aside)",   ev:"raze_bld",  n:3,  xp:2},
  {id:"vil3",    name:"Terror of the Fields",desc:"Kill 3 enemy villagers",                 ev:"kill_vil",  n:3,  xp:1},
  {id:"mil3",    name:"Soldier's Work",      desc:"Kill 3 enemy military units",            ev:"kill_mil",  n:3,  xp:1},
  {id:"creep5",  name:"Wolfsbane",           desc:"Slay 5 wild creatures",                  ev:"kill_creep",n:5,  xp:1},
  {id:"camp1",   name:"Camp Breaker",        desc:"Land the blow that wipes a wild camp",   ev:"camp_wipe", n:1,  xp:2},
  {id:"chest1",  name:"Treasure Hunter",     desc:"Claim a camp chest (steals count)",      ev:"chest",     n:1,  xp:1},
  {id:"trade3s", name:"Peddler",             desc:"Sell 3 loads from the NEAREST bazaar",   ev:"trade_short",n:3, xp:1},
  {id:"trade2m", name:"Caravan Master",      desc:"Sell 2 loads from the MIDDLE bazaar",    ev:"trade_mid", n:2,  xp:2},
  {id:"trade1l", name:"Silk Road",           desc:"Sell a load from the FARTHEST bazaar",   ev:"trade_long",n:1,  xp:2},
  {id:"harv5",   name:"Reaper",              desc:"Harvest 5 ripe farm crops",              ev:"harvest",   n:5,  xp:1},
  {id:"parry5",  name:"Perfect Guard",       desc:"Parry 5 attacks",                        ev:"parry",     n:5,  xp:1},
  {id:"train5",  name:"Master-at-Arms",      desc:"Take up arms 5 times (any class)",       ev:"train",     n:5,  xp:1},
  {id:"res2",    name:"Battlefield Medic",   desc:"Resurrect 2 fallen allies (Priest)",     ev:"res",       n:2,  xp:1},
  {id:"pistol1", name:"Last Shot",           desc:"Kill an enemy with the dragoon pistol",  ev:"pistol",    n:1,  xp:1},
  {id:"scout1",  name:"Eyes on the Throne",  desc:"Get within 25 of the enemy Town Center, then return home ALIVE", ev:"scout", n:1, xp:2}
];
const BUFFS=[ // random at the Blacksmith, 1 XP each, stacking to ×3
  {id:"dmg",    name:"Honed Edge",       desc:"+5% damage"},
  {id:"atkspd", name:"Quick Hands",      desc:"−0.1s attack cooldown"},
  {id:"crit",   name:"Keen Eye",         desc:"+5% chance of a CRITICAL (2× damage)"},
  {id:"shield", name:"Raised Shield",    desc:"−5% damage taken"},
  {id:"hp",     name:"Stout Heart",      desc:"+5% max HP"},
  {id:"dodge",  name:"Sixth Sense",      desc:"5% chance to dodge any blow"},
  {id:"spd",    name:"Fleet Foot",       desc:"+0.5 move speed"},
  {id:"carry",  name:"Deep Satchel",     desc:"+10 carry capacity"},
  {id:"gather", name:"Practiced Hands",  desc:"−0.1s per gather swing"},
  {id:"builder",name:"Master Builder",   desc:"buildings need fewer hits from you"},
  {id:"slayer", name:"Wild Slayer",      desc:"+15% damage vs the wilds' creatures"},
  {id:"captain",name:"Captain's Banner", desc:"+1% damage to allies fighting near you"},
  {id:"leech",  name:"Bloodthirst",      desc:"heal 1 HP with every hit you land"},
  {id:"regen",  name:"Second Skin",      desc:"+0.5 HP/s after 5s out of combat"},
  {id:"bounty", name:"Bounty Hunter",    desc:"+10% score points earned"},
  {id:"zeal",   name:"Zealotry",         desc:"−1.5s priest resurrect cooldown"},
  {id:"trade",  name:"Deep Pockets",     desc:"+10% trade-sell payout"},
  {id:"parry",  name:"Duelist",          desc:"+0.07s parry window"},
  {id:"siege",  name:"Siegewright",      desc:"+10% damage crewing siege engines"},
  {id:"wreck",  name:"Wrecker",          desc:"+10% damage vs buildings"},
  {id:"rally",  name:"Bannerman",        desc:"rally one additional troop"}
];
function buffSt(u,id){return (u&&u.buffs&&u.buffs[id])||0;} // stack count 0..3
function carryCap(u){return u&&u.cls==="oxcart"?300:20+10*buffSt(u,"carry");} // Deep Satchel · v99: the ox bed takes 300
const townBoards=[]; // {team,x,z,mesh} — stood up beside each Town Center by world gen
const MIL_LINES=["melee","anticav","ranged","cavalry","scoutline","meleesiege","rangedsiege"];

// ---------- v94: AI DIRECTOR PERSONALITIES ----------
// Every AI marshal rolls one at game start (announced by scouts ~45s in). Pure data —
// the exporter reads this table, so keep it closures-free. farms = farmsBase + farmsPerAge*age.
// trainW overrides the line weights when composing the army (base weights fill the gaps).
const PERSONALITIES={
  rush:{name:"Rush",flavor:"sharpens crude spears for early, relentless waves",
    ageBufF:900,ageBufG:400, farmsBase:2,farmsPerAge:1, pits:2,
    houses:8,towers:2,castles:1,markets:1,walls:0,
    raidAt:80,raidEvery:45,raidJit:25,raidMin:5,raidFrac:0.75,
    trainMin:2.2,trainMax:4, minVills:9, reserveF:40,reserveG:15, kgBase:4,
    econHunters:2,assassins:1,
    trainW:{melee:5,anticav:4,ranged:2,cavalry:2,scoutline:3,rangedsiege:1,meleesiege:0}},
  boom:{name:"Boom",flavor:"hoards grain and gold, racing for the Enlightenment",
    ageBufF:60,ageBufG:25, farmsBase:4,farmsPerAge:2, pits:4,
    houses:10,towers:2,castles:1,markets:3,walls:0,
    raidAt:400,raidEvery:110,raidJit:40,raidMin:12,raidFrac:0.5,
    trainMin:4,trainMax:5, minVills:14, reserveF:220,reserveG:90, kgBase:7,
    econHunters:0,assassins:0,
    trainW:{melee:3,anticav:3,ranged:3,cavalry:3,scoutline:1,rangedsiege:3,meleesiege:1}},
  turtle:{name:"Turtle",flavor:"piles stone on stone — walls, towers and patience",
    ageBufF:300,ageBufG:120, farmsBase:3,farmsPerAge:1, pits:2,
    houses:8,towers:4,castles:2,markets:1,walls:8,
    raidAt:600,raidEvery:150,raidJit:60,raidMin:16,raidFrac:0.85,
    trainMin:3,trainMax:4.5, minVills:12, reserveF:120,reserveG:60, kgBase:9,
    econHunters:0,assassins:0,
    trainW:{melee:2,anticav:3,ranged:5,cavalry:1,scoutline:1,rangedsiege:3,meleesiege:1}},
  expand:{name:"Expansionist",flavor:"builds wide — pits, markets and fields without end",
    ageBufF:200,ageBufG:80, farmsBase:3,farmsPerAge:2, pits:5,
    houses:14,towers:3,castles:2,markets:5,walls:0,
    raidAt:280,raidEvery:90,raidJit:40,raidMin:9,raidFrac:0.55,
    trainMin:3,trainMax:4.5, minVills:13, reserveF:140,reserveG:60, kgBase:6,
    econHunters:1,assassins:0,
    trainW:{melee:3,anticav:3,ranged:3,cavalry:3,scoutline:2,rangedsiege:2,meleesiege:1}}
};
// ---------- v94: AI DIFFICULTY (applies to teams with NO human players) ----------
// easy/hard are the co-op & solo dials; "normal" is the supportive brain human teams keep.
const AI_DIFF={
  easy:  {name:"Easy",  think:2.2, eco:1.0, raidMul:1.6,  raidFracMul:0.6, trainMul:1.6, buf:1.5, counter:false},
  normal:{name:"Normal",think:1.0, eco:1.0, raidMul:1.0,  raidFracMul:1.0, trainMul:1.0, buf:1.0, counter:false},
  hard:  {name:"Hard",  think:0.6, eco:1.2, raidMul:0.75, raidFracMul:1.1, trainMul:0.7, buf:0.8, counter:true}
};
let aiDifficulty="easy"; // the solo/co-op dial (EASY|HARD in the menus); human teams always run "normal"
let MYTEAM=BLUE; // the LOCAL player's team — red guests flip this on join
let inMenu=true, menuOrbitT=0; // v81: the war WAITS at the main menu — the world idles as a cinematic backdrop
let siegeAim=false, lobTarget={x:0,z:0}, lobRing=null; // the catapult/trebuchet skill shot
let camYaw=Math.PI/2, camPitch=0.62, camDist=18;

// ---------- optional character models ----------
// Drop rigged .glb files into assets/models/ and register them here.
// Classes WITHOUT an entry keep the built-in blocky rig. See
// assets/models/README-ASSETS.md for free CC0 sources and tips.
// Example:
//   man_at_arms:{file:"assets/models/knight.glb", scale:1.2, y:0, rotY:Math.PI},
const MODEL_MANIFEST={}; // imported models retired — characters use generated pixel skins.
// The Tripo→Mixamo pipeline (tools/autorig.py, tools/mixamo_merge.py) still works if
// a hero model is ever wanted: register it here and it overrides the generated look.

// ---------- trade ----------
// neutral bazaars: near / center / deep — risk scales with distance, gold scales harder
const neutralMarkets=[]; // populated by world gen: {x,z}
function tradeGold(d){return Math.round(0.35*d+0.002*d*d);} // superlinear: risk pays a premium
