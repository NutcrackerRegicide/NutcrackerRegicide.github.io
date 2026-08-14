#!/usr/bin/env node
/* patch-quests-data.js — v132.28 spine, layer 1: the tables.
 *
 *  · XP_MAX_LVL 20 -> 25 (John).
 *  · Every quest gains an `age` — the earliest AGES index at which the board may post it.
 *    Values are John's "Age Available" column in docs/REGICIDE-STATS-vFUTURE (Draft).csv.
 *    You should not be handed "Build a Market" in the Stone Age.
 *  · Perfect Guard (parry5) deleted, per John. The `parry` progress call site in
 *    05-combat.js:317 is deliberately LEFT ALONE — it is harmless with no quest reading it,
 *    and the Duelist buff still uses the parry window. Removing it is a separate concern.
 *  · Seven new postings; ids and names mine, from the blank rows of the CSV.
 *  · Two scalars corrected to the CSV: camp1 xp 2 -> 1, res2 xp 1 -> 2.
 *  · trade2m desc MIDDLE -> GRAND, camp1 desc now says "participate", both per the CSV.
 *  · n read from the DESCRIPTION where the CSV carried a placeholder 1: ox_wood 300,
 *    heal_hp 200, build_tower 2. The descriptions are unambiguous; the column was not filled in.
 *
 * ⚠ WIRE: QUESTS is indexed POSITIONALLY — `qst` carries {qi:questIndex} (09-main.js:379,
 *   10-net.js:1634) and `qdraft` carries three of those indices. Deleting parry5 and appending
 *   seven rows moves every index after position 20. PROTO MUST BUMP: 33 -> 34. That happens in
 *   the delivery layer, so the bump is one decision in one place. Nothing here draws from the
 *   seeded window in 02-world.js, so node placement cannot move — nodehash must be unchanged.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","00-data.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("max level",
  `const XP_MAX_LVL=20, BUFF_MAX_STACK=3, BOARD_REACH=5;`,
  `const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5;`);

sub("the contract comment",
  `// Death wipes level, XP and every buff. Max level 20. Bots never quest.`,
  `// Death wipes level, XP and every buff. Max level 25. Bots never quest.
// v132.28: every quest carries an \`age\` — the earliest AGES index the board may post it at.
// The board deals only from what your team's age has unlocked, so the Stone Age never offers
// "Build a Castle". Ages: 0 Stone · 1 Bronze · 2 Iron · 3 Classical · 4 Medieval · 5 Enlightenment.`);

const NEW_TABLE=`const QUESTS=[ // {id,name,desc,ev,n,xp,age} — ev is the progress event; xp doubles as levels gained
  {id:"food100", name:"Provisioner",         desc:"Bank 100 food",                          ev:"dep_food",  n:100,xp:1,age:0},
  {id:"wood100", name:"Lumberjack",          desc:"Bank 100 wood",                          ev:"dep_wood",  n:100,xp:1,age:0},
  {id:"stone100",name:"Quarryman",           desc:"Bank 100 stone",                         ev:"dep_stone", n:100,xp:2,age:0},
  {id:"gold100", name:"Prospector",          desc:"Bank 100 gold",                          ev:"dep_gold",  n:100,xp:1,age:0},
  {id:"farm5",   name:"Green Thumb",         desc:"Build 5 farms",                          ev:"build_farm",n:5,  xp:1,age:1},
  {id:"house5",  name:"Town Planner",        desc:"Build 5 houses",                         ev:"build_house",n:5, xp:1,age:0},
  {id:"market1", name:"Merchant Prince",     desc:"Build a Market",                         ev:"build_market",n:1,xp:1,age:3},
  {id:"castle1", name:"Castellan",           desc:"Build a Castle",                         ev:"build_castle",n:1,xp:2,age:4},
  {id:"walls4",  name:"Mason of the Line",   desc:"Build 4 wall segments",                  ev:"build_wall",n:4,  xp:1,age:2},
  {id:"burn3",   name:"Crop Burner",         desc:"Raze 3 enemy farms",                     ev:"raze_farm", n:3,  xp:1,age:0},
  {id:"raze3",   name:"Demolitionist",       desc:"Raze 3 enemy buildings (farms aside)",   ev:"raze_bld",  n:3,  xp:2,age:0},
  {id:"vil3",    name:"Terror of the Fields",desc:"Kill 3 enemy villagers",                 ev:"kill_vil",  n:3,  xp:1,age:0},
  {id:"mil3",    name:"Soldier's Work",      desc:"Kill 3 enemy military units",            ev:"kill_mil",  n:3,  xp:1,age:0},
  {id:"creep5",  name:"Wolfsbane",           desc:"Slay 5 wild creatures",                  ev:"kill_creep",n:5,  xp:1,age:0},
  {id:"camp1",   name:"Camp Breaker",        desc:"Participate in defeating a wild creep camp", ev:"camp_wipe", n:1, xp:1,age:0},
  {id:"chest1",  name:"Treasure Hunter",     desc:"Claim a camp chest (steals count)",      ev:"chest",     n:1,  xp:1,age:0},
  {id:"trade3s", name:"Peddler",             desc:"Sell 3 loads from the NEAREST bazaar",   ev:"trade_short",n:3, xp:1,age:3},
  {id:"trade2m", name:"Caravan Master",      desc:"Sell 2 loads from the GRAND bazaar",     ev:"trade_mid", n:2,  xp:2,age:3},
  {id:"trade1l", name:"Silk Road",           desc:"Sell a load from the FARTHEST bazaar",   ev:"trade_long",n:1,  xp:2,age:3},
  {id:"harv5",   name:"Reaper",              desc:"Harvest 5 ripe farm crops",              ev:"harvest",   n:5,  xp:1,age:1},
  {id:"train5",  name:"Master-at-Arms",      desc:"Take up arms 5 times (any class)",       ev:"train",     n:5,  xp:1,age:0},
  {id:"res2",    name:"Battlefield Medic",   desc:"Resurrect 2 fallen allies (Priest)",     ev:"res",       n:2,  xp:2,age:3},
  {id:"pistol1", name:"Last Shot",           desc:"Kill an enemy with the dragoon pistol",  ev:"pistol",    n:1,  xp:1,age:5},
  {id:"scout1",  name:"Eyes on the Throne",  desc:"Get within 25 of the enemy Town Center, then return home ALIVE", ev:"scout", n:1, xp:2,age:0},
  // ---- v132.28: the seven new postings (ids/names mine; desc, n, xp and age are John's) ----
  {id:"oxplun1", name:"Highwayman",          desc:"Plunder an enemy ox cart",               ev:"plunder_ox",n:1,  xp:2,age:0},
  {id:"trplun1", name:"Road Agent",          desc:"Plunder an enemy trader or trade cart",  ev:"plunder_tr",n:1,  xp:2,age:3},
  {id:"oxwood",  name:"Timber Haul",         desc:"Gather 300 wood with an ox cart",        ev:"ox_wood",   n:300,xp:1,age:0},
  {id:"grand1",  name:"Lord of the Crossroads",desc:"Capture the Grand Bazaar",             ev:"cap_grand", n:1,  xp:3,age:0},
  {id:"heal200", name:"Field Surgeon",       desc:"Heal 200 HP of allies (Priest)",         ev:"heal_hp",   n:200,xp:2,age:3},
  {id:"horse1",  name:"Horsebane",           desc:"Cut down a mounted enemy with a spear line unit", ev:"counter_cav",n:1,xp:1,age:0},
  {id:"tower2",  name:"Watchwarden",         desc:"Build 2 Guard Towers",                   ev:"build_tower",n:2, xp:1,age:3}
];`;

const OLD_START=`const QUESTS=[ // {id,name,desc,ev,n,xp} — ev is the progress event; xp doubles as levels gained`;
const OLD_END=`  {id:"scout1",  name:"Eyes on the Throne",  desc:"Get within 25 of the enemy Town Center, then return home ALIVE", ev:"scout", n:1, xp:2}\n];`;
const i0=s.indexOf(OLD_START), i1=s.indexOf(OLD_END);
if(i0<0)failed.push("QUESTS block start not found");
else if(i1<0)failed.push("QUESTS block end not found");
else if(s.indexOf(OLD_START,i0+1)>=0)failed.push("QUESTS block start matched more than once");
else s=s.slice(0,i0)+NEW_TABLE+s.slice(i1+OLD_END.length);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/00-data.js — max level 25, quest table reworked");
