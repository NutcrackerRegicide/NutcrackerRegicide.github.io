#!/usr/bin/env node
/* patch-smoketest-quests.js — bring tools/smoketest.js honest at v132.27.
 *
 * The copy recovered from John's disk predates v132.24/.25/.26/.27 in five places. Each was
 * verified by direct measurement (tools/_probe.js) BEFORE being touched, because the handoff's
 * §2 rule is that a gate which disagrees with the game is not automatically the one that is right:
 *
 *   1. stone piles: asserts 5. The map has SIX since v132.24 re-sited the piles and added a deep
 *      one on the axis. Measured: (148,26) (-148,26) (88,32) (-88,32) (0,-30) (0,-132).
 *   2/3. PROTO: asserts 30, twice. NET.PROTO is 33 (v132.26 put `bz` in both payloads).
 *   4. TREE_STANDS length %2===0: asserts an EVEN count. Measured 25 — odd, and correct, because
 *      under the x-mirror a stand sitting on x=0 is its own partner. Only the OFF-AXIS stands
 *      have to pair up. The old even-count test encoded the retired 180° convention.
 *   5. the 180° stand mirror: measured x-mirror TRUE, 180-mirror FALSE. v132.25 put the whole
 *      world on (x,z)->(-x,z); invariant #5 forbids reintroducing the 180° one. The gate was
 *      asserting the thing the map programme deliberately removed.
 *   6. the tree-clearing test: NOT stale data — a stale METHOD, and the interesting one.
 *      It picks the first tree matching a filter that excludes buildings, finite nodes and town
 *      boards, but NOT roads. 634 trees match that filter and 612 of them are buildable; the
 *      .find() happened to land on (-2.44,-88.11), which sits on the King's Road. The game was
 *      right and the gate was wrong. Worse, the old form is a SINGLE SAMPLE of a global claim.
 *      Replaced with a DIFFERENTIAL test, which is not circular: hold the position fixed and
 *      vary only the timber. If wood does not block a plot, deleting it changes nothing; if
 *      stone does block one, deleting it flips validFor to true. That isolates the variable
 *      instead of trusting whichever tree sorts first.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
const orig=s;
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("stone pile count",
  'check("stone: exactly 5 piles on the map",nodes.filter(n=>n.type==="stone").length===5);',
  'check("stone: exactly 6 piles on the map (v132.24 re-sited them and added the deep axis pile)",nodes.filter(n=>n.type==="stone").length===6);');

sub("PROTO site 1",
  'check("v132 wire: PROTO is 30 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===30);',
  'check("v132 wire: PROTO is 33 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===33);');

sub("PROTO site 2",
  'check("v115/v132 net: PROTO 30 (the envelope delta omits fields) and `ares` still rides both payloads",\n    G.NET.PROTO===30&&',
  'check("v115/v132 net: PROTO 33 (the envelope delta omits fields) and `ares` still rides both payloads",\n    G.NET.PROTO===33&&');

sub("stand count parity",
  'check("v115 stands: the map carries real forests ("+G.TREE_STANDS.length+" stands)",\n    G.TREE_STANDS.length>=20&&G.TREE_STANDS.length%2===0);',
  'check("v115 stands: the map carries real forests ("+G.TREE_STANDS.length+" stands)",\n    G.TREE_STANDS.length>=20&&\n    G.TREE_STANDS.filter(s=>Math.abs(s.x)>=0.001).length%2===0);');

sub("stand mirror axis",
  '  // every stand is mirrored through the map centre, so neither throne draws the better wood\n'+
  '  const mirrored=G.TREE_STANDS.every(s=>\n'+
  '    G.TREE_STANDS.some(o=>Math.abs(o.x+s.x)<0.001&&Math.abs(o.z+s.z)<0.001&&Math.abs(o.r-s.r)<0.001));\n'+
  '  check("v115 stands: every stand is mirrored 180° — the wood is fair to both thrones",mirrored);',
  '  // v132.25: ONE mirror for the whole world, (x,z) -> (-x,z). The 180° convention is retired —\n'+
  '  // the two of them were each fair alone but not fair together, because node clearance deletes\n'+
  '  // trees, and wood within 60 of a throne read BLUE 1 / RED 12. Do not reintroduce it.\n'+
  '  const mirrored=G.TREE_STANDS.every(s=>\n'+
  '    G.TREE_STANDS.some(o=>Math.abs(o.x+s.x)<0.001&&Math.abs(o.z-s.z)<0.001&&Math.abs(o.r-s.r)<0.001));\n'+
  '  check("v115/v132.25 stands: every stand is mirrored in x — the wood is fair to both thrones",mirrored);\n'+
  '  check("v132.25 stands: the RETIRED 180° mirror is genuinely gone (a stand off the axis has no 180° twin)",\n'+
  '    !G.TREE_STANDS.filter(s=>Math.abs(s.x)>=0.001&&Math.abs(s.z)>=0.001).every(s=>\n'+
  '      G.TREE_STANDS.some(o=>Math.abs(o.x+s.x)<0.001&&Math.abs(o.z+s.z)<0.001&&Math.abs(o.r-s.r)<0.001)));');

sub("tree clearing differential",
  '    const stone=N.find(n=>n.type==="stone"&&n.amount>0);\n'+
  '    check("v114 clearing: a plot may be laid over standing timber, never over a stone pile",\n'+
  '      G.validFor("house",live.x,live.z,0)===true&&G.validFor("house",stone.x,stone.z,0)===false);',
  '    const stone=N.find(n=>n.type==="stone"&&n.amount>0);\n'+
  '    // DIFFERENTIAL, not a single sample. The old form asserted validFor()===true at the first\n'+
  '    // tree matching a filter that never excluded ROADS — 634 trees matched, 612 were buildable,\n'+
  '    // and .find() landed on one of the 22 sitting on the King road. That failed a correct game.\n'+
  '    // Hold the position fixed and vary ONLY the timber: wood must not be what blocks a plot,\n'+
  '    // and stone must be.\n'+
  '    const woodAmt=live.amount; live.amount=0;\n'+
  '    const withoutWood=G.validFor("house",live.x,live.z,0);\n'+
  '    live.amount=woodAmt;\n'+
  '    const withWood=G.validFor("house",live.x,live.z,0);\n'+
  '    const stoneAmt=stone.amount; stone.amount=0;\n'+
  '    const withoutStone=G.validFor("house",stone.x,stone.z,0);\n'+
  '    stone.amount=stoneAmt;\n'+
  '    const withStone=G.validFor("house",stone.x,stone.z,0);\n'+
  '    check("v114 clearing: TIMBER is never what blocks a plot (felling it changes nothing: "+withWood+" -> "+withoutWood+")",\n'+
  '      withWood===withoutWood);\n'+
  '    check("v114 clearing: a STONE pile always blocks one, and is the sole reason it is blocked ("+withStone+" -> "+withoutStone+")",\n'+
  '      withStone===false&&withoutStone===true);');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
if(s===orig){console.log("no change (already patched)");process.exit(0);}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — 6 sites");
