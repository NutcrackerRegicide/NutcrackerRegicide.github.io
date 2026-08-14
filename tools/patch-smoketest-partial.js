#!/usr/bin/env node
/* patch-smoketest-partial.js — John asked: is XP/level granted ONLY if the camp is defeated
 * ENTIRELY? Reading the code says yes (one call site, inside `if(alive===0)`). That is an
 * answer; it is not a guarantee. This makes it a gate, so it stays true.
 *
 * The existing wild-camp block killed the whole pack in one go, so it could never have caught a
 * payout that fired early — it would pass just as happily against code that paid out on the
 * FIRST creep to fall. That is the same shape of hole as the timber gate that read false->false.
 *
 * Rewritten to kill the pack in two stages:
 *   1. leave ONE creep standing, tick, and assert nobody has been paid anything — not XP, not a
 *      level, and CAMP BREAKER still unfinished
 *   2. fell the last one, tick, and assert the whole payout lands
 *
 * Stage 1 is the assertion that actually answers the question.
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

sub("partial wipe pays nothing",
`    const alive=cw.creeps.filter(k=>k.alive);
    G.dealDamage(helper,alive[0],1);
    for(const c of cw.creeps)if(c.alive)G.dealDamage(ender,c,999999);
    warTicks(1);`,
`    const alive=cw.creeps.filter(k=>k.alive);
    G.dealDamage(helper,alive[0],1);
    // ---- STAGE 1: fell all BUT ONE. A camp that is merely mauled must pay nobody. ----
    for(let i=0;i<alive.length-1;i++)if(alive[i].alive)G.dealDamage(ender,alive[i],999999);
    warTicks(1);
    const standing=cw.creeps.filter(k=>k.alive).length;
    check("v132.28 wild camp: a camp MAULED but not cleared pays NOTHING — "+standing+
      " creep still standing, ender xp "+(ender.xp||0)+" lvl "+(ender.lvl||0)+
      ", helper quest "+(helper.quest?"still held":"COMPLETE"),
      standing>=1&&(ender.xp||0)===0&&(ender.lvl||0)===0&&
      (helper.xp||0)===0&&(helper.lvl||0)===0&&!!helper.quest);
    check("v132.28 wild camp: …and the participation list is still OPEN while a creep lives ("+
      ((cw.part||[]).length)+" listed)",(cw.part||[]).length>=1);
    // ---- STAGE 2: fell the last one. Now everything lands. ----
    for(const c of cw.creeps)if(c.alive)G.dealDamage(ender,c,999999);
    warTicks(1);`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — partial-wipe gate");
