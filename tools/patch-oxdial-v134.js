#!/usr/bin/env node
/* patch-oxdial-v134.js — v134.6, part one: one ox, not two. John's playtest.
 *
 * John, after the first game with v134.4 in: "Wood and as being gathered extremely fast with two
 * NPC oxcarts. Could reduce this to one."
 *
 * He is reading the same thing the bench measured and I under-weighted. An ox is four times a
 * villager's axe AND a fifteenth of its walking: 300 in the bed against 20, so it makes one trip
 * where a villager makes fifteen. Two of them is not twice a villager, it is closer to thirty of
 * them on timber alone, and the campaign numbers said so — labour wood on seed 11 went 2368 to
 * 10266 with the approach fix and two oxen in.
 *
 * OX_MAX 2 -> 1. Nothing else moves: the yoke rule, the stand-down at OX_WOOD_FULL, the cutter
 * floor and the villager floor are all unchanged, so a team still yokes one when timber is short
 * and stands it down when the stores are full. The cap is the only dial that was wrong.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","07-ai.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("one ox at the pit",
`// OX_MAX: oxen a team will yoke. Two is a deliberate floor-to-ceiling: each one costs a working
//   body as well as 75 food and 75 gold, and a marshal that turns its workforce into carts has
//   traded its army for timber it cannot spend.`,
`// OX_MAX: oxen a team will yoke. ONE, from John's first playtest of v134.4: "wood is being
//   gathered extremely fast with two NPC oxcarts. Could reduce this to one." The bench said the
//   same thing and I under-weighted it — an ox is four times the axe AND a fifteenth of the
//   walking (300 in the bed against 20, so one trip where a villager makes fifteen), so a second
//   one is not a second villager, it is closer to another fifteen of them on timber alone.`);

sub("…and the number itself",
`const OX_MAX=2, OX_MIN_VILLS=10, OX_MIN_CUTTERS=3, OX_WOOD_WANT=3000, OX_WOOD_FULL=5000, OX_EVERY=45;`,
`const OX_MAX=1, OX_MIN_VILLS=10, OX_MIN_CUTTERS=3, OX_WOOD_WANT=3000, OX_WOOD_FULL=5000, OX_EVERY=45;`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-oxdial-v134: OK");
