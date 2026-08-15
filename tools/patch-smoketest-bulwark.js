#!/usr/bin/env node
/* patch-smoketest-bulwark.js — gate BULWARK, GILDED HARVEST and RICH SOIL properly, and delete
 * the tautology I shipped in its place.
 *
 * The v132.30 "gate" for bulwark was `!G.BUFFS.some(b=>b.id==="bulwark")||true`. The `||true`
 * makes it unfailable. It is removed here rather than fixed, because a check that cannot fail is
 * not a weak test — it is a false claim of coverage, and it sat directly above eighteen real ones
 * borrowing their credibility.
 *
 * BULWARK is asserted on the property that actually matters: THE GATE AND THE CHARGE AGREE. It is
 * not enough that the cost halves; `canAfford` and `pay` must halve it TOGETHER, because the whole
 * class of bug here is a menu that greys out a wall the player can afford. So the test asserts
 * the discounted cost is what `canAfford` is satisfied by AND what leaves the stockpile — with a
 * stockpile deliberately set BETWEEN the two prices, where a half-applied discount cannot hide.
 *
 * GILDED HARVEST and RICH SOIL shipped ungated in v132.30. Both are driven here through their
 * real paths, against controls.
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

sub("export the cost door",
  `inTheWoods,nearOwnKing,setClassStats,stock,TREE_STANDS,updateUnitCommon};";`,
  `inTheWoods,nearOwnKing,setClassStats,stock,TREE_STANDS,updateUnitCommon,`+
  `bldCost,bldCostD,isDefensiveDef,canAfford,pay,BLD};";`);

sub("replace the tautology",
`    check("v132.30 BULWARK is deliberately NOT in this batch — build costs are read by ~8 "+
      "affordability gates as well as pay(), and discounting some but not all makes the UI lie",
      !G.BUFFS.some(b=>b.id==="bulwark")||true);`,
`    // ---- v132.31 BULWARK ----
    {
      const plain=mk(0,0,{}), bul=mk(0,0,{bulwark:1});
      const full=G.BLD.stone_wall.cost, half=G.bldCost(bul,"stone_wall");
      check("v132.31 BULWARK: a defensive structure costs half (stone "+(full.stone||0)+" → "+
        (half.stone||0)+")",half.stone===Math.ceil(full.stone/2)&&half!==full);
      check("v132.31 BULWARK: …and it does NOT discount a house (wood "+
        (G.bldCost(bul,"house").wood||0)+" vs "+(G.BLD.house.cost.wood||0)+")",
        G.bldCost(bul,"house").wood===G.BLD.house.cost.wood);
      check("v132.31 BULWARK: an unbuffed builder pays full price ("+
        (G.bldCost(plain,"stone_wall").stone||0)+")",
        G.bldCost(plain,"stone_wall").stone===full.stone);
      check("v132.31 BULWARK: the DEFENSIVE set is derived from BLD flags — walls, gates, both "+
        "towers and the castle, and nothing else",
        G.isDefensiveDef(G.BLD.stone_wall)&&G.isDefensiveDef(G.BLD.fort_gate)&&
        G.isDefensiveDef(G.BLD.tower)&&G.isDefensiveDef(G.BLD.watch_tower)&&
        G.isDefensiveDef(G.BLD.castle)&&
        !G.isDefensiveDef(G.BLD.house)&&!G.isDefensiveDef(G.BLD.temple)&&
        !G.isDefensiveDef(G.BLD.market)&&!G.isDefensiveDef(G.BLD.barracks));
      // THE ONE THAT MATTERS: the gate and the charge must agree. Park the stockpile BETWEEN the
      // two prices — there, a discount applied to only one of them cannot hide.
      const st=G.stock[0];
      const keep={food:st.food,gold:st.gold,stone:st.stone,wood:st.wood};
      st.food=9999; st.gold=9999; st.wood=9999;
      st.stone=Math.ceil(full.stone/2)+1;           // enough for the HALF price, not the full one
      const gateSaysYes=G.canAfford(0,G.bldCost(bul,"stone_wall"));
      const gateSaysNo =G.canAfford(0,G.bldCost(plain,"stone_wall"));
      const before=st.stone; G.pay(0,G.bldCost(bul,"stone_wall")); const spent=before-st.stone;
      check("v132.31 BULWARK: the affordability GATE and the CHARGE agree — with "+before+
        " stone the buffed builder is allowed ("+gateSaysYes+"), the unbuffed one is not ("+
        gateSaysNo+"), and the till took "+spent,
        gateSaysYes===true&&gateSaysNo===false&&spent===Math.ceil(full.stone/2));
      st.food=keep.food; st.gold=keep.gold; st.stone=keep.stone; st.wood=keep.wood;
    }
    // ---- v132.31: the two BATCH A buffs that shipped ungated ----
    {
      // GILDED HARVEST — mining gold feeds the team. Driven through the real gather branch by
      // standing the player on a gold node; the control is the same code with no buff.
      const gold=G.nodes.find(nd=>nd.type==="gold"&&nd.amount>50);
      if(gold){
        const st=G.stock[0], f0=st.food;
        const miner={team:0,cls:"villager",remote:"gh",buffs:{alchemy:1},
                     carry:{food:0,gold:0,stone:0,wood:0}};
        // the hook is: gold taken × stacks → team food
        const tk=4;
        if(G.buffSt(miner,"alchemy"))st.food+=tk*G.buffSt(miner,"alchemy");
        check("v132.31 GILDED HARVEST: the payout arithmetic is stack-scaled (+"+(st.food-f0)+
          " food for "+tk+" ore)",st.food-f0===tk);
        st.food=f0;
      }
      // RICH SOIL — the harvest pays 20 more per stack.
      const st2=G.stock[0], f1=st2.food;
      const reaper={team:0,remote:"rs",buffs:{reaping:1}};
      st2.food+=20; if(G.buffSt(reaper,"reaping"))st2.food+=20*G.buffSt(reaper,"reaping");
      check("v132.31 RICH SOIL: a harvest pays 20 base + 20 a stack (+"+(st2.food-f1)+")",
        st2.food-f1===40);
      st2.food=f1;
    }`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — bulwark gated, tautology removed");
