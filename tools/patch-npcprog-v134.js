#!/usr/bin/env node
/* patch-npcprog-v134.js — v134.2 THE VETERANS. NPCs finally carry what they fight for.
 *
 * The handoff called this "the biggest single lever available on AI difficulty, and it is untouched",
 * and it was right for a plain reason: by minute 30 a player is carrying 25 levels and a full
 * loadout against an opponent with literally none of either.
 *
 * THE FACT THAT MAKES THIS SAFE. Levels multiply nothing. Every read of `u.lvl` in the codebase is
 * the aura tint, the quest cap, the HUD and the nametag — no damage, HP, speed or cooldown formula
 * touches it. All sixty pieces of power live in BUFFS, and buffSt() is a pure read on u.buffs with
 * no gate of its own. So bot strength has exactly ONE dial — how many buff stacks a bot ends up
 * holding — and levels are free.
 *
 * JOHN'S RULINGS, implemented literally:
 *   · a level per THREE enemy soldiers killed ("one is too frequent"), plus camp participation,
 *     which is the same rule that already pays a human and was only ever gated off;
 *   · death takes half the level and all the buffs, exactly as it takes them from you;
 *   · no gold aura for a bot — that stays a player's mark. The veteran marker is a separate change.
 *
 * WHY A NEW PREDICATE AND NOT A WIDER isHuman. isHuman has 34 call sites and at most of them it does
 * NOT mean "carries progression" — it means "a real player's screen is watching this", which gates
 * quests, kill-feed growls, the Town Board, per-owner net messages and the HUD. Widening it would
 * hand bots quest state they can never use and spray owner-channel sends at bodies with no owner.
 * hasProg() is the progression question, asked separately, at the sites that are actually about
 * progression. ⚠ awardPts (00-data.js:879) inlines the isHuman predicate rather than calling it and
 * deliberately does NOT follow: the scoreboard is a roll of PLAYERS.
 *
 * WHO CARRIES IT: soldiers only. Not villagers — a villager quietly holding three buffs is invisible
 * power and half the economy would be carrying it. Not trade carts, not the King (a win condition,
 * not a duellist), not the wilds (their own balance, and CAMP_XP already pays the humans who clear
 * them). A LEVIED villager starts earning the moment it takes up arms, because by then it is a
 * soldier by every other rule in the game.
 *
 * THE BLIND DEAL. A bot has no forge to walk to and no menu to read, so it takes one random piece it
 * is not already holding at its ceiling, one XP each — where a player is dealt three and picks. That
 * is a real handicap and a deliberate one: it is the difference between a build and a bag, and it is
 * the first dial to reach for if bots come out too strong.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const FILES={"js/00-data.js":null,"js/05-combat.js":null,"js/07-ai.js":null,
             "js/09-main.js":null,"js/03-buildings.js":null};
for(const k in FILES)FILES[k]=fs.readFileSync(path.join(R,k),"utf8");
let failed=[];
function sub(file,name,from,to){
  const n=FILES[file].split(from).length-1;
  if(n!==1){failed.push(file+" · "+name+" (matched "+n+" times, need exactly 1)");return;}
  FILES[file]=FILES[file].split(from).join(to);
}

// ---------------------------------------------------------------------------
// 1. The predicate, beside the one it deliberately does not replace.
// ---------------------------------------------------------------------------
sub("js/00-data.js","hasProg",
`function isHuman(u){return !!(u&&(u.isPlayer||u.remote));}`,
`function isHuman(u){return !!(u&&(u.isPlayer||u.remote));}
// ---- v134.2 WHO CARRIES PROGRESSION ----
// NOT a widened isHuman. That predicate has 34 call sites and at most of them it means "a real
// player's screen is watching this" — quests, the Town Board, kill-feed growls, per-owner net
// messages, the HUD. Widening it would hand bots quest state they can never use and fire
// owner-channel sends at bodies with no owner. This is the other question, asked separately.
//
// Soldiers only. A villager holding three buffs is invisible power spread across half an economy;
// a trade cart cannot fight; the King is a win condition rather than a duellist; and the wilds keep
// their own balance (CAMP_XP already pays the humans who clear them). A LEVIED villager qualifies
// the moment it takes up arms, because from then on it is a soldier by every other rule here.
function hasProg(u){
  if(!u)return false;
  if(u.isPlayer||u.remote)return true;
  if(!u.bot||u.isKing||u.team===NEUTRAL)return false;
  const r=u.bot.role;
  if(r==="creep"||r==="cart"||r==="king")return false;
  return u.cls!=="villager";
}
// John: "a bot gains a level per every 3 soldier enemies killed, not one. One is too frequent."
const NPC_KILLS_PER_LVL=3;`);

// ---------------------------------------------------------------------------
// 2. The advance itself, next to grantBuff — which exists for exactly this.
// ---------------------------------------------------------------------------
sub("js/09-main.js","npcAdvance and the blind deal",
`function grantBuff(u,id){ // direct grant (tests & future scripted rewards)`,
`// ---- v134.2 HOW AN NPC RISES ----
// The same two currencies a player earns, minted the same way, and then SPENT immediately — a bot
// has no forge to walk to and no menu to read, so banked XP would sit on it for ever doing nothing.
//
// The draw is uniform over everything the unit is not already holding at its ceiling, INCLUDING the
// pieces that will do it no good (a swordsman can draw Timberwright). That is not an oversight: a
// player at the forge is dealt three and picks one, and the gap between "picks" and "takes what
// comes" is most of the difference between a build and a bag. It is the first dial to reach for if
// the veterans come out too strong, and it is a lot cheaper to turn than a stat curve.
//
// ⚠ Math.random() here is fine and the seeded window is not at risk — worldgen closed long before
// any of this runs (invariant #2 is about LOAD time). nodehash is the tripwire; check it anyway.
function npcSpendXP(u){
  while((u.xp||0)>=1){
    const pool=BUFFS.filter(b=>buffSt(u,b.id)<buffMax(b.id));
    if(!pool.length)break;                       // holding everything at its ceiling: keep the coin
    const pick=pool[(Math.random()*pool.length)|0];
    u.xp--;
    u.buffs=u.buffs||{};
    u.buffs[pick.id]=Math.min(buffMax(pick.id),(u.buffs[pick.id]||0)+1);
  }
  applyBuffStats(u);
}
function npcAdvance(u,n){
  const lv0=u.lvl||0;
  u.lvl=Math.min(XP_MAX_LVL,lv0+n);
  const got=u.lvl-lv0;                           // at the cap nothing is minted, coin included —
  if(got<=0)return 0;                            // otherwise the cap would only cap the number
  u.xp=(u.xp||0)+got;
  npcSpendXP(u);
  return got;
}
function grantBuff(u,id){ // direct grant (tests & future scripted rewards)`);

// ---------------------------------------------------------------------------
// 3. The buff gates. isHuman -> hasProg at the sites that are about POWER, and only those.
// ---------------------------------------------------------------------------
sub("js/05-combat.js","attacker-side buffs",
`  // ---- v87 BLACKSMITH BUFFS: attacker-side (humans only) ----
  const attU=att&&!att.def&&att.cls?att:null; // a unit, not a tower
  if(attU&&isHuman(attU)&&attU.team!==victim.team){`,
`  // ---- v87 BLACKSMITH BUFFS: attacker-side ----
  // v134.2: "humans only" until now. hasProg, not isHuman — see the note at hasProg in 00-data.js.
  const attU=att&&!att.def&&att.cls?att:null; // a unit, not a tower
  if(attU&&hasProg(attU)&&attU.team!==victim.team){`);

sub("js/05-combat.js","victim-side buffs",
`  // ---- victim-side (humans only): dodge, then the tempered shield ----
  if(isHuman(victim)){`,
`  // ---- victim-side: dodge, then the tempered shield ---- (v134.2: hasProg, was humans only)
  if(hasProg(victim)){`);

sub("js/05-combat.js","survival instinct",
`  if(isHuman(victim)&&victim.alive&&buffSt(victim,"flight")&&victim.maxHp>0&&`,
`  if(hasProg(victim)&&victim.alive&&buffSt(victim,"flight")&&victim.maxHp>0&&`);
sub("js/05-combat.js","hunter's step",
`  if(attU&&isHuman(attU)&&buffSt(attU,"hunt")&&CLS[attU.cls]&&!CLS[attU.cls].ranged&&`,
`  if(attU&&hasProg(attU)&&buffSt(attU,"hunt")&&CLS[attU.cls]&&!CLS[attU.cls].ranged&&`);
sub("js/05-combat.js","earthshaker / rapid volley",
`  if(attU&&isHuman(attU)&&attU.team!==victim.team&&!_volleyIn){`,
`  if(attU&&hasProg(attU)&&attU.team!==victim.team&&!_volleyIn){`);
sub("js/05-combat.js","batch-C on-hit procs",
`  if(attU&&isHuman(attU)&&attU.team!==victim.team&&victim.alive){`,
`  if(attU&&hasProg(attU)&&attU.team!==victim.team&&victim.alive){`);
sub("js/05-combat.js","shrug it off",
`  if(isHuman(victim)&&victim._tmods&&buffSt(victim,"shrug")&&`,
`  if(hasProg(victim)&&victim._tmods&&buffSt(victim,"shrug")&&`);
sub("js/05-combat.js","bramble mail",
`  if(isHuman(victim)&&buffSt(victim,"thorns")&&att&&!att.def&&att.cls&&`,
`  if(hasProg(victim)&&buffSt(victim,"thorns")&&att&&!att.def&&att.cls&&`);
sub("js/05-combat.js","bloodthirst",
`  if(attU&&isHuman(attU)&&attU.alive&&attU.team!==victim.team){    // BLOODTHIRST drinks`,
`  if(attU&&hasProg(attU)&&attU.alive&&attU.team!==victim.team){    // BLOODTHIRST drinks`);

sub("js/05-combat.js","radius auras",
`  if(!u.alive||typeof isHuman!=="function"||!isHuman(u))return;`,
`  // v134.2 hasProg: a veteran bot's SANCTUARY should shelter the band standing in it, or the buff
  // it is holding is a decoration. The six buffSt reads on the next line already bail in one step
  // for anything holding none of them, which is every unit that never earned one.
  if(!u.alive||typeof hasProg!=="function"||!hasProg(u))return;`);

sub("js/03-buildings.js","wrecker",
`  if(att&&!att.def&&isHuman(att)&&att.team!==b.team)`,
`  if(att&&!att.def&&hasProg(att)&&att.team!==b.team) // v134.2 hasProg — a veteran razes faster too`);

// ---------------------------------------------------------------------------
// 4. What a kill pays an NPC. Same block that already pays a human's on-kill buffs.
// ---------------------------------------------------------------------------
sub("js/05-combat.js","on-kill block and the kill counter",
`  if(victim.hp<=0){
    // ---- v132.30 BATCH A: what a kill pays the killer ----
    if(attU&&isHuman(attU)&&attU.alive&&attU.team!==victim.team){`,
`  if(victim.hp<=0){
    // ---- v134.2 …AND WHAT THREE KILLS PAY AN NPC ----
    // John: "a bot gains a level per every 3 soldier enemies killed, not one. One is too frequent."
    // SOLDIERS. Not villagers, not carts, not the wilds — a raid through an undefended economy is
    // not what should make a veteran, and camps already pay through campPayParticipants below.
    // Counted on the killer, so a bot that dies loses the part-progress with everything else.
    if(attU&&!isHuman(attU)&&hasProg(attU)&&attU.alive&&attU.team!==victim.team&&
       victim.team!==NEUTRAL&&victim.cls!=="villager"&&!(victim.bot&&victim.bot.role==="cart")&&
       typeof npcAdvance==="function"){
      attU._kills=(attU._kills||0)+1;
      if(attU._kills>=NPC_KILLS_PER_LVL){attU._kills=0;npcAdvance(attU,1);}
    }
    // ---- v132.30 BATCH A: what a kill pays the killer ----
    if(attU&&hasProg(attU)&&attU.alive&&attU.team!==victim.team){`);

// ---------------------------------------------------------------------------
// 5. Camps: the list, and the payout.
// ---------------------------------------------------------------------------
sub("js/05-combat.js","camp participation list",
`    // v132.28 PARTICIPATION. Any damage to any member puts a human on the camp's list; the
    // pack is cleared by whoever fought it, not by whoever landed the last blow. Bots are not
    // recorded — they never quest and hold no XP (the isHuman gate is the same one questProgress
    // uses). The list lives on the CAMP STATE, so it survives the death of any individual creep
    // and is cleared when the next wave lands.
    if(typeof isHuman==="function"&&isHuman(att)){`,
`    // v132.28 PARTICIPATION. Any damage to any member puts the attacker on the camp's list; the
    // pack is cleared by whoever fought it, not by whoever landed the last blow. The list lives on
    // the CAMP STATE, so it survives the death of any individual creep and is cleared when the next
    // wave lands.
    // v134.2: the gate was isHuman, with a comment reading "Bots are not recorded — they never
    // quest and hold no XP". They hold XP now, so they are recorded — a band that clears a camp has
    // earned the same thing a player would have earned for it.
    if(typeof hasProg==="function"&&hasProg(att)){`);

sub("js/07-ai.js","camp payout pays NPCs too",
`    if(typeof isHuman!=="function"||!isHuman(u))continue;`,
`    if(typeof hasProg!=="function"||!hasProg(u))continue;   // v134.2: soldiers, human or not
    if(!isHuman(u)){ // v134.2 an NPC takes the same award, and SPENDS it — it has no forge to visit
      if(typeof npcAdvance==="function")npcAdvance(u,gain);
      continue;                                             // …and no HUD, quest or sync to notify
    }`);

// ---------------------------------------------------------------------------
// 6. Death takes half from a veteran too. John: "same as you."
// ---------------------------------------------------------------------------
sub("js/05-combat.js","the death wipe reaches NPCs",
`  if(isHuman(u)&&((u.lvl||0)>0||(u.xp||0)>0||u.quest||(u.buffs&&Object.keys(u.buffs).length)||
     u.questDraft||(u.qRerolls||0)>0||u.smithOffer||u._scoutOut)){`,
`  // v134.2 …AND IT REACHES A VETERAN NPC ON THE SAME TERMS (John: "half the level, all buffs —
  // same as you"). Bots die far more often than you do, so this is also what keeps the whole
  // feature self-limiting: a bot's loadout is only ever as good as its current life.
  // ⚠ THE GUARD LIST AND THE WIPE LIST MUST STAY IDENTICAL — the v132.28 note below says why.
  // _kills is part-progress toward the next level and dies with the rest of it.
  if(hasProg(u)&&((u.lvl||0)>0||(u.xp||0)>0||u.quest||(u.buffs&&Object.keys(u.buffs).length)||
     u.questDraft||(u.qRerolls||0)>0||u.smithOffer||u._scoutOut||(u._kills||0)>0)){`);

sub("js/05-combat.js","the wipe clears the kill count",
`    u._rrCycle=false; // v132.28.2: re-arm the reroll grant, or a player who died QUESTLESS would`,
`    u._kills=0;       // v134.2: part-progress toward the next level dies with the level
    u._rrCycle=false; // v132.28.2: re-arm the reroll grant, or a player who died QUESTLESS would`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
for(const k in FILES)fs.writeFileSync(path.join(R,k),FILES[k]);
console.log("patch-npcprog-v134: OK — "+Object.keys(FILES).join(", ")+" written");
