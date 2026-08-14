#!/usr/bin/env node
/* patch-smoketest-rerolls.js — gate the v132.28.2 reroll rule.
 *
 * Two assertions encoded the retired v99 rule ("levels bank rerolls, one per level") and went red
 * on the rework, which is the gate doing its job. Replaced with assertions for the rule that
 * actually holds now, including the two properties with real failure modes:
 *
 *   · THE CAP. Drive many quest opportunities and confirm it never passes QUEST_REROLL_MAX.
 *     An uncapped grant is the obvious bug here and nothing else would catch it.
 *   · NO DOUBLE-GRANT. Tick repeatedly while questless and confirm exactly ONE is banked — the
 *     cycle flag is the whole mechanism, and a flag that fails to latch would pay every frame.
 *   · LEVELS ALONE NO LONGER BANK. Award levels directly, tick, and confirm no reroll appears.
 *     This is the assertion that keeps camp/raid participation from quietly minting rerolls,
 *     which is precisely what the old per-level rule would have done now that participation
 *     grants levels — fifteen of them at once, off a single raid.
 *   · TAKING a posting re-arms the cycle, so the NEXT opportunity grants again.
 *
 * questTick is driven directly rather than through warTicks, so each opportunity is a discrete,
 * countable event instead of something the campaign might supply more of behind the test's back.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("export questTick + the cap",
  `QUESTS,BUFFS,XP_MAX_LVL,BUFF_MAX_STACK,BOARD_REACH,`,
  `QUESTS,BUFFS,XP_MAX_LVL,BUFF_MAX_STACK,BOARD_REACH,QUEST_REROLL_MAX,`);

sub("the reroll rule",
`  // v99: every level gained banks a board reroll — and a redraw spends one for a fresh trio
  check("levels bank rerolls, one per level ("+(qh.qRerolls||0)+")",qh.qRerolls===3);
  useTownBoard(qh); // post a trio…
  check("a banked reroll wipes and reposts the board",
    global.__G.questRedraw(qh)===true&&qh.qRerolls===2&&qh.questDraft&&qh.questDraft.length===3);`,
`  // ---- v132.28.2: rerolls are earned ONCE PER QUEST OPPORTUNITY, capped, and no longer by level ----
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
  }`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — v132.28.2 reroll gate");
