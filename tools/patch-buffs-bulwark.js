#!/usr/bin/env node
/* patch-buffs-bulwark.js — v132.31: BULWARK actually works.
 *
 * ⚠ WHAT WENT WRONG. v132.30 put `bulwark` in the BUFFS table without implementing it. The forge
 * therefore DEALT it, a player could spend an XP on it, and it did nothing whatsoever. The gate I
 * wrote for it was `!G.BUFFS.some(b=>b.id==="bulwark")||true` — a tautology that cannot fail.
 * A dead buff you can pay for is worse than a missing one, and a gate that cannot fail is worse
 * than no gate, because it reads as coverage.
 *
 * ── WHY IT NEEDED A DOOR AND NOT A HOOK ─────────────────────────────────────────────────────
 * A build cost is read in TWO roles, and they must never disagree:
 *   · the affordability GATE, which decides whether the UI offers the building at all, and
 *   · `pay()`, which charges it.
 * Discount the charge alone and the menu greys out a castle you can afford. Discount one gate and
 * not another and the placement preview contradicts the click. So every building-cost read routes
 * through ONE function, `bldCost(u,type)` / `bldCostD(u,def)`.
 *
 * ── THE IDENTICAL-ANCHOR TRAP, MET HEAD ON ──────────────────────────────────────────────────
 * §6: "anchors that differ only in whitespace between two call sites silently match zero times".
 * Here it is worse — three of these are byte-identical:
 *     pay(MYTEAM,BLD[placing.type].cost);        × 3  (gate, wall-line, normal place)
 *     canAfford(MYTEAM,BLD[placing.type].cost)   × 4
 * They all need the SAME edit, so an exactly-once rule is the wrong tool. `subN` asserts an
 * EXPECTED COUNT instead: if the file ever grows a fourth `pay(...)` site, the count changes and
 * this patch refuses rather than silently missing it.
 *
 * ── WHAT COUNTS AS DEFENSIVE ────────────────────────────────────────────────────────────────
 * Derived from flags already in BLD, not from a hand-kept list that can drift:
 *   `wall:true`  → wood/stone/fort walls and all three gates
 *   `atk:{...}`  → Guard Tower, Castle
 *   `vision:N`   → Watch Tower
 * Nothing else in BLD carries any of the three (the Temple has `heal`, not `atk`).
 *
 * NOT PATCHED, deliberately: 07-ai.js's `pay(team,BLD[x].cost)` calls. Bots hold no buffs, so
 * buffSt returns 0 and the cost is unchanged — routing them would add noise for no behaviour.
 * Also untouched: age-up (`nxt.cost`) and unit training (`CLS[uid].cost`) — neither is a building.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){
  return {
    sub(name,from,to){
      const n=box.o.split(from).length-1;
      if(n!==1){failed.push(name+" (matched "+n+", need exactly 1)");return;}
      box.o=box.o.split(from).join(to);
    },
    subN(name,from,to,want){
      const n=box.o.split(from).length-1;
      if(n!==want){failed.push(name+" (matched "+n+", need exactly "+want+")");return;}
      box.o=box.o.split(from).join(to);
    }
  };
}
const P={data:path.join(__dirname,"..","js","00-data.js"),
         input:path.join(__dirname,"..","js","06-input.js"),
         net:path.join(__dirname,"..","js","10-net.js")};
const d={o:fs.readFileSync(P.data,"utf8")}, i={o:fs.readFileSync(P.input,"utf8")},
      n={o:fs.readFileSync(P.net,"utf8")};
const D=mk(d), I=mk(i), N=mk(n);

// ---------------- the one door ----------------
D.sub("bldCost",
`function buffSt(u,id){return (u&&u.buffs&&u.buffs[id])||0;} // stack count, 0..buffMax(id)`,
`function buffSt(u,id){return (u&&u.buffs&&u.buffs[id])||0;} // stack count, 0..buffMax(id)
// ---------- v132.31 BULWARK: defensive structures cost half ----------
// "Defensive" is derived from flags already on the building, not from a hand-kept list that could
// drift out of step with BLD: wall:true is every wall and gate, atk is the Guard Tower and the
// Castle, vision is the Watch Tower. Nothing else in BLD carries any of the three.
function isDefensiveDef(dd){return !!(dd&&(dd.wall||dd.atk||dd.vision));}
// THE ONE DOOR. Every build-cost read goes through here — the affordability GATE as well as the
// charge — because if only one of them is discounted the UI and the till disagree and the menu
// greys out a wall the player can afford.
function bldCostD(u,dd){
  const c=dd&&dd.cost;
  if(!c)return c;
  const st=(typeof buffSt==="function")?buffSt(u,"bulwark"):0;
  if(!st||!isDefensiveDef(dd))return c;          // no allocation in the overwhelmingly common case
  const f=Math.pow(0.5,st);
  return {food:Math.ceil((c.food||0)*f),gold:Math.ceil((c.gold||0)*f),
          stone:Math.ceil((c.stone||0)*f),wood:Math.ceil((c.wood||0)*f)};
}
function bldCost(u,type){return bldCostD(u,BLD[type]);}`);

// ---------------- the player's sites ----------------
I.sub("build-menu gate",
`  if(!canAfford(MYTEAM,BLD[type].cost)){msg("Not enough resources for a "+BLD[type].name+".");return;}`,
`  if(!canAfford(MYTEAM,bldCost(player,type))){msg("Not enough resources for a "+BLD[type].name+".");return;}`);

I.subN("placement gates (4 identical sites)",
`canAfford(MYTEAM,BLD[placing.type].cost)`,
`canAfford(MYTEAM,bldCost(player,placing.type))`,4);

I.subN("the charge (3 identical sites)",
`pay(MYTEAM,BLD[placing.type].cost);`,
`pay(MYTEAM,bldCost(player,placing.type));`,3);

I.sub("build menu render",
`      html+='<div class="opt'+((locked||!canAfford(MYTEAM,b.cost))?" cant":"")+'" data-b="'+bId+'"><span><span class="key">'+(i+1)+'</span>'+`,
`      html+='<div class="opt'+((locked||!canAfford(MYTEAM,bldCostD(player,b)))?" cant":"")+'" data-b="'+bId+'"><span><span class="key">'+(i+1)+'</span>'+`);

// ---------------- the host-side twins for a guest's build RPC ----------------
N.sub("guest build gate+charge",
`    if(d.cost&&!canAfford(u.team,d.cost))return deny("The team stockpile can't afford a "+d.name+".");
    if(d.cost)pay(u.team,d.cost);`,
`    if(d.cost&&!canAfford(u.team,bldCostD(u,d)))return deny("The team stockpile can't afford a "+d.name+".");
    if(d.cost)pay(u.team,bldCostD(u,d));`);

N.sub("guest place gate+charge",
`    if(!canAfford(u.team,d.cost))return deny("Not enough resources for a "+d.name+".");
    pay(u.team,d.cost);`,
`    if(!canAfford(u.team,bldCostD(u,d)))return deny("Not enough resources for a "+d.name+".");
    pay(u.team,bldCostD(u,d));`);

N.sub("guest gate-on-wall gate+charge",
`    if(!canAfford(u.team,d.cost))return deny("The stockpile can't afford a "+d.name+".");
    pay(u.team,d.cost); placeGateOnWall(w,a.type,u.team); updateResHud();`,
`    if(!canAfford(u.team,bldCostD(u,d)))return deny("The stockpile can't afford a "+d.name+".");
    pay(u.team,bldCostD(u,d)); placeGateOnWall(w,a.type,u.team); updateResHud();`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.data,d.o); fs.writeFileSync(P.input,i.o); fs.writeFileSync(P.net,n.o);
console.log("patched — BULWARK routed through bldCost at every gate and charge");
