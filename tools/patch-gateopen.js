#!/usr/bin/env node
/* v132.16 — THE THREE THINGS STILL SEALING THE GATES
   --------------------------------------------------
   node tools/patch-gateopen.js         (idempotent: re-running reports NOTHING WRITTEN)

   v132.15 widened every passage and swung the doors open, and tools/gatefit.js immediately found
   three more things standing in it. All three are the same mistake in different clothes: a piece of
   DECORATION drawn across the opening it is decorating.

     wood a2-a5   5.49   THE DOORS SWUNG THE WRONG WAY. rotation.y = s*1.92 (110 deg) folds a leaf
                         INWARD: hinged at x=+-4.0 its far end lands at 2.83, so the doors opened
                         into the gateway and took 2.5 off it. 1.45 (83 deg) lays them back along
                         the reveal, far end at 4.41 — outside the hinge, so they cost nothing.
     stone a3     0.88   MY OWN SINGLE JAMB. Replacing two 3.0-wide jambs with one GATE_PASS-wide
                         slab of P.dark made the "opening" a solid panel across the whole passage.
                         It is meant to read as the dark inside of an arch; it has to be BESIDE and
                         ABOVE the opening, not across it.
     fort a5      0.00   THE HEAD DISC, and it was there before this work started: a cylinder of
                         radius PGAP/2 laid face-on at GH-1.3. At PGAP 3.4 it spanned y 6.4..8.1 —
                         above everything, invisible as a problem. At 7.8 it spans 4.2..12.0 and
                         seals the gateway from chest height up. A decoration whose size is tied to
                         the passage grows across the passage.

   ================================ AND THE VAULT, WHICH IS JOHN'S OTHER BUG ================================
   The age-5 gate also bridged its own passage at DECK height — a 0.6-thick slab at y=3.7 — put
   there by v131.28 with an explicit reason: "wallFloorAt returns one deck height across a segment's
   whole width, so leaving the gateway open at deck level would walk the player over the opening on
   nothing." True, and it made the passage 3.1 tall against a man who is 5.43.

   That premise is the bug John reported separately: "it is treating the gate as another mountable
   wall so you have this weird condition where units CLIMB OVER the gate to get through it." A gate
   is a way THROUGH a wall, not a way OVER one. So wallFloorAt returns null for gates outright — no
   deck, no ramp — and with nothing walking over the passage there is no reason to floor it. Both
   problems were the same problem, and the fix for one is the fix for the other.
   The flanking terreplein stubs stay: the curtain's walk still runs up to the gatehouse and stops
   at it, which is what a gatehouse looks like and what the walk hitting a tower has always done.

   ================================ WHAT IS LEFT, HONESTLY ================================
   This buys WIDTH, which is what John asked for ("large enough for the largest units to WALK
   THROUGH it"). HEADROOM is a separate ceiling and this does not lift it: the age-5 lintel sits at
   8.10 and the age-4 vault at 8.00, so a Catapult (9.26 tall) and a Trebuchet (16.83) still do not
   pass under any gate in the game. Infantry (5.43), cavalry (5.49), Ox Carts (6.18), Cannon (8.29)
   and Culverins (8.27) all clear. gatefit.js reports headroom next to width now so that is a
   decision with a number on it rather than a surprise — raising it means every gate silhouette
   grows, and the age-5 rampart gate is deliberately the low one.                                  */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("03-buildings.js").indexOf("rotation.y=s*1.45")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- 1. the doors swung inward -------------------------------------------------------------------
sub("03-buildings.js",
`        hinge.rotation.y=s*1.92;              // ~110 deg: folded back along the reveal, not flat`,
`        // v132.16 83 DEGREES, NOT 110. A leaf hangs off its hinge along local +x, and rotation.y
        // maps that to (cos t, -sin t): at 1.92 the cosine is NEGATIVE, so the far end swings back
        // ACROSS the gateway — hinged at 4.0 it landed at 2.83 and took 2.5 off the passage. Doors
        // that open inward are still doors in the way. At 1.45 the far end is at 4.41, outboard of
        // its own hinge, and the leaf lies along the reveal where an opened door belongs.
        hinge.rotation.y=s*1.45;              // 83 deg: laid back along the reveal, clear of it`,
  "03-buildings.js: the leaves open outward instead of into the gateway");

// ---- 2. the Classical arch ------------------------------------------------------------------------
sub("03-buildings.js",
`      {const arch=cyl(GATE_PASS/2,GATE_PASS/2,0.5,P.dark,14); arch.rotation.x=Math.PI/2;
       arch.castShadow=false; arch.position.set(0,4.4,1.15); g.add(arch);
       const jamb=box(GATE_PASS,4.4,0.4,P.dark); jamb.castShadow=false;
       jamb.position.set(0,2.2,1.15); g.add(jamb);}`,
`      // v132.16 THE REVEAL GOES ROUND THE OPENING, NOT ACROSS IT. v132.15 replaced the two 3.0-wide
      // jambs with ONE GATE_PASS-wide slab and re-sealed the gate at 0.88 — the dark panel that is
      // supposed to read as the inside of an arch was drawn over the whole doorway. Two narrow
      // jambs at the passage edges and a head band above it frame the opening and stand outside it.
      for(const s of [-1,1]){const jb=box(0.6,6.2,0.4,P.dark); jb.castShadow=false;
        jb.position.set(s*(GATE_PASS/2+0.3),3.1,1.15); g.add(jb);}
      {const hd=box(GATE_PASS+1.2,0.8,0.4,P.dark); hd.castShadow=false;
       hd.position.set(0,6.6,1.15); g.add(hd);}`,
  "03-buildings.js: the Classical reveal frames the opening instead of filling it");

// ---- 3. the age-5 head disc, and the vault that floored the passage ---------------------------------
sub("03-buildings.js",
`      const head=cyl(PGAP/2,PGAP/2,0.5,_dk(P.stone,0.22),12); head.rotation.x=Math.PI/2;
      head.castShadow=false; head.position.set(0,GH-1.3,0.1); g.add(head);`,
`      // v132.16 A BAND, NOT A DISC. This was a cylinder of radius PGAP/2 laid face-on: at PGAP 3.4
      // it spanned y 6.4..8.1 and nobody noticed, and at 7.8 it spans 4.2..12.0 and seals the
      // gateway from chest height up. Any decoration whose SIZE is tied to the passage will
      // eventually grow across the passage; a band cannot.
      const head=box(PGAP+0.6,0.7,0.5,_dk(P.stone,0.22)); head.castShadow=false;
      head.position.set(0,GH-1.75,0.1); g.add(head);`,
  "03-buildings.js: the age-5 reveal head becomes a band above the opening");

sub("03-buildings.js",
`      // AND IT BRIDGES THE PASSAGE. wallFloorAt returns one deck height across a segment's whole
      // width, so leaving the gateway open at deck level would walk the player over the opening on
      // nothing. A gate passage is VAULTED and the rampart walk runs across the top of it — that is
      // what a gatehouse is — so the vault is both the honest architecture and the floor.
      const vault=box(PGAP+0.4,0.6,4.4,0x8a7a58); vault.castShadow=false;
      vault.position.set(0,3.7,-1.2); g.add(vault);
      const soff=box(PGAP+0.4,0.3,4.4,_dk(P.stone,0.26)); soff.castShadow=false;
      soff.position.set(0,3.25,-1.2); g.add(soff);           // the vault's underside, seen from below`,
`      // v132.16 AND IT NO LONGER BRIDGES THE PASSAGE. v131.28 floored the gateway at deck height —
      // a 0.6 slab at y=3.7 — for a stated reason: "leaving the gateway open at deck level would
      // walk the player over the opening on nothing." The premise was that you can walk over a
      // gate, and that premise is John's other bug: "it is treating the gate as another mountable
      // wall so you have this weird condition where units CLIMB OVER the gate to get through it."
      // A gate is the way THROUGH a wall. wallFloorAt returns null for gates now, nothing walks
      // over the passage, and so nothing has to floor it — which also gives the passage back the
      // 5 units of headroom that slab was taking. One fix, both bugs.
      // The flanking stubs above stay: the curtain's walk runs up to the gatehouse and stops there,
      // which is what a walk meeting a tower has always done.`,
  "03-buildings.js: the passage stops being floored at deck height");

// ---- 4. …which is only true if a gate is not walkable ------------------------------------------------
sub("03-buildings.js",
`    if(a<5)continue;                                  // only the star-fort curtain carries a deck`,
`    if(a<5)continue;                                  // only the star-fort curtain carries a deck
    // v132.16 AND A GATE IS NOT A PIECE OF WALL YOU WALK OVER. John: "it is treating the gate as
    // another mountable wall so you have this weird condition where units CLIMB OVER the gate to
    // get through it." v131.28 exempted the RAMP from gates and left the DECK, so a gate still
    // reported a floor at 4.00 across its whole width — including over the gateway, which then had
    // to be bricked up at deck height to stand on, which is what made the passage 3.1 tall.
    // A gate is the way THROUGH a wall. It has no deck, and its model no longer draws one.
    if(b.def.gate)continue;`,
  "03-buildings.js: gates are not walkable — the gateway is the way through");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
