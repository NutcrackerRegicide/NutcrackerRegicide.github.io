#!/usr/bin/env node
/* patch-oxcap-v134.js — v134.8: the bot's ox stops taking a bite bigger than the bed it has left.
 *
 * FOUND BY A WIDER SEED SWEEP, not by a playtest. SMOKE_SEED=99:
 *
 *   FAIL — no unit ever exceeds ITS OWN carry cap (heaviest load seen 303, oxen on the field 2 at
 *          a cap of 300)
 *
 * MY BUG, from v134.4. The ox takes FOUR at a swing where a villager takes one, and the three
 * places that implement that all say so — 09-main.js:120 for the player's own hands,
 * 10-net.js:1245 for a guest's, 07-ai.js:1485 for a bot's. The first two clamp the bite to the room
 * left in the bed:
 *
 *     const tk=Math.min(player.cls==="oxcart"?4:1, n.amount, cap-player.carry[n.type]);
 *
 * The one I wrote clamped only against what was left in the SEAM:
 *
 *     const _tk=Math.min((u.cls==="oxcart")?4:1, b.node.amount);
 *
 * A bed of 300 is exactly 75 swings of four, so it lands on the cap dead-on — until a seam runs dry
 * mid-load and truncates one bite. Take 3 off a dying tree and the ox is on 299; the next full bite
 * of 4 makes 303. The overshoot is bounded at 3 and it is not, on its own, going to lose anybody a
 * game — but "a unit never carries more than its cap" is one of the few things the economy gates
 * assert flatly, and a rule that is true 99 games in 100 is worse than one that is false, because
 * the hundredth is the one nobody believes.
 *
 * The comment above the line claimed "the arithmetic lives in one place". It lived in three, and
 * one of them was wrong; the comment now says which three and what they share.
 *
 * CLAMPED ON THE TOTAL, where the other two clamp per-resource. Identical for any body that banks
 * its whole load in one action, which every gatherer in the file does — and if one ever carries two
 * resources at once, the total is the number carryCap actually means and the one the gate reads.
 *
 * ⚠ NOTED, NOT FIXED, three lines up: a bot villager hauls at a hardcoded 20 rather than at
 * carryCap(u), so Deep Satchel does nothing for a bot. That is older than v134.4 and it makes a bot
 * carry LESS than its cap, which breaks no invariant — it is in the handoff as an open question
 * rather than smuggled into this fix.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const A=path.join(R,"js","07-ai.js");
let a=fs.readFileSync(A,"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=a.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  a=a.split(from).join(to);
};

sub("the ox bite is clamped to the bed",
`        // v134.4: FOUR at a swing for the ox — the same figure the human ox takes in 09-main.js
        // ("v99: four swings' worth for the ox") and in driveRemote. The swing TIME is unchanged,
        // so the axe is four times the villager's and the arithmetic lives in one place.
        const _tk=Math.min((u.cls==="oxcart")?4:1,b.node.amount);`,
`        // v134.4: FOUR at a swing for the ox — the same figure the human ox takes in 09-main.js:120
        // and a guest's in 10-net.js:1245. The swing TIME is unchanged, so the axe is four times the
        // villager's. Three copies of one number, and they now agree on the clamp as well.
        // v134.8 …AND NEVER MORE THAN THE BED HAS ROOM FOR. This clamped against the SEAM alone.
        // 300 is exactly 75 bites of four so a full load lands on the cap dead-on — until a tree
        // runs dry mid-load and truncates one bite to 3. The ox is then on 299 and the next full
        // bite makes 303. Found on SMOKE_SEED=99, bounded at 3, and the only flat rule the economy
        // gates have. The other two copies have clamped on \`cap - carry\` since v99; this one did not.
        const _room=carryCap(u)-(u.carry.food+u.carry.gold+u.carry.stone+u.carry.wood);
        const _tk=Math.max(0,Math.min((u.cls==="oxcart")?4:1,b.node.amount,_room));`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(A,a);
console.log("patch-oxcap-v134: OK");
