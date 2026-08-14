#!/usr/bin/env node
/* patch-quest-hooks.js — v132.28 spine, layer 4: feed the six new progress events.
 * (The seventh, build_tower, needs no code: 03-buildings.js:4012 already fires "build_"+b.type
 *  and the Guard Tower's BLD key is "tower", so the table row alone completes it.)
 *
 * Every call is cheap by construction: questProgress returns immediately unless the unit is
 * human, alive, holding a quest, and that quest's ev matches — so these are four field reads
 * on the hot paths and nothing more.
 *
 *  plunder_ox / plunder_tr — killUnit's v99 plunder block already identifies exactly what fell
 *      and pays the killer's team. The ox and the two trade-cart cases are separate branches,
 *      so the quests can distinguish a timber haul from a gold run.
 *      ⚠ The trader branch and the NPC-cart branch END IN BYTE-IDENTICAL LINES
 *      (`if(g>0){stock[killer.team].gold+=g; loot=g+" gold";}`). §6's second trap: an anchor
 *      matching two call sites matches zero times under the exactly-once rule. Both are
 *      therefore anchored with their whole preceding `else if` and tradeGold line.
 *
 *  counter_cav — killUnit's quest block already holds both parties and has applied the human,
 *      not-a-tower and not-my-own-team guards. The spear line is `line==="anticav"` (the same
 *      key rps() reads at 00-data.js:351 for the 3.8x counter) and the victim is `mounted`.
 *      Read as CUTTING DOWN a horseman, which is checkable with no new state; merely landing a
 *      countered blow would need a damage-side counter and a new field on the unit.
 *
 *  ox_wood — the ox's four-swings-a-tick gather, at BOTH sites: the local player (09-main.js)
 *      and a remote human driven by the host (10-net.js). Missing the second is how a feature
 *      ships working for the host and silently dead for the guest. Credited by the tick's own
 *      `tk`, so it counts wood actually taken, not swings.
 *
 *  heal_hp — healTick already computes `healed` clamped against maxHp (no overheal inflation)
 *      and already knows the source unit. Fractions accumulate honestly; the quest's n of 200
 *      is above the chirp threshold (Q.n<=20) so this does not spam the notifier with decimals.
 *
 *  cap_grand — the only one needing new state. bazaarTick's occupancy loop counts n0/n1 and
 *      throws the identities away, so nobody knows WHO was standing there when it flipped.
 *      Collect the humans of each team in that same pass and pay them on the flip. Host-only
 *      (guests never run bazaarTick; 10-net.js:1834 mirrors the result).
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
         main:path.join(__dirname,"..","js","09-main.js"),
         net:path.join(__dirname,"..","js","10-net.js")};
const c={o:fs.readFileSync(P.combat,"utf8")},
      m={o:fs.readFileSync(P.main,"utf8")},
      n={o:fs.readFileSync(P.net,"utf8")};
const subC=mk(c), subM=mk(m), subN=mk(n);

// ---- plunder_ox ----
subC("plunder_ox",
`    if(u.cls==="oxcart"&&u.carry&&u.carry.wood>0){
      stock[killer.team].wood+=u.carry.wood; loot=u.carry.wood+" wood";
    }`,
`    if(u.cls==="oxcart"&&u.carry&&u.carry.wood>0){
      stock[killer.team].wood+=u.carry.wood; loot=u.carry.wood+" wood";
      if(typeof questProgress==="function"&&isHuman(killer))questProgress(killer,"plunder_ox"); // v132.28 HIGHWAYMAN
    }`);

// ---- plunder_tr, site 1 of 2: the human trader. Anchored with its whole branch — the closing
//      line is byte-identical to the NPC cart's below. ----
subC("plunder_tr (human trader)",
`    }else if(u.cls==="trader"&&u.tradeLoaded){ // the haul's earned value so far
      const g=Math.round(tradeGold(Math.hypot(u.root.position.x-u.tradeLoaded.x,u.root.position.z-u.tradeLoaded.z)));
      if(g>0){stock[killer.team].gold+=g; loot=g+" gold";}`,
`    }else if(u.cls==="trader"&&u.tradeLoaded){ // the haul's earned value so far
      const g=Math.round(tradeGold(Math.hypot(u.root.position.x-u.tradeLoaded.x,u.root.position.z-u.tradeLoaded.z)));
      if(g>0){stock[killer.team].gold+=g; loot=g+" gold";
        if(typeof questProgress==="function"&&isHuman(killer))questProgress(killer,"plunder_tr");} // v132.28 ROAD AGENT`);

// ---- plunder_tr, site 2 of 2: the AI's NPC trade cart ----
subC("plunder_tr (NPC cart)",
`    }else if(u.bot&&u.bot.role==="cart"&&u.tradePhase==="back"&&u.tradeTarget&&u.bot.home){
      const g=Math.round(tradeGold(Math.hypot(u.bot.home.x-u.tradeTarget.x,u.bot.home.z-u.tradeTarget.z)));
      if(g>0){stock[killer.team].gold+=g; loot=g+" gold";}`,
`    }else if(u.bot&&u.bot.role==="cart"&&u.tradePhase==="back"&&u.tradeTarget&&u.bot.home){
      const g=Math.round(tradeGold(Math.hypot(u.bot.home.x-u.tradeTarget.x,u.bot.home.z-u.tradeTarget.z)));
      if(g>0){stock[killer.team].gold+=g; loot=g+" gold";
        if(typeof questProgress==="function"&&isHuman(killer))questProgress(killer,"plunder_tr");} // v132.28 ROAD AGENT`);

// ---- counter_cav ----
subC("counter_cav",
`    else if(!u.isKing&&MIL_LINES.includes(CLS[u.cls].line))questProgress(killer,"kill_mil");
  }`,
`    else if(!u.isKing&&MIL_LINES.includes(CLS[u.cls].line))questProgress(killer,"kill_mil");
    // v132.28 HORSEBANE: the spear line cutting down a horseman. "anticav" is the same line key
    // rps() reads for the 3.8x counter (00-data.js:351), so the quest and the bonus agree.
    if(CLS[killer.cls]&&CLS[killer.cls].line==="anticav"&&CLS[u.cls]&&CLS[u.cls].mounted)
      questProgress(killer,"counter_cav");
  }`);

// ---- cap_grand: keep the identities the occupancy loop was discarding ----
subC("cap_grand — collect plaza humans",
`    let n0=0,n1=0;
    for(const u of units){
      if(!u.alive||u.team===NEUTRAL||u.garrison)continue;
      if(dist2(u.root.position.x,u.root.position.z,m.x,m.z)>R2)continue;
      if(u.team===BLUE)n0++; else n1++;
    }`,
`    let n0=0,n1=0; const h0=[],h1=[]; // v132.28: h0/h1 are the HUMANS in the plaza this tick —
    // the loop counted heads and threw the names away, so a capture knew its team but not its
    // captors. Only populated for the Grand Bazaar, which is the only one a quest asks about.
    for(const u of units){
      if(!u.alive||u.team===NEUTRAL||u.garrison)continue;
      if(dist2(u.root.position.x,u.root.position.z,m.x,m.z)>R2)continue;
      if(u.team===BLUE){n0++; if(m.grand&&isHuman(u))h0.push(u);}
      else{n1++; if(m.grand&&isHuman(u))h1.push(u);}
    }`);

subC("cap_grand — pay on the flip",
`    if(m.cap>=1){
      const was=m.owner;
      m.owner=T0; m.cap=0; m.capTeam=-1;
      bazaarTaken(m,T0,was);
    }`,
`    if(m.cap>=1){
      const was=m.owner;
      m.owner=T0; m.cap=0; m.capTeam=-1;
      // v132.28 LORD OF THE CROSSROADS: everyone of the taking team standing in the Grand
      // Bazaar's plaza on the frame it flips. Standing there IS the capture, so presence at
      // the flip is the whole of the deed.
      if(m.grand&&typeof questProgress==="function")
        for(const _u of (T0===BLUE?h0:h1))questProgress(_u,"cap_grand");
      bazaarTaken(m,T0,was);
    }`);

// ---- heal_hp ----
subM("heal_hp",
`        if(s.unit)awardPts(s.unit,healed); // a point per HP mended`,
`        if(s.unit)awardPts(s.unit,healed); // a point per HP mended
        // v132.28 FIELD SURGEON. `+"`healed`"+` is already clamped against maxHp above, so overheal
        // cannot inflate it. n:200 sits above the chirp threshold (Q.n<=20), so the fractions
        // accumulate without spamming the notifier.
        if(s.unit&&healed>0&&typeof questProgress==="function")questProgress(s.unit,"heal_hp",healed);`);

// ---- ox_wood, site 1 of 2: the local player ----
subM("ox_wood (local player)",
`          if(tk>0){n.amount-=tk; player.carry[n.type]+=tk;} // FULL means full — the node stops draining too`,
`          if(tk>0){n.amount-=tk; player.carry[n.type]+=tk;} // FULL means full — the node stops draining too
          // v132.28 TIMBER HAUL: counts wood actually taken, not swings taken.
          if(tk>0&&player.cls==="oxcart"&&n.type==="wood"&&typeof questProgress==="function")
            questProgress(player,"ox_wood",tk);`);

// ---- ox_wood, site 2 of 2: a remote human, driven by the host ----
subN("ox_wood (remote human)",
`            if(tk>0){n.amount-=tk; u.carry[n.type]+=tk;} // the guest's pack is just as finite`,
`            if(tk>0){n.amount-=tk; u.carry[n.type]+=tk;} // the guest's pack is just as finite
            // v132.28 TIMBER HAUL — the guest's twin of the 09-main.js site. Omitting this is
            // how a feature ships working for the host and silently dead for everyone else.
            if(tk>0&&u.cls==="oxcart"&&n.type==="wood"&&typeof questProgress==="function")
              questProgress(u,"ox_wood",tk);`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.combat,c.o);
fs.writeFileSync(P.main,m.o);
fs.writeFileSync(P.net,n.o);
console.log("patched 05-combat.js + 09-main.js + 10-net.js — six new quest hooks");
