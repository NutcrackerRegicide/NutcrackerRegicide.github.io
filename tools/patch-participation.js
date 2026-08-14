#!/usr/bin/env node
/* patch-participation.js — v132.28 spine, layer 3: who actually helped.
 *
 * Nothing in this game has ever tracked contribution. Every credit path — score, quests, the
 * kill streak — reads a single `killer` argument and pays the last blow. So "participating in
 * clearing a camp" had no state to stand on and had to be built.
 *
 * THE RULE (John): any damage to any member of the camp puts you on the list.
 *
 * WHERE. There is already exactly one place that knows "a camp member was hurt, and by whom" —
 * the v132.10 wake site in dealDamage (05-combat.js:370). It even filters out towers and the
 * wilds for its own reasons, which are the same units we must not credit. Recording there means
 * participation cannot drift out of step with aggro: one site, one truth.
 *
 * WHAT IT PAYS. 1 XP per creep camp, 15 XP for the Viking raid (the chieftain and his ten).
 *
 *   ⚠ XP ONLY — NOT A LEVEL. This is a deliberate and reversible design call, and it is the
 *   answer to §5.3 #2. Today level and XP are minted together by completeQuest, and the board
 *   CLOSES at the level cap, so a life yields ~25 XP ever against the 63 needed to max the
 *   forge — the economy is unreachable by construction. A second faucet that pays XP without
 *   level breaks that coupling: camps and the raid make the forge reachable, while `level`
 *   stays a record of quests finished and therefore stays honest as the thing the aura reads.
 *   If you want camps to pay levels too, it is `u.xp+=gain` -> also bumping u.lvl, one line.
 *
 * CAMP BREAKER moves with it. The quest's own text is now "Participate in defeating a wild
 * creep camp", so the last-hit call in killUnit (05-combat.js:497) is REMOVED and the quest
 * fires for every participant instead. Leaving both in would not double-pay — an n:1 quest
 * completes and clears — but it would leave two rules for one event, and the next person to
 * read it would not know which one was in force.
 *
 * A participant must be ALIVE at the wipe to collect. Death already wipes XP to zero, so
 * paying a corpse is paying nothing; requiring `alive` also stops a body that has since
 * respawned from collecting on a fight it no longer remembers.
 *
 * No wire change: XP already rides `qst` (l,x,qi,qp) and `bff` (b,x), and both are pushed here.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function load(p){return fs.readFileSync(p,"utf8");}
function mk(src){
  return function sub(name,from,to){
    const n=src.o.split(from).length-1;
    if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
    src.o=src.o.split(from).join(to);
  };
}
const COMBAT=path.join(__dirname,"..","js","05-combat.js");
const AI=path.join(__dirname,"..","js","07-ai.js");
const c={o:load(COMBAT)}, a={o:load(AI)};
const subC=mk(c), subA=mk(a);

// ---- 1. RECORD. The wake site already isolates "a camp member, hurt, by a real combatant". ----
subC("record participation at the wake site",
`  if(victim.bot&&victim.bot.camp&&att&&!att.def&&att.team!==undefined&&att.team!==NEUTRAL){
    victim.bot.camp.wake=T+CAMP_WAKE;
    victim.bot.camp.threat=att;
  }`,
`  if(victim.bot&&victim.bot.camp&&att&&!att.def&&att.team!==undefined&&att.team!==NEUTRAL){
    victim.bot.camp.wake=T+CAMP_WAKE;
    victim.bot.camp.threat=att;
    // v132.28 PARTICIPATION. Any damage to any member puts a human on the camp's list; the
    // pack is cleared by whoever fought it, not by whoever landed the last blow. Bots are not
    // recorded — they never quest and hold no XP (the isHuman gate is the same one questProgress
    // uses). The list lives on the CAMP STATE, so it survives the death of any individual creep
    // and is cleared when the next wave lands.
    if(typeof isHuman==="function"&&isHuman(att)){
      const _st=victim.bot.camp;
      if(!_st.part)_st.part=[];
      if(_st.part.indexOf(att)<0)_st.part.push(att);
    }
  }`);

// ---- 2. STOP PAYING THE LAST BLOW. ----
subC("retire the last-hit camp_wipe",
`    if(killer&&!killer.def&&isHuman(killer)&&u.bot.camp&&!u.bot.camp.waiting&&
       u.bot.camp.creeps.every(c=>!c.alive)&&typeof questProgress==="function")
      questProgress(killer,"camp_wipe"); // CAMP BREAKER: this blow felled the last of the pack`,
`    // v132.28: CAMP BREAKER no longer belongs to the last blow — campTick pays every
    // participant when the pack falls (07-ai.js). One event, one rule, one place.`);

// ---- 3. PAY. ----
subA("pay the participants on the wipe",
`    let alive=0; for(const c of st.creeps)if(c.alive)alive++;
    if(alive===0){ // pack wiped: drop the loot, start the clock
      st.waiting=true; st.respawnAt=T+(st.boss?BOSS_RESPAWN:CAMP_RESPAWN);`,
`    let alive=0; for(const c of st.creeps)if(c.alive)alive++;
    if(alive===0){ // pack wiped: drop the loot, start the clock
      st.waiting=true; st.respawnAt=T+(st.boss?BOSS_RESPAWN:CAMP_RESPAWN);
      campPayParticipants(st); // v132.28: XP to everyone who fought it, before the loot lands`);

subA("the payer",
`// creep brain: guard the camp, savage intruders, never step past the pocket's edge`,
`// v132.28 THE RECKONING. Called once, on the frame the last creep falls. Pays every human who
// put damage into the pack: 1 XP for a wild camp, CAMP_XP_BOSS for the Viking raid. XP only —
// see tools/patch-participation.js for why level is deliberately not minted here.
const CAMP_XP=1, CAMP_XP_BOSS=15;
function campPayParticipants(st){
  const list=st.part; st.part=null;
  if(!list||!list.length)return;
  const gain=st.boss?CAMP_XP_BOSS:CAMP_XP;
  for(const u of list){
    if(!u||!u.alive)continue;                       // a corpse holds no XP — death already took it
    if(typeof isHuman!=="function"||!isHuman(u))continue;
    u.xp=(u.xp||0)+gain;
    if(typeof questNotify==="function")
      questNotify(u,(st.boss?"⚑ THE RAID IS BROKEN":"⚑ CAMP CLEARED")+" — +"+gain+" XP for your part in it. Spend it at the Blacksmith.","gold");
    if(typeof questProgress==="function")questProgress(u,"camp_wipe"); // CAMP BREAKER, for every participant
    if(typeof syncQuest==="function")syncQuest(u);
    if(typeof syncBuffs==="function")syncBuffs(u);
    if(u.isPlayer&&typeof updateQuestHud==="function")updateQuestHud();
  }
}
// creep brain: guard the camp, savage intruders, never step past the pocket's edge`);

// ---- 4. A NEW WAVE STARTS A CLEAN SHEET. ----
subA("clear the list on a fresh wave",
`function campNewWave(st){ // fresh fangs: roll the pack anew
  st.waiting=false;`,
`function campNewWave(st){ // fresh fangs: roll the pack anew
  st.waiting=false;
  st.part=null; // v132.28: a new pack, a new list — nobody carries credit across waves`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(COMBAT,c.o);
fs.writeFileSync(AI,a.o);
console.log("patched js/05-combat.js + js/07-ai.js — participation tracking, camp/raid XP");
