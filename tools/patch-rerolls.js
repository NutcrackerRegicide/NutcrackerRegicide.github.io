#!/usr/bin/env node
/* patch-rerolls.js — v132.28.2 (John): rerolls capped at 3, and earned once per quest
 * opportunity instead of once per level.
 *
 * THE OLD RULE (v99): completeQuest banked one reroll per LEVEL gained. That is REPLACED, not
 * supplemented — John's call. It had also quietly become wrong this version: participation now
 * grants levels, so camps and the raid would have minted rerolls as a side effect, and the raid
 * would have handed out fifteen of them at once.
 *
 * THE NEW RULE: every time you are free to take a posting, you bank one reroll, to a ceiling of
 * QUEST_REROLL_MAX (3).
 *
 * IMPLEMENTED AS A CYCLE FLAG, not as a grant bolted onto completeQuest, because "free to take a
 * posting" has three entrances and only one of them is finishing a quest:
 *     · the start of a life          (a fresh player has no quest)
 *     · finishing a quest            (completeQuest clears u.quest)
 *     · respawning after death       (the wipe clears u.quest)
 * A flag driven off `u.quest` covers all three with one rule and cannot double-grant: the grant
 * fires on the TRANSITION into questlessness, and re-arms only when a quest is taken.
 *
 * questTick is the right host for it — it already runs per frame, host/solo only, and already
 * loops exactly the units this applies to (`isHuman(u) && u.alive`).
 *
 * ⚠ The flag MUST be cleared wherever the quest is cleared by death, or a player who died while
 *   questless would carry `_rrCycle=true` into the new life and never be granted their reroll.
 *   Both wipe sites are patched: killUnit (05-combat.js) and the deserter path (10-net.js:700).
 *
 * A guest's reroll COUNT rides `qdraft.rr`, which is sent when the board is opened — so a guest
 * sees the fresh number at the moment it can matter, which is the board itself. No new wire
 * field, no PROTO change.
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
         combat:path.join(__dirname,"..","js","05-combat.js"),
         net:path.join(__dirname,"..","js","10-net.js")};
const d={o:fs.readFileSync(P.data,"utf8")}, m={o:fs.readFileSync(P.main,"utf8")},
      c={o:fs.readFileSync(P.combat,"utf8")}, n={o:fs.readFileSync(P.net,"utf8")};
const subD=mk(d), subM=mk(m), subC=mk(c), subN=mk(n);

subD("the cap",
`const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5;`,
`const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5, QUEST_REROLL_MAX=3;`);

subM("retire the per-level banking",
`  u.qRerolls=(u.qRerolls||0)+Q.xp; // v99: one banked board-reroll per LEVEL gained`,
`  // v132.28.2: rerolls are NO LONGER banked per level. questTick grants one each time the player
  // becomes free to take a posting, capped at QUEST_REROLL_MAX. Clearing u.quest above is what
  // arms that grant, so finishing a quest still earns one — just by the general rule, and without
  // camp/raid participation levels minting rerolls as a side effect.`);

subM("the cycle grant",
`  for(const u of units){
    if(!isHuman(u)||!u.alive)continue;
    if(buffSt(u,"captain"))_captains.push(u);`,
`  for(const u of units){
    if(!isHuman(u)||!u.alive)continue;
    // ---- v132.28.2 ONE REROLL PER QUEST OPPORTUNITY, capped at QUEST_REROLL_MAX ----
    // Fires on the TRANSITION into questlessness, so it covers a fresh life, a finished quest and
    // a respawn with one rule, and cannot pay twice for the same opportunity.
    if(!u.quest){
      if(!u._rrCycle){
        u._rrCycle=true;
        if((u.qRerolls||0)<QUEST_REROLL_MAX){
          u.qRerolls=(u.qRerolls||0)+1;
          questNotify(u,"📜 The board has fresh work — "+u.qRerolls+" reroll"+
            (u.qRerolls===1?"":"s")+" banked"+((u.qRerolls>=QUEST_REROLL_MAX)?" (full)":"")+".","blue");
          syncQuest(u);
        }
      }
    }else u._rrCycle=false;
    if(buffSt(u,"captain"))_captains.push(u);`);

subC("clear the flag on the death wipe",
`    u.lvl=0; u.xp=0; u.buffs={}; u.quest=null; u.questDraft=null; u.qRerolls=0; u._scoutOut=false; u.smithOffer=null; // v99: death also wipes the standing draft + banked rerolls`,
`    u.lvl=0; u.xp=0; u.buffs={}; u.quest=null; u.questDraft=null; u.qRerolls=0; u._scoutOut=false; u.smithOffer=null; // v99: death also wipes the standing draft + banked rerolls
    u._rrCycle=false; // v132.28.2: re-arm the reroll grant, or a player who died QUESTLESS would
                      // carry the spent cycle into the new life and never be granted one`);

subN("clear the flag on the deserter path",
`    const u=r.unit; u.lvl=0;u.xp=0;u.buffs={};u.quest=null;u.questDraft=null;u.qRerolls=0;u.smithOffer=null; // …but not the deserter's legend`,
`    const u=r.unit; u.lvl=0;u.xp=0;u.buffs={};u.quest=null;u.questDraft=null;u.qRerolls=0;u.smithOffer=null;u._rrCycle=false; // …but not the deserter's legend`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.data,d.o); fs.writeFileSync(P.main,m.o);
fs.writeFileSync(P.combat,c.o); fs.writeFileSync(P.net,n.o);
console.log("patched — rerolls capped at 3, granted once per quest opportunity");
