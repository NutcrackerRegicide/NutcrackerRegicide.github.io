#!/usr/bin/env node
/* patch-buffs-shape.js — v132.30 BATCH 0: the buff table gets a per-buff ceiling, and the
 * eighteen new buffs that need no new machinery are added (BATCH A of John's CSV).
 *
 * ── PER-BUFF MAX STACKS ─────────────────────────────────────────────────────────────────────
 * John's CSV adds a "Number of Max Stacks" column: 1, 2, 3 or 5 depending on the buff. The
 * global `BUFF_MAX_STACK=3` is kept as the DEFAULT for anything without its own `max`, so an
 * omitted field degrades to the old behaviour rather than to zero. `buffMax(id)` is the one door;
 * the seven places that read the global directly now read it.
 *
 * `BUFF_BY_ID` is a lookup map built once. `BUFFS.find()` per call was fine at 21 entries and is
 * the wrong shape at 39 and heading for 63.
 *
 * ── THE WIRE ────────────────────────────────────────────────────────────────────────────────
 * Worth stating because I got it wrong out loud first: BUFFS is NOT positionally indexed. The
 * forge ships `{t:"smith",offer:[...]}` as ID STRINGS (09-main.js smithOffer pushes `.id`), the
 * pick rides as `{pick:id}`, and `bff` ships `{b:u.buffs}` — an id→count map. So appending rows
 * renumbers nothing.
 *   PROTO STILL BUMPS, 34 -> 35, for a different reason: a v132.29 peer receiving an offer
 *   containing a new id has no BUFFS entry for it and would render an undefined name. The
 *   incompatibility is the vocabulary, not the numbering.
 *
 * ── WHAT IS IN THIS BATCH, AND WHAT IS NOT ──────────────────────────────────────────────────
 * Eighteen buffs that hook existing code and introduce NO new system. Deliberately excluded and
 * queued for later batches: timed self-buffs (a temporary-modifier system), DoTs/stuns/cleanse
 * (a status-effect system on the ENEMY, which also touches the wire), radius auras (a radius
 * tick), and procs/charges (projectile plumbing). One new system per batch, so a red is
 * attributable.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){
  return function sub(name,from,to){
    const n=box.o.split(from).length-1;
    if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
    box.o=box.o.split(from).join(to);
  };
}
const P={data:path.join(__dirname,"..","js","00-data.js"),
         main:path.join(__dirname,"..","js","09-main.js"),
         net:path.join(__dirname,"..","js","10-net.js")};
const d={o:fs.readFileSync(P.data,"utf8")}, m={o:fs.readFileSync(P.main,"utf8")},
      n={o:fs.readFileSync(P.net,"utf8")};
const subD=mk(d), subM=mk(m), subN=mk(n);

// ---------------- the table ----------------
const NEW_BUFFS=`const BUFFS=[ // random at the Blacksmith, 1 XP each. \`max\` is the per-buff stack ceiling
  // ---- the original twenty-one; \`max\` values are John's CSV column ----
  {id:"dmg",    name:"Honed Edge",       desc:"+5% damage",                                  max:5},
  {id:"atkspd", name:"Quick Hands",      desc:"−0.1s attack cooldown",                       max:5},
  {id:"crit",   name:"Keen Eye",         desc:"+5% chance of a CRITICAL (2× damage)",        max:3},
  {id:"shield", name:"Raised Shield",    desc:"−5% damage taken",                            max:5},
  {id:"hp",     name:"Stout Heart",      desc:"+5% max HP",                                  max:5},
  {id:"dodge",  name:"Sixth Sense",      desc:"5% chance to dodge any blow",                 max:3},
  {id:"spd",    name:"Fleet Foot",       desc:"+0.5 move speed",                             max:3},
  {id:"carry",  name:"Deep Satchel",     desc:"+10 carry capacity",                          max:5},
  {id:"gather", name:"Practiced Hands",  desc:"−0.1s per gather swing",                      max:5},
  {id:"builder",name:"Master Builder",   desc:"buildings need fewer hits from you",          max:3},
  {id:"slayer", name:"Wild Slayer",      desc:"+15% damage vs the wilds' creatures",         max:5},
  {id:"captain",name:"Captain's Banner", desc:"+1% damage to allies fighting near you",       max:3},
  {id:"leech",  name:"Bloodthirst",      desc:"heal 1 HP with every hit you land",           max:5},
  {id:"regen",  name:"Second Skin",      desc:"+0.5 HP/s after 5s out of combat",            max:5},
  {id:"bounty", name:"Bounty Hunter",    desc:"+10% score points earned",                    max:3}, // CSV left blank — held at the old global
  {id:"zeal",   name:"Zealotry",         desc:"−1.5s priest resurrect cooldown",             max:3},
  {id:"trade",  name:"Deep Pockets",     desc:"+10% trade-sell payout",                      max:3},
  {id:"parry",  name:"Duelist",          desc:"+0.07s parry window",                         max:3},
  {id:"siege",  name:"Siegewright",      desc:"+10% damage crewing siege engines",           max:3},
  {id:"wreck",  name:"Wrecker",          desc:"+10% damage vs buildings",                    max:3},
  {id:"rally",  name:"Bannerman",        desc:"rally one additional troop",                  max:3},
  // ---- v132.30 BATCH A: eighteen that hook existing code and need no new system ----
  {id:"ambush", name:"First Blood",      desc:"+50% damage to enemies at FULL health",       max:1},
  {id:"trophy", name:"Trophy Hunter",    desc:"+1 max HP with every kill, up to +100",       max:1},
  {id:"cull",   name:"Culler",           desc:"instantly slay wild creatures below 15% HP",  max:1},
  {id:"feast",  name:"Second Wind",      desc:"restore 10% of your HP on a kill",            max:3},
  {id:"fervor", name:"Desperation",      desc:"+0.5% attack speed per 1% of health missing", max:1},
  {id:"purse",  name:"Cutpurse",         desc:"pocket 10 gold on a kill",                    max:1},
  {id:"forage", name:"Scavenger",        desc:"pocket 10 food on a kill",                    max:1},
  {id:"mule",   name:"Pack Mule",        desc:"(villager) a fuller load moves faster, to +10%",max:1},
  {id:"thorns", name:"Bramble Mail",     desc:"deal 1 damage back to a melee attacker",      max:3},
  {id:"tribute",name:"Blood Tax",        desc:"gain 1 gold whenever you take damage",        max:1},
  {id:"alchemy",name:"Gilded Harvest",   desc:"mining gold also feeds your team",            max:1},
  {id:"reaping",name:"Rich Soil",        desc:"+20 extra food when you harvest a farm",      max:1},
  {id:"bulwark",name:"Bulwark",          desc:"defensive structures cost you half",          max:1},
  {id:"enginebane",name:"Enginebane",    desc:"(ranged) +50% damage to siege engines",       max:1},
  {id:"woods",  name:"Woodsman",         desc:"+10% damage while fighting in the woods",     max:1},
  {id:"warden", name:"Beast Warden",     desc:"take 10% less damage from the wilds",         max:3},
  {id:"yeoman", name:"Yeoman",           desc:"(villager) double health and double damage",  max:1},
  {id:"kguard", name:"King's Guard",     desc:"+10% damage and −10% damage taken near your King",max:1}
];
// one lookup, built once. BUFFS.find() per call was fine at 21 entries and is the wrong shape
// at 39 and heading for 63.
const BUFF_BY_ID={}; for(const _b of BUFFS)BUFF_BY_ID[_b.id]=_b;
// the per-buff ceiling. A buff with no \`max\` falls back to the old global, so an omitted field
// degrades to the previous behaviour instead of to zero.
function buffMax(id){const B=BUFF_BY_ID[id];return (B&&B.max)||BUFF_MAX_STACK;}`;

{
  const START=`const BUFFS=[ // random at the Blacksmith, 1 XP each, stacking to ×3`;
  const END=`  {id:"rally",  name:"Bannerman",        desc:"rally one additional troop"}\n];`;
  const i0=d.o.indexOf(START), i1=d.o.indexOf(END);
  if(i0<0)failed.push("BUFFS start");
  else if(i1<0)failed.push("BUFFS end");
  else d.o=d.o.slice(0,i0)+NEW_BUFFS+d.o.slice(i1+END.length);
}

subD("buffSt comment",
`function buffSt(u,id){return (u&&u.buffs&&u.buffs[id])||0;} // stack count 0..3`,
`function buffSt(u,id){return (u&&u.buffs&&u.buffs[id])||0;} // stack count, 0..buffMax(id)`);

// ---------------- the seven readers of the global ----------------
subM("smithOffer pool",
`  const pool=BUFFS.filter(b=>buffSt(u,b.id)<BUFF_MAX_STACK); // maxed buffs never deal in`,
`  const pool=BUFFS.filter(b=>buffSt(u,b.id)<buffMax(b.id)); // maxed buffs never deal in`);
subM("smithOffer prune",
`    u.smithOffer=u.smithOffer.filter(id=>buffSt(u,id)<BUFF_MAX_STACK);`,
`    u.smithOffer=u.smithOffer.filter(id=>buffSt(u,id)<buffMax(id));`);
subM("smithPick gate",
`  if(buffSt(u,id)>=BUFF_MAX_STACK)return false;`,
`  if(buffSt(u,id)>=buffMax(id))return false;`);
subM("smithPick grant",
`  u.buffs[id]=Math.min(BUFF_MAX_STACK,(u.buffs[id]||0)+1);
  u.smithOffer=null; // chosen: the next visit deals a fresh trio`,
`  u.buffs[id]=Math.min(buffMax(id),(u.buffs[id]||0)+1);
  u.smithOffer=null; // chosen: the next visit deals a fresh trio`);
subM("smithPick notify",
`  questNotify(u,"🔨 "+B.name+" — "+B.desc+" (stack "+u.buffs[id]+"/"+BUFF_MAX_STACK+"). XP left: "+u.xp,"gold");`,
`  questNotify(u,"🔨 "+B.name+" — "+B.desc+" (stack "+u.buffs[id]+"/"+buffMax(id)+"). XP left: "+u.xp,"gold");`);
subM("all-maxed message",
`  if(!offer){questNotify(u,"🔨 Every buff already rings at full strength (×"+BUFF_MAX_STACK+") — a living legend.","gold");return;}`,
`  if(!offer){questNotify(u,"🔨 Every buff already rings at full strength — a living legend.","gold");return;}`);
subM("grantBuff",
`  u.buffs[id]=Math.min(BUFF_MAX_STACK,(u.buffs[id]||0)+1);
  applyBuffStats(u); syncBuffs(u);`,
`  u.buffs[id]=Math.min(buffMax(id),(u.buffs[id]||0)+1);
  applyBuffStats(u); syncBuffs(u);`);

// ---------------- the wire ----------------
subN("PROTO 34 -> 35",
`  PROTO:34,             // v132.28 the quest table: Perfect Guard deleted and seven postings appended,`,
`  PROTO:35,             // v132.30 the buff vocabulary: eighteen new ids at the forge. BUFFS is NOT
                        // positionally indexed — \`smith.offer\` and \`act:"buff"\` carry ID STRINGS and
                        // \`bff.b\` is an id→count map — so nothing renumbers. The break is that a .29
                        // peer has no BUFFS entry for the new ids and would render an undefined name.
                        // v132.28 the quest table: Perfect Guard deleted and seven postings appended,`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.data,d.o); fs.writeFileSync(P.main,m.o); fs.writeFileSync(P.net,n.o);
console.log("patched — per-buff max stacks, 18 new buffs, PROTO 35");
