#!/usr/bin/env node
/* patch-smoketest-slainby-v134.js — gates for the slain-by death screen, and PROTO 47 -> 48.
 *
 * The gate that matters most here is the FREEZE. A test that only checks "the killer's buffs show
 * up" would pass just as well on a live lookup — and a live lookup is wrong, for a reason that only
 * bites in play and never in a test written carelessly: the screen stands for 10-30 seconds, and if
 * the killer dies inside that window its own death wipe empties u.buffs. You would be shown an
 * empty loadout by someone who was fully loaded when they cut you down. So the gate wipes the
 * killer AFTER the kill and asserts the record did not move.
 *
 * The other three are the shapes killUnit is actually handed: a unit, a BUILDING (a tower carries
 * .def and no .cls), and null — "the wilds". The suite calls killUnit(qh,null) six times, so a bare
 * killer.buffs would have taken those down; these say so on purpose rather than by luck.
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

sub("export the renderer",
`  "hasProg,npcAdvance,npcSpendXP,NPC_KILLS_PER_LVL,NPC_EVENT_CAP,revokeProg,vetTagTick,DEATH_KEEP,"+ // v134.2`,
`  "hasProg,npcAdvance,npcSpendXP,NPC_KILLS_PER_LVL,NPC_EVENT_CAP,revokeProg,vetTagTick,DEATH_KEEP,"+ // v134.2
  "renderSlainBy,BUFFS,"+                              // v134.2 the slain-by death screen`);

sub("PROTO pin (wire) -> 48",
`  check("v134.2 wire: PROTO is 47 — the set-piece channel, public timed modifiers, the thrown "+
    "knife, the damage-number message, and now every buff HOLDER in s.bfa plus veteran NPC levels "+
    "in s.lv",NET.PROTO===47);`,
`  check("v134.2 wire: PROTO is 48 — the set-piece channel, public timed modifiers, the thrown "+
    "knife, the damage-number message, every buff HOLDER in s.bfa, veteran NPC levels in s.lv, and "+
    "the slain-by record a guest has no other way to learn",NET.PROTO===48);`);

sub("PROTO pin (ares) -> 48",
`  check("v115/v134.2 net: PROTO 47 (veteran NPCs on the wire) and \`ares\` still rides both payloads",
    G.NET.PROTO===47&&Array.isArray(w.ares)&&Math.abs(w.ares[0]-42.5)<0.06&&`,
`  check("v115/v134.2 net: PROTO 48 (veterans + the slain-by record) and \`ares\` still rides both payloads",
    G.NET.PROTO===48&&Array.isArray(w.ares)&&Math.abs(w.ares[0]-42.5)<0.06&&`);

sub("the slain-by bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.2 THE SLAIN-BY SCREEN ====================
{
  const G=global.__G;
  const kept=[];
  const mk=(team,cls,x,z,bot)=>{const u=G.makeUnit(team,cls,x,z,
    {name:"Slain_"+kept.length,bot:bot===undefined?{role:"war"}:bot});kept.push(u);return u;};
  const wipe=()=>{for(const u of kept)u.alive=false;kept.length=0;};
  const stacksOf=(rec)=>{let n=0;const p=(rec&&rec.b)||[];for(let i=1;i<p.length;i+=2)n+=p[i];return n;};

  // --- 1. A UNIT KILLER: name, class, level and the loadout, frozen at the blow.
  {
    const killer=mk(G.RED,"clubman",210,-120);
    G.npcAdvance(killer,3);
    const held=Object.keys(killer.buffs||{}).length, lv=killer.lvl;
    const victim=mk(G.BLUE,"clubman",210.5,-120);
    G.killUnit(victim,killer);
    const rec=victim._slain;
    check("v134.2 slain: the record names the killer, its class and its level, and carries its "+
      "loadout ("+(rec?rec.n+" · "+rec.c+" · LV "+rec.l+" · "+(rec.b.length/2)+" pieces":"NO RECORD")+")",
      !!rec&&rec.n===killer.name&&rec.c===G.CLS.clubman.name&&rec.l===lv&&rec.b.length/2===held&&held>0);
    // …and the pieces are the ones the killer actually held, decoded through BUFFS the way the
    // screen decodes them — a mis-strided [idx,stacks] pairing gives plausible names at wrong counts.
    let ok=true;
    for(let i=0;i+1<rec.b.length;i+=2){const B=G.BUFFS[rec.b[i]];
      if(!B||(killer.buffs[B.id]|0)!==rec.b[i+1])ok=false;}
    check("v134.2 slain: …and every [index,stacks] pair decodes back to what the killer was "+
      "holding ("+stacksOf(rec)+" stacks)",ok&&stacksOf(rec)>0);

    // --- 2. THE FREEZE. This is the whole design decision. Kill the killer AFTER the blow — its
    //        own death wipe empties u.buffs — and the record must not have moved. A live lookup
    //        would show an empty loadout from someone who was fully loaded when they cut you down.
    const before=JSON.stringify(rec);
    G.killUnit(killer,null);
    check("v134.2 slain: the record is FROZEN at the blow — the killer dying (and losing every "+
      "buff to its own wipe) leaves it untouched ("+stacksOf(victim._slain)+" stacks still listed, "+
      "killer now holds "+Object.keys(killer.buffs||{}).length+")",
      JSON.stringify(victim._slain)===before&&Object.keys(killer.buffs||{}).length===0);
    wipe();
  }

  // --- 3. THE SHAPES killUnit IS ACTUALLY HANDED. A tower carries .def and no .cls; "the wilds"
  //        is null, and the suite calls killUnit(qh,null) six times in the death-wipe block above.
  {
    const tower=G.buildings.find(b=>b.alive&&b.def&&b.def.atk)||G.buildings.find(b=>b.alive);
    const v1=mk(G.BLUE,"clubman",220,-120);
    let threw=null;
    try{G.killUnit(v1,tower);}catch(e){threw=e.message;}
    const v2=mk(G.BLUE,"clubman",221,-120);
    try{G.killUnit(v2,null);}catch(e){threw=threw||e.message;}
    check("v134.2 slain: a BUILDING and the WILDS both read as themselves and neither throws "+
      "(tower: "+(v1._slain?v1._slain.n:"none")+" · null: "+(v2._slain?v2._slain.n:"none")+
      (threw?" · THREW "+threw:"")+")",
      !threw&&!!v1._slain&&!!v2._slain&&v2._slain.n==="The wilds"&&
      v1._slain.b.length===0&&v2._slain.b.length===0);
    wipe();
  }

  // --- 4. THE SCREEN ITSELF.
  {
    const el=global.document.getElementById("deathby");
    G.renderSlainBy({n:"Ragnar the Iron",c:"Halberdier",l:7,b:[0,3]});
    const html=el.innerHTML||"", shown=el.style.display;
    const named=html.indexOf("Ragnar the Iron")>=0, classed=html.indexOf("Halberdier")>=0,
          levelled=html.indexOf("LV 7")>=0, piece=html.indexOf(G.BUFFS[0].name)>=0&&html.indexOf("×3")>=0;
    G.renderSlainBy(null);
    const cleared=(el.style.display==="none")&&!(el.innerHTML||"").length;
    check("v134.2 slain: the screen prints the killer, the class, the level and each piece with "+
      "its stacks (name "+named+", class "+classed+", level "+levelled+", piece "+piece+
      ", shown "+shown+"), and clears to nothing ("+cleared+")",
      named&&classed&&levelled&&piece&&shown==="block"&&cleared);
    // …and a killer carrying NOTHING still gets a screen. The empty-hide convention is for the
    // LOADOUT, not for the whole block — "Slain by" with no name is what a broken feature looks like.
    G.renderSlainBy({n:"A Guard Tower",c:"tower",l:0,b:[]});
    const bare=el.innerHTML||"";
    check("v134.2 slain: …and a killer with no loadout still names itself, with no empty buff "+
      "header ("+(bare.indexOf("A Guard Tower")>=0?"named":"UNNAMED")+", header "+
      (bare.indexOf("CARRYING")>=0?"present":"absent")+")",
      bare.indexOf("A Guard Tower")>=0&&bare.indexOf("CARRYING")<0);
    G.renderSlainBy(null);
  }

  // --- 5. A NEW LIFE OPENS ON NOBODY'S NAME. Otherwise your second death shows your first killer.
  {
    const u=mk(G.BLUE,"clubman",230,-120);
    G.killUnit(u,mk(G.RED,"clubman",230.5,-120));
    const had=!!u._slain;
    u.alive=false; u.respawnT=0; G.respawnUnit(u);
    check("v134.2 slain: respawn clears the record ("+had+" -> "+!!u._slain+
      ") — a new life must not open on the last one's killer",had&&!u._slain);
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
console.log("patch-smoketest-slainby-v134: OK");
