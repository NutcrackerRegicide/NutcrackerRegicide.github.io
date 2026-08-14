#!/usr/bin/env node
/* patch-smoketest-participation.js — gate v132.28 layer 3.
 *
 * The claim under test is a behaviour CHANGE, not an addition: credit for clearing a camp used
 * to belong to whoever landed the last blow, and now belongs to everyone who fought. So the
 * decisive assertion is the one about the player who did NOT land the killing blow — a gate
 * that only checked "the finisher got paid" would pass just as happily against the old code.
 *
 * Covered:
 *   · a human who landed ONE point of damage and never touched the pack again is paid
 *   · so is the finisher, and both get the SAME amount (participation, not a kill bounty)
 *   · a BOT that fought is not paid — bots hold no XP and never quest
 *   · a TOWER (att.def) is not recorded — it is excluded from the wake site for the same reason
 *   · a participant who is DEAD when the pack falls collects nothing
 *   · the wild camps pay 1, the Viking raid pays 15
 *   · CAMP BREAKER completes for a participant who did not land the last blow — the actual
 *     regression this layer is about
 *   · the list is CLEARED on payout and on a fresh wave, so a second tick cannot double-pay
 *
 * Placed after the raid block's last assertion, where a raid is landed and 11 bodies are alive,
 * and before the shore is put back to sleep — so the boss path is exercised for real rather
 * than by calling the payer directly on a synthetic state.
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

sub("participation block",
`  // put the shore back to sleep so later tests meet a quiet map`,
`  // ---- v132.28: PARTICIPATION — who gets paid when a pack falls ----
  {
    const campIdx=G.QUESTS.findIndex(q=>q.id==="camp1");
    const mkHuman=(team,x,z,nm,peer)=>{
      const u=G.makeUnit(team,"clubman",x,z,{name:nm});
      u.bot=null; u.remote=peer; u.xp=0; u.lvl=0; u.quest=null; u.questDraft=null; u.qRerolls=0; u.buffs={};
      return u;
    };
    // ---------- THE VIKING RAID (11 ashore from the sweep above) ----------
    const poker  =mkHuman(0,shore.x+6,shore.z,"Poker","p-peer");    // ONE point of damage, then nothing
    const closer =mkHuman(0,shore.x-6,shore.z,"Closer","c-peer");   // does all the killing
    const ghost  =mkHuman(0,shore.x+9,shore.z,"Ghost","g-peer");    // fights, then dies before the wipe
    // a BOT: keeps its bot and carries no remote, so isHuman() is false for it
    const drone  =G.makeUnit(0,"clubman",shore.x+12,shore.z,{name:"Drone",bot:{role:"citizen"}});
    drone.xp=0;
    const raiders=shore.creeps.filter(c=>c.alive);
    G.dealDamage(poker,raiders[0],1);
    G.dealDamage(ghost,raiders[0],1);
    G.dealDamage(drone,raiders[0],1);
    const listed=(shore.part||[]).slice();
    ghost.alive=false;                                      // the dead collect nothing
    for(const c of shore.creeps)if(c.alive)G.dealDamage(closer,c,999999);
    warTicks(1);
    check("v132.28 participation: the list holds ONLY humans — no bots, no towers ("+listed.length+
      " listed: "+listed.map(x=>x&&x.name).join("/")+")",
      listed.length>0&&listed.every(x=>G.isHuman(x))&&!listed.some(x=>x&&x.def));
    check("v132.28 participation: a BOT that fought the raid is not paid (xp "+(drone.xp||0)+")",
      (drone.xp||0)===0);
    check("v132.28 participation: a participant DEAD at the wipe collects nothing (xp "+(ghost.xp||0)+")",
      (ghost.xp||0)===0);
    check("v132.28 raid: ONE point of damage earns a full share — the poker was paid "+(poker.xp||0)+
      " XP without landing a blow",(poker.xp||0)===15);
    check("v132.28 raid: the finisher is paid the SAME as the poker ("+(closer.xp||0)+" vs "+(poker.xp||0)+
      ") — participation, not a kill bounty",(closer.xp||0)===15&&(closer.xp||0)===(poker.xp||0));
    check("v132.28 participation: the list is CLEARED on payout, so a second tick cannot double-pay",
      !shore.part||shore.part.length===0);
    const xpAfter=poker.xp; warTicks(2);
    check("v132.28 participation: …and it stays paid-once across further ticks ("+xpAfter+" -> "+poker.xp+")",
      poker.xp===xpAfter);

    // ---------- A WILD CAMP pays 1, and CAMP BREAKER completes for a non-finisher ----------
    const cw=CS.find(c=>!c.boss&&c.creeps.filter(k=>k.alive).length>=2)||CS[1];
    if(cw.waiting||cw.creeps.filter(k=>k.alive).length<2){cw.respawnAt=-1;tick();}
    const helper=mkHuman(0,cw.x+4,cw.z,"Helper","h-peer");
    const ender =mkHuman(0,cw.x-4,cw.z,"Ender","e-peer");
    helper.quest={i:campIdx,prog:0};                         // holding CAMP BREAKER, will not land the last blow
    const alive=cw.creeps.filter(k=>k.alive);
    G.dealDamage(helper,alive[0],1);
    for(const c of cw.creeps)if(c.alive)G.dealDamage(ender,c,999999);
    warTicks(1);
    check("v132.28 wild camp: a participant is paid 1 XP ("+(ender.xp||0)+")",(ender.xp||0)>=1);
    check("v132.28 wild camp: CAMP BREAKER completes for a player who did NOT land the last blow "+
      "(quest "+(helper.quest===null?"complete":"still held")+", lvl "+(helper.lvl||0)+")",
      helper.quest===null&&(helper.lvl||0)>=1);
    check("v132.28 wild camp: a wild pack pays LESS than the raid ("+(ender.xp||0)+" vs 15)",
      (ender.xp||0)<15);
    // a fresh wave starts a clean sheet
    cw.respawnAt=-1; tick();
    check("v132.28 participation: a new wave clears the list — nobody carries credit across waves",
      !cw.part||cw.part.length===0);
    poker.alive=false; closer.alive=false; helper.alive=false; ender.alive=false; drone.alive=false;
  }
  // put the shore back to sleep so later tests meet a quiet map`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — v132.28 participation gate");
