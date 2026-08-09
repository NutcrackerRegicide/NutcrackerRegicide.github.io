#!/usr/bin/env node
/* v132.19 — THE GATES GROW UNTIL A CANNON FITS UNDER THEM
   -------------------------------------------------------
   node tools/patch-gatetall.js         (idempotent: re-running reports NOTHING WRITTEN)

   John: "enlightenment age gate is tiny compared to cannone", with a picture of a cannon parked in
   the gateway that is visibly bigger than the gate it is standing in.

   v132.15/.16 fixed WIDTH and flagged HEIGHT as an open decision with a number on it. This is that
   decision taken. Measured (tools/gatefit.js), what has to pass:

       Cannon 8.29 tall · Culverin 8.27 · Catapult 9.26 · Ox Cart 6.18 · a man 5.43
       against ceilings of 6.50 - 6.80

   TARGET 9.4 OF HEADROOM: catapult 9.26 with a little air, and everything smaller with plenty. Two
   things still will not pass and are left alone deliberately — the Battering Ram at 11.75 and the
   Trebuchet at 16.83. A ram exists to hit a wall rather than drive through it, and a trebuchet at
   16.8 is taller than any gatehouse in any age of this game; making a gate clear it would make the
   gate the tallest thing on the map.

       gate            was      now     ceiling
       wood a2-a5      8.4     11.0       9.30
       Classical a3    9.6     11.4       9.40
       Medieval a4    10.4     11.8       9.40
       Enlightenment   9.4     11.8       9.50

   AND ON THE AGE-5 GATE THE CEILING WAS A COAT OF ARMS. Its lintel underside sits at GH-1.95 and
   would have given 7.45 already; the 6.75 that was measured is the `arms` plaque — a 0.9-tall gold
   box on the front face at GH-2.2. The most monumental gate in the game was being kept shut by its
   own decoration, which is the third time in this block that a decorative box has turned out to be
   the thing in the way (the age-5 head disc, the Classical jamb, now this). It rides at GH-1.2 now,
   above the opening rather than across it.

   THE MEDIEVAL PORTCULLIS HAD THE SAME PROBLEM ONE LEVEL DOWN: nine bars 3.0 tall hanging at
   h-2.4, which after the vault rose would have dangled to 7.9 — a raised portcullis still
   decapitating anything over 7.9. Shortened to 2.2 and hung inside the vault at h-1.2, which is
   where a retracted portcullis actually sits.

   THE ENLIGHTENMENT GATEHOUSE ALSO GETS DEEPER PIERS, 3.0 -> 3.6. Height alone would have made it
   a tall thin frame; John's word was "tiny", and mass reads as much as height. It stays inside the
   12.5 curtain segment in plan, so nothing about wall placement moves — §F.6's low rampart with a
   monumental portal rising out of it is exactly the contrast the branch's own note argues for, and
   this makes the portal monumental instead of merely taller than the rampart.                     */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("03-buildings.js").indexOf("GH=11.8")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- wood: 8.4 -> 11.0 ---------------------------------------------------------------------------
sub("03-buildings.js",
`      const h=8.4;`,
`      // v132.19 11.0. The lintel hangs 1.7 deep off the top so the underside is h-1.7: at 8.4 that
      // was 6.70, and a Cannon is 8.29 tall, a Catapult 9.26. 11.0 gives 9.30.
      const h=11.0;`,
  "03-buildings.js: the wood gate clears a cannon");

// ---- Classical a3: 9.6 -> 11.4, and its reveal rides with it -------------------------------------
sub("03-buildings.js",
`      const wmat=texturedMat("metal",STONELIT);
      const h=9.6;`,
`      const wmat=texturedMat("metal",STONELIT);
      // v132.19 11.4: the lintel is 2.0 deep at h-1.0, so the underside is h-2.0 = 9.40.
      const h=11.4;`,
  "03-buildings.js: the Classical gate clears a cannon");

sub("03-buildings.js",
`      for(const s of [-1,1]){const jb=box(0.6,6.8,0.4,P.dark); jb.castShadow=false;
        jb.position.set(s*(GATE_PASS/2+0.3),3.4,1.15); g.add(jb);}
      {const hd=box(GATE_PASS+1.2,0.8,0.4,P.dark); hd.castShadow=false;
       hd.position.set(0,7.2,1.15); g.add(hd);}`,
`      // v132.19 the reveal grows with the gate: jambs to the lintel's underside at 9.40, head band
      // flush above it rather than hanging into the opening.
      for(const s of [-1,1]){const jb=box(0.6,9.4,0.4,P.dark); jb.castShadow=false;
        jb.position.set(s*(GATE_PASS/2+0.3),4.7,1.15); g.add(jb);}
      {const hd=box(GATE_PASS+1.2,0.7,0.4,P.dark); hd.castShadow=false;
       hd.position.set(0,9.75,1.15); g.add(hd);}`,
  "03-buildings.js: the Classical reveal rises with the gate");

// ---- Medieval a4: 10.4 -> 11.8, and the portcullis stops hanging into the passage ----------------
sub("03-buildings.js",
`      const wmat=texturedMat("metal",P.stone);
      const h=10.4;`,
`      const wmat=texturedMat("metal",P.stone);
      // v132.19 11.8: the vault is 2.4 deep at h-1.2, so the underside is h-2.4 = 9.40.
      const h=11.8;`,
  "03-buildings.js: the Medieval gatehouse clears a cannon");

sub("03-buildings.js",
`      {const NB=13, sp=GATE_PASS/(NB-1);
       for(let i=0;i<NB;i++){const bar=box(0.22,3.0,0.16,STONEDK); bar.castShadow=false;
         bar.position.set(-GATE_PASS/2+i*sp,h-2.4,1.5); g.add(bar);}}        // the raised portcullis`,
`      // v132.19 …AND IT HAS TO BE RAISED INTO THE VAULT, not merely called raised. 3.0-tall bars at
      // h-2.4 hang from 7.90 once the vault rises — a "raised" portcullis still taking the head off
      // anything over 7.90. 2.2 at h-1.2 puts them at 9.50..11.70, inside the vault, which is where
      // a retracted portcullis physically goes.
      {const NB=13, sp=GATE_PASS/(NB-1);
       for(let i=0;i<NB;i++){const bar=box(0.22,2.2,0.16,STONEDK); bar.castShadow=false;
         bar.position.set(-GATE_PASS/2+i*sp,h-1.2,1.5); g.add(bar);}}        // the raised portcullis`,
  "03-buildings.js: the raised portcullis is actually raised");

// ---- Enlightenment a5: 9.4 -> 11.8, deeper piers, and the arms stop being the ceiling -------------
sub("03-buildings.js",
`      const GH=9.4, PW=2.2, PGAP=GATE_PASS;      // gatehouse height, pier width, clear passage`,
`      // v132.19 11.8 AND DEEPER PIERS. John: "enlightenment age gate is tiny compared to cannone."
      // The lintel is 1.3 deep at GH-0.65, so the underside is GH-1.95 = 9.85. Piers 3.0 -> 3.6 deep
      // because height alone makes a tall thin frame and his word was "tiny" — mass reads as much as
      // height. Both stay inside the 12.5 curtain segment in plan, so wall placement is untouched,
      // and §F.6's low rampart with a monumental portal rising out of it is the contrast this
      // branch's own note argues for. It is now monumental rather than merely taller than a rampart.
      const GH=11.8, PW=2.2, PGAP=GATE_PASS;     // gatehouse height, pier width, clear passage`,
  "03-buildings.js: the Enlightenment portal grows to 11.8");

sub("03-buildings.js",
`        const pier=new THREE.Mesh(new THREE.BoxGeometry(PW,GH,3.0),aWall(age));`,
`        const pier=new THREE.Mesh(new THREE.BoxGeometry(PW,GH,3.6),aWall(age));`,
  "03-buildings.js: …on deeper piers");

sub("03-buildings.js",
`      const arms=box(1.5,0.9,0.2,GOLD); arms.castShadow=false; arms.position.set(0,GH-2.2,2.05); g.add(arms);`,
`      // v132.19 THE CEILING OF THIS GATE WAS A COAT OF ARMS. The lintel underside gives 9.85; the
      // 6.75 gatefit measured was this 0.9-tall plaque at GH-2.2, hanging in front of the opening.
      // Third time in this block that a decorative box has turned out to be the thing in the way.
      const arms=box(1.5,0.9,0.2,GOLD); arms.castShadow=false; arms.position.set(0,GH-1.2,2.35); g.add(arms);`,
  "03-buildings.js: the coat of arms stops being the ceiling");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
