#!/usr/bin/env node
/* patch-smoketest-diffnormal-v134.js — the gate for v134.8's default tier.
 *
 * WHAT HAS TO BE TRUE, and it is not "the string says normal". The claim John bought is that a
 * SOLO GAME STARTS SYMMETRIC: his own bots and the enemy's think at the same rate, train at the
 * same rate and level at the same rate, unless he says otherwise. diffFor is what decides that, and
 * it takes the dial's boot value as an input — so the gate reads the boot value out of the SHIPPED
 * source (the suite itself moves aiDifficulty about, and by this point in the file it is wherever
 * the last bench left it), feeds it to diffFor with a solo board staged, and asserts the two teams
 * land on the same tier. Change the initializer back to "easy" and it goes red on the symmetry, not
 * on a spelling.
 *
 * ⚠ STAGED, for the same reason the v134.7 gate is: the netcode benches leave NET.mode as "guest"
 * and teamHasHuman quite rightly refuses a guest's own body. Solo is the case this rule is about.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const S=path.join(R,"tools","smoketest.js");
let s=fs.readFileSync(S,"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
};

sub("the default-tier gate",
`// ==================== v134.8 THE BARNS TURN OUT ====================`,
`// ==================== v134.8 A SOLO GAME STARTS SYMMETRIC ====================
{
  const G=global.__G;
  const fs2=require("fs"), path2=require("path");
  const data=fs2.readFileSync(path2.join(__dirname,"..","js","00-data.js"),"utf8");
  const m=data.match(/let aiDifficulty="([a-z]+)"/);
  const boot=m?m[1]:null;
  const _dial=G.getAIDiff(), _mode=G.NET.mode, _pt=G.player?G.player.team:null;
  G.NET.mode="solo"; if(G.player)G.player.team=G.BLUE;
  if(boot)G.setAIDiff(boot);
  const blue=G.diffFor(G.BLUE), red=G.diffFor(G.RED);
  G.setAIDiff(_dial); G.NET.mode=_mode; if(G.player&&_pt!==null)G.player.team=_pt;
  const nm=G.AI_DIFF.normal, e=G.AI_DIFF.easy;
  check("v134.8 default: a solo game boots with the dial on "+boot+", so the player's bots ("+blue+
    ") and the enemy's ("+red+") are on the SAME tier. It was easy — think "+e.think+"s against "+
    nm.think+", train x"+e.trainMul+" against x"+nm.trainMul+", "+e.vetKills+" kills a level "+
    "against "+nm.vetKills+" — because diffFor gives any team holding a human 'normal' whatever "+
    "the dial says, so the one tier a player could not pick for his enemy was his own. EASY is "+
    "unchanged and one click away in both rooms (v134.7)",
    boot==="normal"&&blue===red&&blue==="normal");
}

// ==================== v134.8 THE BARNS TURN OUT ====================`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-diffnormal-v134: OK");
