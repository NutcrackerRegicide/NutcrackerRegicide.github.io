#!/usr/bin/env node
/* patch-smoketest-offseed2-v134.js — the stone gate stages its own piles.
 *
 * SMOKE_SEED=42, v134.4: "v114 clearing: EVERY LIVE stone pile refuses a plot (3/3 live of 6
 * sited)". Three of three blocked — the RULE held perfectly — and the gate went red anyway, on the
 * clause `piles.length>=4`. That clause is a vacuity guard: it exists so the sweep cannot pass by
 * having nothing to sweep. But it counts piles the CAMPAIGN has not mined out yet, and a campaign
 * with a working haul (v134.4) mines faster than one without. So the guard fires on a healthier
 * economy, which is the opposite of what a guard is for.
 *
 * This is the last survivor of the "assert the invariant, not an absolute" pass in v134.0, left
 * alone then and reported rather than sanded down. The right cure was always the same one this arc
 * has applied a dozen times since: STAGE IT. If the campaign has spent the piles, put stone back in
 * enough of them to sweep, sweep, and put them back as they were. The guard then means what it says
 * — four subjects were tested — instead of meaning "the AI has not mined much".
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

sub("the stone sweep stages its subjects",
`    const allPiles=N.filter(n=>n.type==="stone");
    const piles=allPiles.filter(n=>n.amount>0);`,
`    const allPiles=N.filter(n=>n.type==="stone");
    // v134.4 …AND IF THE CAMPAIGN HAS SPENT THEM, PUT THE STONE BACK FOR THE LENGTH OF THE SWEEP.
    // piles.length>=4 below is a vacuity guard — it exists so this cannot pass with nothing to
    // test — but it was counting what the AI had not yet mined, so a HEALTHIER economy failed it.
    // SMOKE_SEED=42 on v134.4: three live piles, three of three blocked, rule perfect, gate red.
    const _stoneWas=allPiles.map(n=>n.amount);
    for(const n of allPiles){
      if(allPiles.filter(m=>m.amount>0).length>=4)break;
      if(n.amount<=0)n.amount=40;                       // enough to be a pile again, briefly
    }
    const piles=allPiles.filter(n=>n.amount>0);`);

sub("…and puts them back as it found them",
`    check("v114 clearing: EVERY LIVE stone pile refuses a plot ("+blocked+"/"+piles.length+
      " live of "+allPiles.length+" sited)",
      blocked===piles.length&&allPiles.length===6&&piles.length>=4);`,
`    const _restaked=piles.length-allPiles.filter((n,i)=>_stoneWas[i]>0).length;
    check("v114 clearing: EVERY LIVE stone pile refuses a plot ("+blocked+"/"+piles.length+
      " live of "+allPiles.length+" sited"+(_restaked>0?", "+_restaked+" re-staked for the sweep "+
      "after the campaign mined them out":"")+")",
      blocked===piles.length&&allPiles.length===6&&piles.length>=4);
    for(let i=0;i<allPiles.length;i++)allPiles[i].amount=_stoneWas[i]; // v134.4: as we found them`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-offseed2-v134: OK");
