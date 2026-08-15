#!/usr/bin/env node
/* patch-smoketest-death-half.js — gate the new death rule against John's own examples.
 *
 * The old gate asserted lvl===0 && xp===0, which is the wipe he called too harsh. It is replaced
 * with the rule he actually specified — and specified with numbers, which is a gift, because the
 * numbers can be the assertion:
 *     level 20 → level 10, 10 XP        level 8 → level 4, 4 XP
 * Both of his worked examples are gates. If either ever reads differently, the message says which
 * one and what it got, so nobody has to re-derive the intent from the code.
 *
 * ── AND THE FOUR WAYS IT COULD STILL BE WRONG ───────────────────────────────────────────────
 *   THE BUFFS MUST STILL GO. That is where all sixty pieces of power live, and it is the whole
 *     reason death still means anything under a rule this generous.
 *   THE XP IS SET, NOT ADDED. A player holding 6 unspent XP at level 20 must rise with 10, not
 *     16 — otherwise banking XP becomes the optimal play and dying rich becomes a strategy.
 *   ODD LEVELS ROUND DOWN. 7 → 3, and it must not be 4 or 3.5.
 *   AND STATS MUST FOLLOW THE WIPE. respawnUnit recomputes from buffSt, so a player who rises
 *     with a bare forge must not keep the maxHp their lost STOUT HEART was paying for. That is
 *     asserted through a real respawn rather than by reading the call.
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

sub("John's own examples become the gate",
`  // death takes its due
  qh.lvl=7; qh.xp=2; qh.quest={i:0,prog:10}; qh.buffs={dmg:3,spd:1}; qh.smithOffer=["dmg","spd","hp"];
  killUnit(qh,null);
  check("death wipes level, XP, quest, every buff AND the smith's standing offer",
    qh.lvl===0&&qh.xp===0&&!qh.quest&&Object.keys(qh.buffs).length===0&&!qh.smithOffer);`,
`  // ---- v132.48 DEATH TAKES HALF. John: "Losing all levels and xp at death is too harsh." ----
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
    if(typeof G_setClassStats==="function")G_setClassStats(qh);
    global.__G.setClassStats(qh);
    const buffedMax=qh.maxHp;
    killUnit(qh,null);
    global.__G.respawnUnit(qh);
    check("v132.48 death: …and the STATS follow the loadout through a real respawn — you do not "+
      "keep the maxHp a lost STOUT HEART was paying for ("+buffedMax.toFixed(0)+" → "+
      qh.maxHp.toFixed(0)+")",qh.maxHp<buffedMax);
  }`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the death-takes-half gates");
