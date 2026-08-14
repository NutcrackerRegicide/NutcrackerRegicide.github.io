#!/usr/bin/env node
/* patch-death-hud.js — v132.28 spine, layer 6: two long-standing bugs in §5.3.
 *
 * (4) THE HOLE IN THE DEATH WIPE. The guard at 05-combat.js reads
 *       lvl || xp || quest || buffs
 *     but the body it guards also clears questDraft, qRerolls, _scoutOut and smithOffer.
 *     A player at level 0 with no XP, no quest and no buffs — which is to say a fresh life —
 *     who walks to the board and DRAWS a trio, then dies, keeps that trio through the death
 *     that was meant to take it. Same for banked rerolls and a standing forge offer. The guard
 *     must test everything the body clears; anything else is a guard that has drifted from its
 *     own payload. Rewritten so the two lists are visibly the same list.
 *
 * (5) THE HUD NEVER DRAWS AT RESPAWN. updateQuestHud is called from eight places, none of them
 *     a respawn — so after dying the panel keeps showing the level, quest and buffs of the life
 *     that just ended, until the next quest event happens to repaint it. The wipe is real but
 *     invisible, which is the worst combination. respawnUnit already has an isPlayer branch that
 *     hides the death overlay and repaints the player HUD; the quest panel belongs beside it.
 *
 * Also: updateQuestHud printed quest.prog raw. That was safe while every event advanced by whole
 * numbers, and stops being safe this version — heal_hp accumulates FRACTIONAL hit points, so
 * Field Surgeon would have read "37.42999999999995/200". Rounded at the point of display only;
 * the underlying progress stays exact so the 200 is reached honestly.
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
const P={combat:path.join(__dirname,"..","js","05-combat.js"),
         ui:path.join(__dirname,"..","js","08-ui.js")};
const c={o:fs.readFileSync(P.combat,"utf8")}, u={o:fs.readFileSync(P.ui,"utf8")};
const subC=mk(c), subU=mk(u);

subC("death wipe guard",
`  if(isHuman(u)&&((u.lvl||0)>0||(u.xp||0)>0||u.quest||(u.buffs&&Object.keys(u.buffs).length))){`,
`  // v132.28: the guard now tests EVERYTHING the wipe below clears. It used to test only
  // lvl/xp/quest/buffs, so a fresh player holding nothing but a drawn draft — or banked rerolls,
  // or a standing forge offer — died without losing them. The two lists must stay identical.
  if(isHuman(u)&&((u.lvl||0)>0||(u.xp||0)>0||u.quest||(u.buffs&&Object.keys(u.buffs).length)||
     u.questDraft||(u.qRerolls||0)>0||u.smithOffer||u._scoutOut)){`);

subC("repaint the quest HUD on respawn",
`  if(u.isPlayer){
    document.getElementById("deathoverlay").style.display="none";
    updatePlayerHud(); msg("You respawn as a Villager. Re-arm at the Barracks.","blue");
  }`,
`  if(u.isPlayer){
    document.getElementById("deathoverlay").style.display="none";
    updatePlayerHud();
    // v132.28: the quest panel was never repainted on respawn, so a wiped level, quest and buff
    // list stayed on screen — reading as if death had cost nothing — until some later quest
    // event happened to redraw it.
    if(typeof updateQuestHud==="function")updateQuestHud();
    msg("You respawn as a Villager. Re-arm at the Barracks.","blue");
  }`);

subU("round the progress readout",
`  if(qt)qt.textContent=q?("📜 "+q.name+": "+Math.min(player.quest.prog,q.n)+"/"+q.n)`,
`  // v132.28: ROUNDED for display only — heal_hp advances by fractional hit points, and the raw
  // value would print as 37.42999999999995/200. quest.prog itself stays exact.
  if(qt)qt.textContent=q?("📜 "+q.name+": "+Math.round(Math.min(player.quest.prog,q.n))+"/"+q.n)`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.combat,c.o);
fs.writeFileSync(P.ui,u.o);
console.log("patched js/05-combat.js + js/08-ui.js — death-wipe hole + quest HUD");
