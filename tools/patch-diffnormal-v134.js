#!/usr/bin/env node
/* patch-diffnormal-v134.js — v134.8: A SOLO GAME STARTS SYMMETRIC.
 *
 * John, having been shown the v134.7 finding: default to NORMAL.
 *
 * THE FINDING IT ANSWERS. diffFor(team) returns "normal" for any team holding a human and
 * aiDifficulty for everyone else. aiDifficulty was "easy". So in every solo game ever played, the
 * player's OWN bots thought every 1.0s, trained at x1.0 and took a veteran level every 3 kills,
 * while the enemy thought every 2.2s, trained at x1.6, raided x1.6 as rarely with x0.6 the men and
 * needed 6 kills a level. The one tier a player could not choose for his enemy was the tier his own
 * side was already on — which is why v134.7 put the middle door in the menu, and this is the other
 * half: the door is no good if nobody walks through it.
 *
 * WHY THE OLD DEFAULT WAS RIGHT AND IS NOT ANY MORE. The note under AI_DIFF read "EASY is
 * deliberately the slowest: aiDifficulty defaults to easy, and a default match should not get
 * harder because a feature landed." That was a rule about SIDE EFFECTS — v134.2's veterans should
 * not have quietly raised the floor — and it still holds. This is not a side effect. It is the
 * dial being moved on purpose, by the person the difficulty is for, after seeing what it was set
 * to. EASY stays exactly as it is and stays one click away in both rooms.
 *
 * WHAT IT COSTS. Every solo match gets harder: the enemy marshal thinks 2.2x as often, trains 1.6x
 * as fast, raids more often and with a bigger share of its army, and its bots level three times
 * quicker. John's next few playtests are not comparable to the last few, and that is deliberate —
 * he asked for the harder default before running them.
 *
 * ONE LINE, and the comment above it, which was making a claim about the default that would
 * otherwise become false the moment this landed. A stale comment is worse than none.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const D=path.join(R,"js","00-data.js");
let d=fs.readFileSync(D,"utf8");
let failed=[];
const sub=(name,src,from,to)=>{
  const n=src.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return src;}
  return src.split(from).join(to);
};

// ---------------------------------------------------------------------------
// 1. The note that justified the old default. It justified it well; it is now about a tier rather
//    than about the default.
// ---------------------------------------------------------------------------
d=sub("the EASY note",d,
`  // EASY is deliberately the slowest: aiDifficulty defaults to "easy", and a default match should
  // not get harder because a feature landed — it is still strictly more than v133's nothing.`,
`  // EASY is deliberately the slowest tier — a feature landing should never quietly raise the floor
  // under somebody who never touched the dial, and at 6 kills a level it is still strictly more
  // than v133's nothing.
  // v134.8: it is no longer the DEFAULT. That rule was about side effects, and moving the dial on
  // purpose is not one. diffFor gives any team holding a human "normal", so an enemy left on easy
  // was a tier BELOW the player's own bots in every solo game ever played; v134.7 put the middle
  // door in the menu and this walks through it. John, shown the asymmetry: default to NORMAL.`);

// ---------------------------------------------------------------------------
// 2. The dial itself.
// ---------------------------------------------------------------------------
d=sub("the default tier",d,
`let aiDifficulty="easy"; // the solo/co-op dial (EASY|HARD in the menus); human teams always run "normal"`,
`// v134.8 "normal", was "easy". The dial the solo and co-op menus set (EASY|NORMAL|HARD since
// v134.7); a team holding a human ignores it and always runs "normal", so this now means a solo
// match starts with both marshals thinking at the same rate instead of the enemy thinking at half.
let aiDifficulty="normal";`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(D,d);
console.log("patch-diffnormal-v134: OK");
