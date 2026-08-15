#!/usr/bin/env node
/* patch-death-half.js — v132.48: death takes half, and hands it back as coin.
 *
 * ── WHAT JOHN ASKED FOR, IN HIS OWN EXAMPLE ─────────────────────────────────────────────────
 * "a level 20 player dies, they respawn as level 10 and have ten xp points to spend at the
 * blacksmith. All previous buffs have been wiped. If a level 8 player dies, they respawn as
 * level 4 and have 4 xp points to spend at blacksmith, all previous buffs are wiped."
 *
 *     level → floor(level / 2)        XP → EQUAL TO THE NEW LEVEL        buffs → gone
 *
 * ── WHY THIS IS A BETTER RULE THAN "HALVE EVERYTHING" ───────────────────────────────────────
 * The three shapes I offered all halved the loadout and left the player limping on a gutted build.
 * This returns half the progression as SPENDABLE CURRENCY instead: you rise with a bare forge and
 * ten XP in hand, and you choose a build again rather than nursing the wreck of the old one.
 * Death keeps real teeth — every buff goes, and the buffs are where all sixty pieces of power
 * live — while the climb back is immediate and yours to direct.
 *
 * ⚠ THE NEW XP REPLACES, IT DOES NOT ADD. A level-20 player holding 6 unspent XP rises with
 * exactly 10, not 16. Both of John's examples read that way, and it makes hoarding XP neither
 * rewarded nor punished: bank it or spend it, death values your progress the same.
 *
 * ⚠ EVERYTHING ELSE STILL WIPES. The quest, the standing draft, banked rerolls, the forge offer,
 * TROPHY HUNTER's accumulated hpBonus and the timed modifiers all go as before. They are per-life
 * state, not progression, and John's instruction was about level and XP.
 *
 * ⚠ AND THE GUARD LIST STAYS IDENTICAL TO THE WIPE LIST. v132.28 fixed a bug where a fresh player
 * holding only a drawn draft died without losing it, because the guard tested fewer fields than
 * the wipe cleared. No field is added or removed here, so that stays true — but it is the reason
 * this comment exists.
 *
 * ⚠ STATS RECOMPUTE ON THEIR OWN. respawnUnit calls setClassStats unconditionally, and that reads
 * buffSt for hp, spd and cooldown — so a wiped loadout produces honest numbers without this
 * touching them.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={comb:path.join(__dirname,"..","js","05-combat.js"),
         data:path.join(__dirname,"..","js","00-data.js")};
const c={o:fs.readFileSync(P.comb,"utf8")}, d={o:fs.readFileSync(P.data,"utf8")};
const subC=mk(c), subD=mk(d);

subD("the dial",
`const ENLIGHTENMENT_AGE=5;`,
`// v132.48 (John, playtesting): "Losing all levels and xp at death is too harsh." Death now takes
// HALF the level and hands that half back as spendable XP — level 20 rises at 10 with 10 XP. The
// buffs still go entirely, which is where the teeth are.
const DEATH_KEEP=0.5;        // the fraction of your level you rise with
const ENLIGHTENMENT_AGE=5;`);

subC("death takes half",
`    // ---- v87 DEATH TAKES ITS DUE: level, XP, quest and every blacksmith buff ----
    u.lvl=0; u.xp=0; u.buffs={}; u.quest=null; u.questDraft=null; u.qRerolls=0; u._scoutOut=false; u.smithOffer=null; // v99: death also wipes the standing draft + banked rerolls`,
`    // ---- v132.48 DEATH TAKES HALF, AND HANDS IT BACK AS COIN ----
    // Was: lvl=0, xp=0 — a total wipe, which John called too harsh after playing it. Now half the
    // level survives AND becomes spendable XP, so you rise with a bare forge and the means to
    // stock it. ⚠ The XP is SET, not added: a level 20 holding 6 unspent rises with exactly 10.
    const _lv0=u.lvl||0;
    const _lv1=Math.floor(_lv0*DEATH_KEEP);
    u.lvl=_lv1; u.xp=_lv1;
    u.buffs={}; u.quest=null; u.questDraft=null; u.qRerolls=0; u._scoutOut=false; u.smithOffer=null; // v99: death also wipes the standing draft + banked rerolls`);

subC("say what actually happened",
`      questNotify(u,"💀 Death takes its due — your level, XP and blacksmith buffs are lost.","warn");`,
`      questNotify(u,_lv1>0
        ? "💀 Death takes half — you rise at level "+_lv1+" with "+_lv1+
          " XP to spend, and the forge is bare."
        : "💀 Death takes its due — your level, XP and blacksmith buffs are lost.","warn");`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.comb,c.o); fs.writeFileSync(P.data,d.o);
console.log("patched — death takes half and returns it as XP");
