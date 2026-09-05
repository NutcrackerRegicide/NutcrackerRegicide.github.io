#!/usr/bin/env node
/* patch-smoketest-oxcap-v134.js — the gate for the ox's clamped bite.
 *
 * The suite already had a gate that catches this: "no unit ever exceeds ITS OWN carry cap". It is
 * the right assertion and it is where the bug surfaced — but it is a SWEEP of whatever the campaign
 * happens to have produced, so it caught the overshoot on SMOKE_SEED=99 and on none of the other
 * seven seeds tried. A rule that only goes red when a tree happens to run dry under a loaded ox is
 * a rule nobody can rely on.
 *
 * So this stages the exact arithmetic instead. An ox one log short of a full bed, standing on a fat
 * seam: the bite has to be 1, not 4. Restored to \`Math.min(4, node.amount)\` it takes 4 and reads
 * 303 of 300, which is the number seed 99 reported. It also asserts the boring half — that a bite
 * off a full bed is still FOUR — because a clamp written as \`Math.min(…, 0)\` would pass the first
 * check and quietly stop the ox being an ox.
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

sub("the ox bed bench",
`  // --- 5. THE OX AT WORK: four logs a swing into a bed of 300, and it will not touch anything else.`,
`  // --- 4b. THE BED HAS A BOTTOM. v134.8: the bite was clamped against the SEAM alone, so an ox on
  //         299 of 300 took a full four and ended on 303. It needs a dying tree to get to 299 —
  //         300 is exactly 75 bites of four, so only a truncated bite leaves an odd number — which
  //         is why the campaign sweep found it on one seed in eight. Staged, it is arithmetic.
  {
    const seam=G.nodes.find(n=>n.type==="wood"&&n.amount>60);
    const a0=seam.amount;
    const mk=(carried)=>{
      const ox=G.makeUnit(0,"oxcart",seam.x+1.5,seam.z+1.5,{name:"CapOx",bot:{role:"citizen",res:"wood"}});
      ox.bot.node=seam; ox.bot.off={x:0.5,z:0.5}; ox.carry.wood=carried;
      const before=seam.amount, held=ox.carry.wood;
      for(let i=0;i<30*4&&ox.carry.wood===held;i++){G.updateBot(ox,1/30);G.advanceT(1/30);}
      const bite=ox.carry.wood-held, load=ox.carry.wood;
      seam.amount=before; ox.alive=false;
      return {bite,load};
    };
    const cap=G.carryCap({cls:"oxcart",buffs:null,carry:{food:0,gold:0,stone:0,wood:0}});
    const brim=mk(cap-1), empty=mk(0);
    seam.amount=a0;
    check("v134.8 ox: a bed with one log's room left takes ONE log ("+brim.bite+", ending on "+
      brim.load+" of "+cap+"), and an empty one still takes FOUR ("+empty.bite+"). The bite was "+
      "clamped against the seam alone, so a tree running dry mid-load left the ox on 299 and the "+
      "next full bite made 303 — bounded at 3, found on SMOKE_SEED=99, and the only flat rule the "+
      "economy gates have. 09-main.js:120 and 10-net.js:1245 have clamped on the room left since "+
      "v99; the marshal's copy did not",
      brim.bite===1&&brim.load<=cap&&empty.bite===4);
  }

  // --- 5. THE OX AT WORK: four logs a swing into a bed of 300, and it will not touch anything else.`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-oxcap-v134: OK");
