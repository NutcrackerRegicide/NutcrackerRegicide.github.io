#!/usr/bin/env node
/* patch-smoketest-vet-v134.js — the gates for v134.2 THE VETERANS.
 *
 * Placed at the very END of the file, after the v134.0 pathing bench, for the same reason that one
 * is: these create bodies, creating bodies shifts unit ids, and nothing may run after them.
 *
 * Eight gates. The two that matter most are the ones that are NOT about the feature working:
 *   · revokeProg — a levied villager standing down, and a soldier reaching respawn without passing
 *     through killUnit's wipe. Both doors put a farmhand in the fields holding a veteran's loadout,
 *     and the second one is invisible unless you go looking for it.
 *   · the s.bfa completeness contract — with the producer rowing players only, a guest ERASED every
 *     veteran's buffs on every full snap and then disagreed with the host about how hard they hit.
 *     A test that only checks "the buffs arrive" would pass on a producer that never sends them.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","tools","smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("export the veteran layer",
`  "hasProg,npcAdvance,npcSpendXP,NPC_KILLS_PER_LVL,"+ // v134.2 the veterans`,
`  "hasProg,npcAdvance,npcSpendXP,NPC_KILLS_PER_LVL,NPC_EVENT_CAP,revokeProg,vetTagTick,DEATH_KEEP,"+ // v134.2`);

sub("the veteran bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.2 THE VETERANS ====================
{
  const G=global.__G;
  const kept=[];
  const mk=(team,cls,x,z,bot)=>{const u=G.makeUnit(team,cls,x,z,
    {name:"Vet_"+cls+"_"+kept.length,bot:bot===undefined?{role:"citizen"}:bot});kept.push(u);return u;};
  const wipe=()=>{for(const u of kept)u.alive=false;kept.length=0;};

  // --- 1. WHO CARRIES IT. hasProg reads fields only, so this needs no bodies at all — which also
  //        means it cannot be fooled by anything a real unit happens to be doing at the time.
  {
    const bot=(cls,role)=>({bot:{role:role||"citizen"},cls,team:0});
    const cases=[
      ["a soldier bot",              bot("clubman"),                                   true ],
      ["a priest bot",               bot("priest"),                                    true ],
      ["a siege bot",                bot("batteringram"),                              true ],
      ["a VILLAGER bot",             bot("villager"),                                  false],
      ["a trade cart",               bot("tradecart","cart"),                          false],
      ["an ox cart",                 bot("oxcart","cart"),                             false],
      ["a creep",                    {bot:{role:"creep"},cls:"wolf",team:G.NEUTRAL},   false],
      ["a barbarian in the wilds",   {bot:{role:"creep"},cls:"barbarian",team:G.NEUTRAL},false],
      ["the KING",                   {bot:{role:"king"},cls:"king",team:0,isKing:true},false],
      ["a botless body",             {cls:"clubman",team:0},                           false],
      ["the local player (villager)",{isPlayer:true,cls:"villager",team:0},            true ],
      ["a remote's body",            {remote:"peer",cls:"villager",team:0},            true ],
      ["nothing at all",             null,                                             false],
    ];
    const bad=cases.filter(c=>!!G.hasProg(c[1])!==c[2]).map(c=>c[0]);
    check("v134.2 hasProg: soldiers and humans carry progression, and NOTHING else does ("+
      (bad.length?"WRONG: "+bad.join(" · "):cases.length+" cases, all as stated")+")",bad.length===0);
  }

  // --- 2. THE RATE IS THE DIFFICULTY DIAL. Attacker on RED, because diffFor() pins any team
  //        holding a human to "normal" and the player is blue — so a blue attacker would measure
  //        the same tier whatever the dial said, and the test would pass without testing anything.
  {
    const d0=G.getAIDiff(), m0=G.NET.mode; G.NET.mode="solo";
    const rows=[];
    for(const tier of ["easy","normal","hard"]){
      G.setAIDiff(tier);
      const need=G.AI_DIFF[tier].vetKills;
      const att=mk(G.RED,"clubman",120,-120,{role:"war"});
      let atLevel=-1;
      for(let k=1;k<=need+2;k++){
        const vic=mk(G.BLUE,"clubman",120.5,-120,{role:"war"});
        G.dealDamage(att,vic,999999);
        if(atLevel<0&&(att.lvl||0)>0)atLevel=k;
      }
      rows.push(tier+" "+atLevel+"/"+need);
      if(atLevel!==need)rows.push("MISMATCH");
    }
    G.setAIDiff(d0); G.NET.mode=m0;
    check("v134.2 rate: a bot levels on exactly AI_DIFF[tier].vetKills soldier kills, and the tier "+
      "is read per TEAM through diffFor ("+rows.join(" · ")+")",rows.indexOf("MISMATCH")<0);
    wipe();
  }

  // --- 3. …AND A LEVEL IS A PIECE OF THE FORGE. Levels multiply nothing, so a level that did not
  //        buy a buff would be a cosmetic and the whole feature would be a nametag change.
  {
    const d0=G.getAIDiff(), m0=G.NET.mode; G.NET.mode="solo"; G.setAIDiff("hard"); // 1 kill a level
    const att=mk(G.RED,"clubman",130,-120,{role:"war"});
    for(let k=0;k<3;k++){const vic=mk(G.BLUE,"clubman",130.5,-120,{role:"war"});G.dealDamage(att,vic,999999);}
    const stacks=att.buffs?Object.keys(att.buffs).reduce((a,k)=>a+att.buffs[k],0):0;
    G.setAIDiff(d0); G.NET.mode=m0;
    check("v134.2 rate: …and every level is SPENT at once — 3 kills on hard bought "+stacks+
      " blacksmith pieces and left "+(att.xp||0)+" XP banked (a bot has no forge to walk to)",
      (att.lvl||0)===3&&stacks===3&&(att.xp||0)===0);
    wipe();
  }

  // --- 4. WHAT DOES NOT COUNT. A raid through an undefended economy must not make a veteran.
  {
    const d0=G.getAIDiff(), m0=G.NET.mode; G.NET.mode="solo"; G.setAIDiff("hard");
    const att=mk(G.RED,"clubman",140,-120,{role:"war"});
    const prey=[mk(G.BLUE,"villager",140.5,-120),
                mk(G.BLUE,"tradecart",140.5,-121,{role:"cart"}),
                mk(G.NEUTRAL,"wolf",140.5,-122,{role:"creep"})];
    for(const p of prey)G.dealDamage(att,p,999999);
    const after=att.lvl||0, kills=att._kills||0;
    G.setAIDiff(d0); G.NET.mode=m0;
    check("v134.2 rate: villagers, carts and the wilds pay NOTHING — three of them killed on hard "+
      "left level "+after+" and "+kills+" toward the next",after===0&&kills===0);
    wipe();
  }

  // --- 5. NO SINGLE EVENT MINTS A MONSTER. The Viking raid pays 15.
  {
    const u=mk(G.RED,"clubman",150,-120,{role:"war"});
    const got=G.npcAdvance(u,15);
    const stacks=u.buffs?Object.keys(u.buffs).reduce((a,k)=>a+u.buffs[k],0):0;
    check("v134.2 cap: one event pays an NPC at most NPC_EVENT_CAP ("+G.NPC_EVENT_CAP+") — a "+
      "15-level Viking payout granted "+got+" levels and "+stacks+" pieces, not 15 and 14",
      got===G.NPC_EVENT_CAP&&u.lvl===G.NPC_EVENT_CAP&&stacks===G.NPC_EVENT_CAP);
    wipe();
  }

  // --- 6. DEATH TAKES HALF, SAME AS YOURS. And the two doors that revoke on a class change.
  {
    const u=mk(G.RED,"clubman",160,-120,{role:"war"});
    G.npcAdvance(u,3); u._kills=1;
    const lv0=u.lvl, st0=Object.keys(u.buffs).length;
    G.killUnit(u,null);
    check("v134.2 death: a veteran NPC loses half its level and ALL of its loadout, exactly as you "+
      "do (LV "+lv0+" with "+st0+" pieces -> LV "+u.lvl+" with "+Object.keys(u.buffs||{}).length+
      ", "+(u.xp||0)+" XP, "+(u._kills||0)+" toward the next)",
      u.lvl===Math.floor(lv0*G.DEATH_KEEP)&&u.xp===u.lvl&&
      Object.keys(u.buffs||{}).length===0&&(u._kills||0)===0);
    wipe();
  }
  {
    // THE LEVY. This is the hole the rewritten loadout gate caught on its first run: a villager
    // armed by 07-ai.js fights, earns, and used to walk back to the fields still carrying it.
    const v=mk(G.BLUE,"villager",170,-120);
    G.setClass(v,"clubman");            // …the Town Center is overwhelmed
    G.npcAdvance(v,2);
    const armed={lvl:v.lvl,st:Object.keys(v.buffs||{}).length};
    G.setClass(v,"villager");           // …ten quiet seconds later
    check("v134.2 revoke: a LEVIED villager gives back what only a soldier may hold (armed: LV "+
      armed.lvl+" with "+armed.st+" pieces -> stood down: LV "+(v.lvl||0)+" with "+
      Object.keys(v.buffs||{}).length+")",
      armed.lvl>0&&armed.st>0&&(v.lvl||0)===0&&Object.keys(v.buffs||{}).length===0);
    wipe();
  }
  {
    // …and the OTHER door, which is the one nobody would have gone looking for: respawnUnit sets
    // cls directly rather than through setClass, so a soldier that reaches it without passing
    // through killUnit's wipe came back a villager with the whole loadout intact.
    const u=mk(G.RED,"clubman",180,-120,{role:"war"});
    G.npcAdvance(u,3);
    const before=Object.keys(u.buffs||{}).length;
    u.alive=false; u.respawnT=0;        // exactly what a dozen places do by hand
    G.respawnUnit(u);
    check("v134.2 revoke: …and a body that reaches RESPAWN without passing through the death wipe "+
      "does not come back a villager holding a veteran's kit ("+before+" pieces -> "+
      Object.keys(u.buffs||{}).length+", cls "+u.cls+")",
      before>0&&u.cls==="villager"&&Object.keys(u.buffs||{}).length===0&&(u.lvl||0)===0);
    wipe();
  }
  {
    // …and NEVER a player. respawnUnit re-classes you to villager on every death, and killUnit has
    // already decided what you keep. If revokeProg ever stopped reading hasProg correctly, this is
    // the line that would go red instead of a player quietly losing their loadout on respawn.
    const p=G.getPlayer(), b0=p.buffs, l0=p.lvl, c0=p.cls;
    p.buffs={dmg:2}; p.lvl=6;
    G.setClass(p,"villager");
    const held=Object.keys(p.buffs||{}).length===1&&p.lvl===6;
    p.buffs=b0; p.lvl=l0; G.setClass(p,c0);
    check("v134.2 revoke: …and it never touches a PLAYER — you keep your loadout through a "+
      "re-class, because killUnit already ruled on it",held);
    wipe();
  }

  // --- 7. THE WIRE. Both halves, and the completeness contract that made this dangerous.
  {
    const N=G.NET, m0=N.mode; N.mode="host";
    const vet=mk(G.RED,"clubman",190,-120,{role:"war"});
    G.npcAdvance(vet,2);
    let snap=null;
    try{N._lastRow=null;for(let i=0;i<4&&!(snap&&snap.bfa);i++)snap=N.packSnap();}catch(e){}
    const row=snap&&snap.bfa&&snap.bfa.find(r=>r[0]===vet.id);
    const lvRow=snap&&snap.lv&&snap.lv.find(r=>r[0]===vet.id);
    check("v134.2 wire: a full snapshot carries a veteran NPC's LOADOUT ("+
      (row?row[1].length/2+" pieces":"NO ROW")+") and its LEVEL ("+(lvRow?"LV "+lvRow[1]:"NO ROW")+
      ") — with the producer rowing players only, a guest ERASED both on every full snap",
      !!row&&row[1].length>0&&!!lvRow&&lvRow[1]===vet.lvl);
    // …and the guest half: wipe it locally, apply the snapshot, and only the wire can have put it
    // back. This is the shape the v132.40 rings test uses, for the same reason.
    if(snap){
      const heldB=vet.buffs, heldL=vet.lvl;
      vet.buffs={}; vet.lvl=0;
      N.mode="guest";
      try{N.applySnap(snap);}catch(e){}
      const back=Object.keys(vet.buffs||{}).length;
      const backL=vet.lvl||0;
      N.mode="host"; vet.buffs=heldB; vet.lvl=heldL;
      check("v134.2 wire: …and a GUEST rebuilds both from it ("+back+" pieces, LV "+backL+
        ") rather than clearing them — s.bfa is a COMPLETE list by contract and its sweep wipes "+
        "any holder missing from it",back>0&&backL>0);
    }
    N.mode=m0;
    wipe();
  }

  // --- 8. THE MARK. John: "no [aura] but you do need to be able to tell a bot is higher level."
  {
    const u=mk(G.RED,"clubman",200,-120,{role:"war"});
    G.vetTagTick(1); const tag0=!!u._tag;
    G.npcAdvance(u,4);
    G.vetTagTick(1); const tag1=u._vtagN;
    u.lvl=0;
    G.vetTagTick(1); const tag2=!!u._tag;
    // …and syncNameTags, which owns the PLAYERS' tags, must not strip it — it runs only when a
    // snapshot arrives, so in solo it never runs at all and a star driven from there would appear
    // in multiplayer and nowhere else.
    G.npcAdvance(u,1); G.vetTagTick(1);
    G.syncNameTags([]);
    const survived=!!u._tag;
    check("v134.2 mark: a veteran bot wears the same ⭐LV players wear, gains it when it levels, "+
      "loses it when the level goes, and syncNameTags does not strip it (before: "+tag0+
      ", at LV 3: "+tag1+", after: "+tag2+", survives a scoreboard sync: "+survived+")",
      tag0===false&&tag1==="⭐3"&&tag2===false&&survived===true);
    wipe();
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-vet-v134: OK");
