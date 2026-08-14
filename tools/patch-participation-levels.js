#!/usr/bin/env node
/* patch-participation-levels.js — John's ruling: participation pays XP **and** LEVEL.
 *
 * v132.28 shipped participation paying XP only, on my reasoning that decoupling level from XP was
 * the fix for the unreachable forge economy. John's call is that a camp cleared should advance the
 * player the same way a finished quest does. Reverted to that.
 *
 * The level is CLAMPED at XP_MAX_LVL exactly as completeQuest clamps it (09-main.js), and the
 * notification reports the level actually gained rather than the nominal award — so a player two
 * levels off the cap who breaks the raid is told "+2 levels & +15 XP", not "+15 levels".
 * XP is deliberately NOT clamped: it is a spendable currency with no ceiling, and that asymmetry
 * is what keeps the forge reachable at the cap.
 *
 * TWO CONSEQUENCES, both flagged to John rather than decided here:
 *
 *  1. THE BOARD CLOSES AT THE CAP. questPick refuses when lvl >= XP_MAX_LVL (09-main.js:399).
 *     The raid pays 15 of 25, so TWO raids cap a player and their Town Board stops accepting
 *     work for the rest of that life. Before this change that could only happen through ~25
 *     finished quests.
 *
 *  2. REROLLS NO LONGER TRACK LEVELS. completeQuest banks one reroll per level gained
 *     ("v99: one banked board-reroll per LEVEL gained"). Participation now grants levels without
 *     granting rerolls, so that rule is true of quests but no longer true globally. Left alone
 *     because John asked for XP and level, not rerolls — one line here if he wants it.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","07-ai.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("pay level alongside xp",
`    u.xp=(u.xp||0)+gain;
    if(typeof questNotify==="function")
      questNotify(u,(st.boss?"⚑ THE RAID IS BROKEN":"⚑ CAMP CLEARED")+" — +"+gain+" XP for your part in it. Spend it at the Blacksmith.","gold");`,
`    // v132.28.1 (John): participation advances the player exactly as a finished quest does —
    // XP *and* level. Level clamps at the cap the same way completeQuest clamps it; XP does not
    // clamp, because it is a spendable currency and an uncapped XP faucet is what keeps the forge
    // reachable once the level cap is reached.
    u.xp=(u.xp||0)+gain;
    const _lv0=u.lvl||0;
    u.lvl=Math.min(XP_MAX_LVL,_lv0+gain);
    const _got=u.lvl-_lv0;                    // report what was ACTUALLY gained, not the nominal award
    if(typeof questNotify==="function")
      questNotify(u,(st.boss?"⚑ THE RAID IS BROKEN":"⚑ CAMP CLEARED")+" — +"+_got+" level"+
        (_got===1?"":"s")+" & +"+gain+" XP for your part in it. Spend the XP at the Blacksmith."+
        (u.lvl>=XP_MAX_LVL&&_got>0?" You are at the LEVEL CAP — the Town Board has no more work for you this life.":""),"gold");`);

sub("comment the header",
`// v132.28 THE RECKONING. Called once, on the frame the last creep falls. Pays every human who
// put damage into the pack: 1 XP for a wild camp, CAMP_XP_BOSS for the Viking raid. XP only —
// see tools/patch-participation.js for why level is deliberately not minted here.`,
`// v132.28 THE RECKONING. Called once, on the frame the last creep falls. Pays every human who
// put damage into the pack: 1 for a wild camp, CAMP_XP_BOSS for the Viking raid — as BOTH XP and
// levels (John's ruling), matching what a finished quest pays. Level clamps at XP_MAX_LVL, XP
// does not. Note the raid pays 15 of a 25 cap, so two raids close a player's Town Board for the
// rest of that life — questPick refuses at the cap (09-main.js).`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/07-ai.js — participation pays XP and LEVEL");
