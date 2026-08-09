#!/usr/bin/env node
/* v132.13 — THE SMOKETEST STILL HAD THE OLD BAZAAR OFFSETS TYPED INTO IT
   ----------------------------------------------------------------------
   node tools/patch-smoketest-bazaar.js (idempotent: re-running reports NOTHING WRITTEN)

     FAIL — the Grand Bazaar is the one on the Kings Road
     FAIL — each team bazaar sits on its own branch of the Viking road
     FAIL — v132 wire: PROTO is 29 …
     FAIL — v115/v132 net: PROTO 29 … and `ares` still rides both payloads

   The first two are v132.6's own checks, and they failed for a good reason: they were written to
   assert the bazaars are ON their roads, which they no longer are and should never have been.

       near(g.p(), {x:p.x, z:p.z+3.2})                    // the Grand, with 3.2 typed in
       near(Sq.p(), vikingPoint(Sq.team, 0.42))           // a team bazaar, exactly on the spine

   The 3.2 is the same species of mistake as the roadZ() copy v132.6 removed from this file: a
   NUMBER from another file, re-typed here, that goes stale silently the moment the other file
   changes its mind. Replacing 3.2 with 24 would just reload the same gun.

   SO THE CHECKS NOW ASSERT THE RELATIONSHIP, which is what John actually asked for and the only
   part that has to stay true:
       WHICH ROAD    the nearest point on the right road is at the right t (0.5 for the Grand,
                     0.42 for each team's own branch) — that is what "on the Kings Road" and "on
                     its own branch" meant and it still holds.
       BESIDE IT     the gap from the plaza's outer step to the spine clears the ribbon's own
                     half-width, so the road cannot run through the flagstones. This is the thing
                     that was broken and that no check would have caught.
       WHICH SIDE    the Grand is on +z of the King's Road (blue's right, facing red); each team
                     bazaar is on -z of its branch (outside the arc, away from the King's Road).
                     Sides are exactly what John reported, so they are exactly what gets asserted.
   Not one literal offset appears. Move the numbers again and these follow.                     */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const P=path.join(ROOT,"tools","smoketest.js");
let S=fs.readFileSync(P,"utf8");
function sub(from,to,why){
  const n=S.split(from).length-1;
  if(n!==1){console.log("  !! expected 1, found "+n+"  <<"+from.slice(0,72).replace(/\n/g,"\\n")+">>");failed++;return;}
  S=S.split(from).join(to); total++; console.log("  ok  "+why);
}
if(S.indexOf("beside its road")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

sub(
`  {
    const g=SITES.find(Sq=>Sq.grand), p=global.__G.roadPoint(0.5);
    check("the Grand Bazaar is the one on the Kings Road",
      !!g&&near(g.p(),{x:p.x,z:p.z+3.2}));
  }
  {
    const vk=SITES.filter(Sq=>Sq.team!==undefined);
    check("each team bazaar sits on its own branch of the Viking road",
      vk.length===2&&vk.every(Sq=>near(Sq.p(),global.__G.vikingPoint(Sq.team,0.42))));
  }`,
`  // v132.11 BESIDE ITS ROAD, NOT ON IT. John: "grand bazaar should be to the right of kings road
  // while the other two bazaars should be to the left of vikings roads. right now all bazaars are
  // directly on top of the roads." What used to be here typed the offset — z + 3.2 for the Grand,
  // nothing at all for the team pair — which is the same re-typed-constant trap as the roadZ() copy
  // v132.6 took out of this file, and swapping 3.2 for 24 would only reload it. Assert the
  // RELATIONSHIP: which road, how far off it, and which side. No literal offset appears.
  {
    const nearestOn=(fn)=>(b)=>{let bt=0,bd=1e9;
      for(let i=0;i<=600;i++){const q=fn(i/600), d=Math.hypot(b.x-q.x,b.z-q.z);
        if(d<bd){bd=d;bt=i/600;}}
      return {t:bt,d:bd,q:fn(bt)};};
    {
      const g=SITES.find(Sq=>Sq.grand), b=g&&g.p();
      const h=g&&nearestOn(t=>global.__G.roadPoint(t))(b);
      check("the Grand Bazaar stands beside its road, at the middle of the Kings Road",
        !!g&&Math.abs(h.t-0.5)<0.03);
      check("…far enough off the spine that the ribbon misses the plaza",
        !!g&&h.d>=g.plaza+6);
      check("…and on the +z side — blue's right, facing red",
        !!g&&b.z>h.q.z);
    }
    {
      const vk=SITES.filter(Sq=>Sq.team!==undefined);
      const at=vk.map(Sq=>{const b=Sq.p();
        return {S:Sq,b,h:nearestOn(t=>global.__G.vikingPoint(Sq.team,t))(b)};});
      check("each team bazaar stands beside its OWN branch of the Viking road",
        vk.length===2&&at.every(a=>Math.abs(a.h.t-0.42)<0.03));
      check("…far enough off the spine that the track misses the plaza",
        at.every(a=>a.h.d>=a.S.plaza+4));
      check("…and on the -z side — outside the arc, away from the Kings Road",
        at.every(a=>a.b.z<a.h.q.z));
    }
  }`,
  "smoketest: the bazaars are asserted beside their roads, on the named side, with no typed offset");

sub(
`  check("v132 wire: PROTO is 29 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===29);`,
`  check("v132 wire: PROTO is 30 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===30);`,
  "smoketest: PROTO 29 -> 30 (the snapshot assertion)");

sub(
`  check("v115/v132 net: PROTO 29 (the envelope delta omits fields) and \`ares\` still rides both payloads",
    G.NET.PROTO===29&&`,
`  check("v115/v132 net: PROTO 30 (the envelope delta omits fields) and \`ares\` still rides both payloads",
    G.NET.PROTO===30&&`,
  "smoketest: PROTO 29 -> 30 (the ares assertion)");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
fs.writeFileSync(P,S);
console.log("\n"+total+" written.\n");
