#!/usr/bin/env node
/* patch-smoketest-stone-invariant-v134.js — "assert the invariant, not an absolute", applied to
 * the one gate in the suite that was still asserting an absolute.
 *
 * v114's clearing gate ended with:
 *
 *   check("…on the standalone piles the stone is provably the cause — "+freedByRemoval+" of "+
 *         piles.length+" free up when the pile is removed", freedByRemoval>=2);
 *
 * `>=2` counts how many live stone piles happen, at the end of one campaign, to have nothing else
 * standing on them. That is not a property of the code — it is a property of where the AI chose to
 * put its storage pits, which every behaviour change reshuffles. The comment three lines above
 * already records it flaking once ("Asserting over all six made this gate flake 6/6 -> 5/6 between
 * runs"), and the fix then was to narrow the population rather than to fix the claim.
 *
 * The v134.0 pathing work reshuffled it again and it went red on the DEFAULT seed. Measured:
 *
 *   pile( 88, 32)  1 other live node in the footprint   storage_pit 14 away
 *   pile(-88, 32)  1 other live node in the footprint   market 8 away, storage_pit 24 away
 *   pile(  0,-30)  nothing else at all                  → frees when the stone goes ✓
 *   pile(  0,-132) nothing else                         storage_pit 10 away
 *
 * Three of the four plots are refused by a BUILDING, so the claim was never true of them — and a
 * storage pit ten paces from a stone pile is the AI siting a drop-off beside the prize, which is
 * correct play and must not be able to fail a clearing test. The invariant underneath never
 * wavered: where the stone is the only thing in the way, removing it frees the plot.
 *
 * So the gate is CONSTRUCTED rather than scavenged. Find clean, legal, empty ground; plant a stone
 * pile on it; the plot must be refused. Empty the pile; the plot must be legal again. That is
 * exactly what v114 protects, it is deterministic, and no campaign can shuffle it. The two
 * surviving campaign-wide checks either side of it ("EVERY LIVE stone pile refuses a plot", "the
 * refusal is LOCAL to the prize") are untouched — they are already stated as invariants — and the
 * old freedByRemoval tally stays in the message as a reported number, where a number belongs.
 *
 * The planted node is pushed onto `nodes` and spliced straight back out. `nodes` is positional on
 * the wire (invariant #3) so it must end the block exactly as it started it, and nothing runs in
 * between.
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

sub("stone: a constructed test of the rule, not a tally of the leftovers",
`    check("v114 clearing: …and on the standalone piles the stone is provably the cause — "+
      freedByRemoval+" of "+piles.length+" free up when the pile is removed (the other four sit\\n      inside v132.24 resource CLUSTERS, where a neighbour still covers the footprint)",
      freedByRemoval>=2);`,
`    // v134.0 CONSTRUCTED, NOT SCAVENGED. See tools/patch-smoketest-stone-invariant-v134.js: this
    // asserted freedByRemoval>=2, a tally of how many piles happened to have nothing built beside
    // them at the end of one campaign, and it went red on the default seed the moment the pathing
    // changed — 3 of 4 plots were refused by a BUILDING, and the one genuinely standalone pile
    // freed up exactly as it should. Clean ground, one planted pile, both directions:
    {
      const RH=G.BLD.house.r;
      let spot=null;
      for(let x=-150;x<=150&&!spot;x+=7)for(let z=-110;z<=110&&!spot;z+=7){
        if(G.validFor("house",x,z,0)!==true)continue;              // legal before we touch anything
        if(N.some(n=>n.type!=="wood"&&n.amount>0&&Math.hypot(n.x-x,n.z-z)<RH+9))continue;
        spot={x,z};
      }
      let refused=false,freed=false;
      if(spot){
        const planted={type:"stone",x:spot.x,z:spot.z,amount:500};
        N.push(planted);                                           // …and out again, below
        refused=G.validFor("house",spot.x,spot.z,0)===false;
        planted.amount=0;
        freed=G.validFor("house",spot.x,spot.z,0)===true;
        N.splice(N.indexOf(planted),1);   // nodes is POSITIONAL on the wire — leave it as we found it
      }
      check("v114 clearing: on clean ground a stone pile REFUSES the plot and emptying it frees "+
        "the plot again ("+(spot?"at "+spot.x+","+spot.z+": refused "+refused+", freed "+freed:
        "NO CLEAN GROUND FOUND")+"; of the "+piles.length+" live piles on the map "+freedByRemoval+
        " stand alone, the rest are covered by a building or a neighbour)",
        !!spot&&refused&&freed);
    }`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-stone-invariant-v134: OK");
