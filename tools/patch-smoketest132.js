#!/usr/bin/env node
/* v132.6 — THE SMOKETEST STILL BELIEVED IN THE OLD MAP
   ----------------------------------------------------
   node tools/patch-smoketest132.js     (idempotent: re-running reports NOTHING WRITTEN)

   After the Viking road went in, tools/smoketest.js reported three failures. All three are the
   harness noticing, correctly, that the world changed — which is the gate doing its job — and all
   three are assertions about the OLD map that have to be re-stated for the new one:

     FAIL — all three bazaars sit along the Kings Road
     FAIL — v132 wire: PROTO is 27 …
     FAIL — v115/v132 net: PROTO 27 … and `ares` still rides both payloads

   THE BAZAAR ONE IS THE INTERESTING FAILURE and it is worth not just deleting. The check was a
   HAND-COPIED spine:
       const roadZ=t=>Math.sin(t*Math.PI)*16+Math.sin(t*Math.PI*3)*4;
   — the King's Road's z(t), typed out a second time in a second file. That is the exact species of
   drift tools/mapconst.js was written to catch (01-engine.js flattening the terrain at three
   hand-typed bazaar coordinates), and it had already gone stale here without anybody noticing,
   because it only fails when the spine moves and the spine had not moved in fifty versions.
   It is replaced with three checks that read BAZAAR_SITES, roadPoint and vikingPoint — the same
   definitions the world is BUILT from, so they cannot disagree with it:
       every bazaar stands where BAZAAR_SITES says it does
       the Grand Bazaar is the one on the Kings Road
       each team bazaar sits on its own branch of the Viking road
   That is strictly more than the old check asserted: it now pins WHICH bazaar is on WHICH road,
   which is the thing bazaarTier() in 09-main.js ranks and the trade_short/mid/long quests consume.

   The mirror-balance check underneath is left exactly as it was and still passes — the layout is
   still 180-degree symmetric, which is the property that actually has to hold for neither team to
   draw the shorter trade run.

   THE TWO PROTO ONES are literals, 27 -> 28. Their own comment already says why they exist: "the
   assertion is that the number MOVED WITH THE WORLD, which is the thing a peer actually needs — a
   stale literal here is how two builds shake hands and disagree." Measured with tools/nodehash.js:
       v132.0    880 nodes (824 wood)  all=34d24d58499fbac7
       v132.6    844 nodes (788 wood)  all=1a85b0de9797edd9
   The tree count came DOWN because the Viking road's clearance corridor removed 36 of them.       */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const P=path.join(ROOT,"tools","smoketest.js");
let S=fs.readFileSync(P,"utf8");
function sub(from,to,why){
  const n=S.split(from).length-1;
  if(n!==1){console.log("  !! expected 1, found "+n+"  <<"+from.slice(0,72).replace(/\n/g,"\\n")+">>");failed++;return;}
  S=S.split(from).join(to); total++; console.log("  ok  "+why);
}
if(S.indexOf("BAZAAR_SITES")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- the harness has to be able to see the two spines and the site table ----------------------
sub(
`  "makeTree,depleteNode,clearFootprint,TREE_SCALE,TREE_GEOS,STUMP_GEOS,TREE_STANDS,TREE_CLEAR_BASE,TREE_CLEAR_ROAD,roadPoint,"+`,
`  "makeTree,depleteNode,clearFootprint,TREE_SCALE,TREE_GEOS,STUMP_GEOS,TREE_STANDS,TREE_CLEAR_BASE,TREE_CLEAR_ROAD,roadPoint,"+
  "vikingPoint,BAZAAR_SITES,TREE_CLEAR_VIKING,"+`,
  "smoketest: the harness can see vikingPoint, BAZAAR_SITES and the Viking clearance");

// ---- the bazaars are no longer all on one road -------------------------------------------------
sub(
`// v78: every bazaar sits ON the Kings Road, and the set is mirror-balanced between the thrones
{
  const TP=global.__G.TCPOS;
  const roadZ=t=>Math.sin(t*Math.PI)*16+Math.sin(t*Math.PI*3)*4;
  const onRoad=neutralMarkets.every(m=>{
    const t=(m.x-TP[0][0])/(TP[1][0]-TP[0][0]);
    return t>0.05&&t<0.95&&Math.abs(m.z-(roadZ(t)+3.2))<0.01;
  });
  check("all three bazaars sit along the Kings Road",onRoad);`,
`// v78/v132.1: the bazaars sit on TWO roads now — the Grand on the Kings Road, one per team on that
// team's branch of the Viking road — and the set is still mirror-balanced between the thrones.
// WHAT THIS USED TO BE was a hand-copied roadZ(t): the King's Road's spine, typed out a second time
// in a second file. That is the drift tools/mapconst.js exists to catch, and it went stale here the
// moment two of the three bazaars left the road. Read the definitions the world is BUILT from.
{
  const TP=global.__G.TCPOS, SITES=global.__G.BAZAAR_SITES;
  const near=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)<0.01;
  check("every bazaar stands where BAZAAR_SITES says it does",
    SITES.length===3&&SITES.every(Sq=>{const q=Sq.p();return neutralMarkets.some(m=>near(m,q));}));
  {
    const g=SITES.find(Sq=>Sq.grand), p=global.__G.roadPoint(0.5);
    check("the Grand Bazaar is the one on the Kings Road",
      !!g&&near(g.p(),{x:p.x,z:p.z+3.2}));
  }
  {
    const vk=SITES.filter(Sq=>Sq.team!==undefined);
    check("each team bazaar sits on its own branch of the Viking road",
      vk.length===2&&vk.every(Sq=>near(Sq.p(),global.__G.vikingPoint(Sq.team,0.42))));
  }`,
  "smoketest: three checks off BAZAAR_SITES replace one hand-copied spine");

// ---- the wire ----------------------------------------------------------------------------------
sub(
`  check("v132 wire: PROTO is 27 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===27);`,
`  check("v132 wire: PROTO is 28 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===28);`,
  "smoketest: PROTO 27 -> 28 (the snapshot assertion)");

sub(
`  check("v115/v132 net: PROTO 27 (the envelope delta omits fields) and \`ares\` still rides both payloads",
    G.NET.PROTO===27&&`,
`  check("v115/v132 net: PROTO 28 (the envelope delta omits fields) and \`ares\` still rides both payloads",
    G.NET.PROTO===28&&`,
  "smoketest: PROTO 27 -> 28 (the ares assertion)");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
fs.writeFileSync(P,S);
console.log("\n"+total+" written.\n");
