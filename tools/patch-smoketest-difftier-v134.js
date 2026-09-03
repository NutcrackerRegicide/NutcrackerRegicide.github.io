#!/usr/bin/env node
/* patch-smoketest-difftier-v134.js — a gate for the third door, and for the tier that was always
 * being played but never chosen.
 *
 * TWO CLAIMS. The first is arithmetic and it is the one that explains John's game: diffFor() gives
 * "normal" to a team holding a HUMAN and the menu dial to everyone else — so in solo his own bots
 * have run at normal against an enemy on easy, in every match, since v94. The gate states the
 * asymmetry out loud with the numbers, because it is the shape of a fair fight and nobody had
 * written it down.
 *
 * The second is that the middle door exists and is wired: three buttons in each of the two rows,
 * every tier reachable, and the two rows mirroring one setting. The suite has no DOM to click, so
 * it reads the shipped markup and the shipped handler rather than simulating a mouse — a gate that
 * asserted "aiDifficulty can be set to normal" would pass on a menu with two buttons in it.
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

sub("the v134.7 bench",
`console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`,
`// ==================== v134.7 THE MIDDLE DOOR ====================
{
  const G=global.__G;
  // --- 1. THE ASYMMETRY, STATED. A team holding a human plays "normal" whatever the dial says, so
  //        in solo the player's own bots have always been a tier above an enemy left on the default.
  {
    const D=G.AI_DIFF, e=D.easy, nm=D.normal, hd=D.hard;
    // ⚠ STAGED, because by this point in the file the netcode gates have left NET.mode as "guest"
    // and teamHasHuman refuses a guest's own body — quite rightly, a guest's team is the HOST's
    // problem. In a solo game the mode is not "guest" and the player stands on BLUE, which is the
    // case this rule is about; the first cut of this gate read the ambient state and reported
    // "blue easy", i.e. it measured the harness rather than the rule.
    const _mode=G.NET.mode, _pt=G.player?G.player.team:null;
    G.NET.mode="solo"; if(G.player)G.player.team=G.BLUE;
    const blue=G.diffFor(G.BLUE), red=G.diffFor(G.RED);
    G.NET.mode=_mode; if(G.player&&_pt!==null)G.player.team=_pt;
    check("v134.7 tiers: a team holding a HUMAN plays normal whatever the dial says (blue "+blue+
      ", red "+red+" with the dial on "+G.getAIDiff()+") — so a solo player's own bots think every "+
      nm.think+"s while an enemy on the default thinks every "+e.think+"s, trains x"+e.trainMul+
      ", raids x"+e.raidMul+" as often with x"+e.raidFracMul+" the men, and needs "+e.vetKills+
      " kills a level against "+nm.vetKills+". Hard thinks every "+hd.think+"s and counters: "+
      hd.counter,
      blue==="normal"&&e.think>nm.think&&nm.think>hd.think&&
      e.trainMul>nm.trainMul&&nm.trainMul>hd.trainMul&&
      e.vetKills>nm.vetKills&&nm.vetKills>hd.vetKills);
  }

  // --- 2. THE MIDDLE DOOR IS IN THE MENU AND WIRED TO THE MIDDLE TIER. Read the shipped markup and
  //        the shipped handler: a gate that only set aiDifficulty="normal" by hand would pass on a
  //        menu that has no button for it, which is exactly the bug this version fixes.
  {
    const fs2=require("fs"), path2=require("path");
    const root=path2.join(__dirname,"..");
    const html=fs2.readFileSync(path2.join(root,"index.html"),"utf8");
    const net =fs2.readFileSync(path2.join(root,"js","10-net.js"),"utf8");
    const ids=["sdEasy","sdNormal","sdHard","hdEasy","hdNormal","hdHard"];
    const missing=ids.filter(id=>html.indexOf('id="'+id+'"')<0);
    const wired=net.indexOf('["sdEasy","sdNormal","sdHard"]')>=0&&
                net.indexOf('["hdEasy","hdNormal","hdHard"]')>=0&&
                net.indexOf('const TIERS=["easy","normal","hard"]')>=0;
    // …and the handler must PAINT from the live value, or the lit button lies about the dial
    const paints=net.indexOf("paint(aiDifficulty)")>=0;
    check("v134.7 menu: every tier has a door in BOTH rows ("+(missing.length?"MISSING: "+
      missing.join(" · "):"six buttons, three tiers, two rows")+"), the handler carries all three ("+
      wired+") and lights the one the dial is actually on ("+paints+"). AI_DIFF has had the normal "+
      "row since v94; only the button was missing",
      missing.length===0&&wired&&paints);
  }
}

console.log(fails?("\\n"+fails+" FAILURES"):"\\nALL SMOKE TESTS PASSED");`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-difftier-v134: OK");
