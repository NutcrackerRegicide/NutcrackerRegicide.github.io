#!/usr/bin/env node
/* v132.15 — EVERY GATE IN THE GAME WAS SHUT
   -----------------------------------------
   node tools/patch-gatewidth.js        (idempotent: re-running reports NOTHING WRITTEN)

   John: "gate needs to be large enough for the largest units to walk through it (oxcarts,
   trebuchets, cannons, etc)."

   tools/gatefit.js put a ruler across all nine gate forms and a caliper across every unit. Two
   findings, and the second one is not what anybody was looking for.

   ================================ 1. NOTHING FITS ================================
   Width at pier height, which is the number that matters — not a bounding box, because a trebuchet
   is 16.8 tall and most of that is an arm in the air:

       Catapult 6.53 · Trebuchet 6.53 · Battering Ram 5.86 · Cannon 5.56 · Culverin 5.14
       Ox Cart 4.32 · a man 2.47

   Against clear passages of 3.4 at age 5 and 1.6 at the Classical stone gate. The age-5 gate was
   barely wider than one soldier; the Classical one was NARROWER THAN A VILLAGER.

   WHY NO TEST EVER CAUGHT IT: moveUnit treats every unit as a POINT inflated by 0.7 and reads no
   unit class anywhere in the collision path. The simulation thinks a trebuchet is exactly as wide
   as a villager, so the passage only exists in the frame. A gate can be sealed and still "work".

   ================================ 2. AND THE DOORS WERE CLOSED ================================
   The first sweep sampled three depths and reported the wood gate at a comfortable 8.0. A gate's
   narrowest point is almost always a THIN thing at ONE depth, and sampling at 0.2 found it:

       wood_gate  a2-a5   0.20      the oak leaves: 2.9 wide at x = +-1.55, so +-(0.1 .. 3.0)
       stone_gate a3      1.60      the twin passage jambs: 3.0 wide at x = +-2.3
       fort/stone a4      3.39
       fort/stone a5      0.23      the leaves: 1.6 wide at +-0.9, "ajar" by a 0.22 rad yaw that
                                    angles them without opening them

   EVERY GATE IN THE GAME IS SHUT. Units have been walking through solid oak at every age since the
   gates were built, and the v131.25 note in the age-5 branch — John's "gate solid and visually
   looks like you should not be able to pass through it" — was the same defect seen from the front
   and fixed only as far as the reveal.

   ================================ WHAT THIS DOES ================================
   John's ruling: one wide portal, same footprint. GATE_PASS = 7.8 (catapult 6.53 + 1.27), ONE
   constant in 00-data.js, read by all four model branches AND by the collider — because a passage
   width typed twice is the exact species of bug this project keeps paying for.

     WOOD a2-a5   the towers already stand 8.0 apart, so the mesh was right and the doors were not:
                  the leaves now SWING OPEN on hinges at the tower faces and lie back along the
                  passage. The a2 inturned killing corridor moves from +-3.2 to +-4.7 (it was the
                  5.0 pinch behind the doors).
     STONE a3     the twin passage becomes ONE arch — the two jambs are what made 1.6 — and the
                  Porta Nigra's drums slim from 2.5/2.7 to 2.0/2.2 and step out to +-6.0, which
                  buys the passage without making the gate wider overall than it already was.
     FORT a4      same move on the twin drums (2.6/3.0 -> 2.2/2.5, +-5.0 -> +-6.4), and the
                  portcullis grooves, bars, vault and drawbridge all widen with the passage instead
                  of staying where they were and re-sealing it.
     FORT a5      PGAP 3.4 -> GATE_PASS with the piers slimmed 2.5 -> 2.2 so the lintel still spans
                  inside the 12.5 wall segment, and its leaves swing open too.

   THE DOORS ARE OPENED, NOT DELETED. A gateway with no leaves reads as a hole in a wall; a gateway
   with leaves folded back against the reveal reads as a gate somebody opened, which is the whole
   point — and it keeps §F.3/F.5's ironwork on the model where the art direction wants it.

   NOTHING ABOUT WALL PLACEMENT MOVES. Gates already stand wider than a 12.5 curtain segment (the
   a3 drums reach 7.7 and the a4 drums 8.0), so this changes no snapping, no chaining and not the
   wall collider's half-length. Only the age-5 gate is genuinely boxed in by the rampart it splits,
   and that is why its piers slim rather than step out.                                           */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("00-data.js").indexOf("GATE_PASS")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ================================ THE ONE CONSTANT ================================
sub("00-data.js",
`BLD.wood_gate={name:"Wood Gate",hp:560,r:5.8,cost:{wood:85},hits:7,wall:true,gate:true};`,
`// v132.15 THE CLEAR PASSAGE EVERY GATE MUST LEAVE, in one place, read by all four model branches
// in 03-buildings.js AND by _gatePassHX in 05-combat.js. Measured, not chosen: tools/gatefit.js
// puts a caliper across every unit at PIER HEIGHT (a bounding box is not what passes a doorway —
// a trebuchet is 16.8 tall and most of that is an arm in the air) and the widest thing that has to
// walk through a gate is a catapult at 6.53, with a trebuchet equal to it. 7.8 leaves 1.27.
// IT HAS TO BE ONE NUMBER. The passage governs the piers, the lintel span, the vault, the
// portcullis grooves, the drawbridge, the rampart split and the collider's own half-width; typed
// twice it goes stale in one of them and the gate seals itself somewhere nobody is looking. That
// is not hypothetical — it is what shipped: 3.4 in the model, 3.4 re-typed in the collider, and
// door leaves nobody had measured leaving 0.23 between them.
const GATE_PASS=7.8;
BLD.wood_gate={name:"Wood Gate",hp:560,r:5.8,cost:{wood:85},hits:7,wall:true,gate:true};`,
  "00-data.js: GATE_PASS — one number for the passage");

// ================================ THE DOORS OPEN ================================
sub("03-buildings.js",
`  }else if(type==="wood_gate"||type==="stone_gate"||type==="fort_gate"){`,
`  }else if(type==="wood_gate"||type==="stone_gate"||type==="fort_gate"){
    // v132.15 A DOOR THAT IS OPEN, WHICH NONE OF THEM WERE. Every gate in the game drew its leaves
    // shut across the passage — 0.20 clear on the wood gate, 0.23 at age 5 — and units walked
    // through solid oak at every age. A leaf is hinged at the JAMB and swings back into the
    // passage: the group's origin is the hinge, the leaf hangs off it by half its own width, and
    // the group turns. Opened rather than deleted, because a gateway with no leaves is a hole in a
    // wall while a gateway with its leaves folded back is a gate somebody opened — and it keeps
    // the ironwork on the model where §F.3 and §F.5 want it.
    const _gateLeaves=(grp,hingeX,z,lw,lh,th,mat,strapMat)=>{
      for(const s of [-1,1]){
        const hinge=new THREE.Group();
        hinge.position.set(s*hingeX,0,z);
        hinge.rotation.y=s*1.92;              // ~110 deg: folded back along the reveal, not flat
        const leaf=box(lw,lh,th,mat); leaf.castShadow=false;
        leaf.position.set(s*lw/2,lh/2,0); hinge.add(leaf);
        if(strapMat!==undefined)for(const by of [0.3,0.66]){
          const st=box(lw,0.2,th*0.45,strapMat); st.castShadow=false;
          st.position.set(s*lw/2,lh*by,th*0.8); hinge.add(st);
        }
        grp.add(hinge);
      }
    };`,
  "03-buildings.js: _gateLeaves — leaves hinged at the jamb, swung back");

// ---- WOOD: the towers were already 8.0 apart; the doors were the gate --------------------------
sub("03-buildings.js",
`      for(const s of [-1,1]){ // the oak leaves with their iron strapping and drawbar
        const leaf=box(2.9,h-2.6,0.24,0x5A4630); leaf.castShadow=false; leaf.position.set(s*1.55,(h-2.6)/2,0.9); g.add(leaf);
        for(const by of [0.3,0.66]){const st=box(2.9,0.2,0.1,STONEDK); st.castShadow=false;
          st.position.set(s*1.55,(h-2.6)*by,1.05); g.add(st);}
      }`,
`      // v132.15 THE OAK LEAVES, OPEN. They were 2.9 wide at x = +-1.55, i.e. spanning +-(0.1..3.0)
      // across an opening the towers leave 8.0 wide — 0.20 of daylight, and every unit in the game
      // walked through them. Hinged at the tower faces (+-4.0) and swung back, the mesh finally
      // says what the collider always did.
      _gateLeaves(g,4.0,0.9,3.4,h-2.6,0.24,0x5A4630,STONEDK);`,
  "03-buildings.js: the wood gate's oak leaves swing open");

sub("03-buildings.js",
`      if(age<=2){ // the inturned entrance: the passage walls fold back into a killing corridor
        for(const s of [-1,1]){const inw=new THREE.Mesh(new THREE.BoxGeometry(1.4,h-1.4,4.6),tim);
          inw.position.set(s*3.2,(h-1.4)/2,-3.2); inw.castShadow=true; g.add(inw);}
      }`,
`      if(age<=2){ // the inturned entrance: the passage walls fold back into a killing corridor
        // v132.15 …AT +-4.7, NOT +-3.2. At 3.2 with a 1.4 width they spanned +-(2.5..3.9) and
        // pinched the passage to 5.0 behind the doors — the corridor was narrower than the gate it
        // defends, which is a killing corridor for your own siege train. Aligned with the towers'
        // inner faces so the passage is one width from front to back.
        for(const s of [-1,1]){const inw=new THREE.Mesh(new THREE.BoxGeometry(1.4,h-1.4,4.6),tim);
          inw.position.set(s*4.7,(h-1.4)/2,-3.2); inw.castShadow=true; g.add(inw);}
      }`,
  "03-buildings.js: the Iron-age killing corridor stops strangling the gate");

// ---- STONE a3: the twin passage becomes one arch ------------------------------------------------
sub("03-buildings.js",
`      for(const px of [-5.2,5.2]){
        const t=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.7,h,9,1,false,Math.PI*0.5,Math.PI*1.5),wmat);`,
`      // v132.15 THE DRUMS SLIM AND STEP OUT. 2.5/2.7 at +-5.2 left inner faces at +-2.5 and a 5.0
      // passage before the jambs below cut it to 1.6. 2.0/2.2 at +-6.0 leaves +-4.0 — GATE_PASS
      // with room — and the gate ends up 16.4 overall against the 15.4 it already was, so nothing
      // about how a gate sits in a wall line changes.
      for(const px of [-6.0,6.0]){
        const t=new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.2,h,9,1,false,Math.PI*0.5,Math.PI*1.5),wmat);`,
  "03-buildings.js: the Porta Nigra's drums slim and step out");

sub("03-buildings.js",
`      const lintel=new THREE.Mesh(new THREE.BoxGeometry(11,2.0,2.4),wmat);
      lintel.position.y=h-1.0; lintel.castShadow=true; g.add(lintel);
      for(const s of [-1,1]){ // the DOUBLE passage — two arches, not one, and the courtyard between
        const arch=cyl(1.5,1.5,0.5,P.dark,10); arch.rotation.x=Math.PI/2; arch.castShadow=false;
        arch.position.set(s*2.3,4.4,1.15); g.add(arch);
        const jamb=box(3.0,4.4,0.4,P.dark); jamb.castShadow=false; jamb.position.set(s*2.3,2.2,1.15); g.add(jamb);
      }`,
`      const lintel=new THREE.Mesh(new THREE.BoxGeometry(12.4,2.0,2.4),wmat);
      lintel.position.y=h-1.0; lintel.castShadow=true; g.add(lintel);
      // v132.15 ONE ARCH, NOT TWO. §F.4's "double passage" is the historically right note and it is
      // what sealed this gate: two jambs 3.0 wide at x = +-2.3 span +-(0.8..3.8), leaving 1.6 down
      // the middle — narrower than a VILLAGER at 2.30, let alone the catapult at 6.53 the owner
      // asked to get through. Twin passages cannot be widened without pushing the drums past the
      // curtain, so the Classical gate keeps its round towers, its banding and its rustication —
      // the things §F.4 calls its identity — and gives up the pair of arches.
      {const arch=cyl(GATE_PASS/2,GATE_PASS/2,0.5,P.dark,14); arch.rotation.x=Math.PI/2;
       arch.castShadow=false; arch.position.set(0,4.4,1.15); g.add(arch);
       const jamb=box(GATE_PASS,4.4,0.4,P.dark); jamb.castShadow=false;
       jamb.position.set(0,2.2,1.15); g.add(jamb);}`,
  "03-buildings.js: the Classical gate's twin passage becomes one wide arch");

// ---- FORT a4: the twin-towered gatehouse ---------------------------------------------------------
sub("03-buildings.js",
`      for(const px of [-5.0,5.0]){
        const t=new THREE.Mesh(new THREE.CylinderGeometry(2.6,3.0,h,10),wmat);
        t.position.set(px,h/2,0.8); t.castShadow=true; t.receiveShadow=true; g.add(t);
        for(let i=0;i<7;i++){const a=i*Math.PI/3.4-0.6;
          const mer=box(1.1,1.2,1.0,P.stone); mer.castShadow=false;
          mer.position.set(px+Math.sin(a)*2.7,h+0.6,0.8+Math.cos(a)*2.7); mer.rotation.y=-a; g.add(mer);}`,
`      // v132.15 THE DRUMS SLIM AND STEP OUT, same move as the Classical gate one rung down. 2.6/3.0
      // at +-5.0 put the inner faces at +-2.0 — a 4.0 passage on the rung §F.5 calls the strongest
      // part of a castle, and the one an army's siege train has to leave through. 2.2/2.5 at +-6.4
      // leaves +-3.9, and the gate is 17.8 overall against 16.0, so it still sits in a wall line
      // the way it always did.
      for(const px of [-6.4,6.4]){
        const t=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.5,h,10),wmat);
        t.position.set(px,h/2,0.8); t.castShadow=true; t.receiveShadow=true; g.add(t);
        for(let i=0;i<7;i++){const a=i*Math.PI/3.4-0.6;
          const mer=box(1.1,1.2,1.0,P.stone); mer.castShadow=false;
          mer.position.set(px+Math.sin(a)*2.3,h+0.6,0.8+Math.cos(a)*2.3); mer.rotation.y=-a; g.add(mer);}`,
  "03-buildings.js: the Medieval gatehouse's drums slim and step out");

sub("03-buildings.js",
`      const vault=new THREE.Mesh(new THREE.BoxGeometry(10.4,2.4,3.2),wmat);
      vault.position.y=h-1.2; vault.castShadow=true; g.add(vault);
      for(let i=0;i<4;i++){const mh=box(0.4,0.3,0.4,P.dark); mh.castShadow=false;
        mh.position.set(-1.8+i*1.2,h-2.35,0.6); g.add(mh);}          // MURDER HOLES in the vault
      for(const s of [-1,1]){const grv=box(0.34,h-2.4,0.5,_dk(P.stone,0.2)); grv.castShadow=false;
        grv.position.set(s*2.6,(h-2.4)/2,1.55); g.add(grv);}          // the portcullis grooves
      for(let i=0;i<9;i++){const bar=box(0.22,3.0,0.16,STONEDK); bar.castShadow=false;
        bar.position.set(-2.4+i*0.6,h-3.6,1.5); g.add(bar);}          // the raised portcullis`,
`      const vault=new THREE.Mesh(new THREE.BoxGeometry(13.2,2.4,3.2),wmat);
      vault.position.y=h-1.2; vault.castShadow=true; g.add(vault);
      for(let i=0;i<4;i++){const mh=box(0.4,0.3,0.4,P.dark); mh.castShadow=false;
        mh.position.set(-1.8+i*1.2,h-2.35,0.6); g.add(mh);}          // MURDER HOLES in the vault
      // v132.15 THE GROOVES, THE BARS AND THE VAULT ALL MOVE WITH THE PASSAGE. Widening the drums
      // and leaving these where they were would have re-sealed the gate 0.6 further in — the
      // grooves alone stood at +-2.6 and left 4.86. Every one of them is written off GATE_PASS now,
      // so the next time it moves they follow instead of quietly strangling the opening again.
      for(const s of [-1,1]){const grv=box(0.34,h-2.4,0.5,_dk(P.stone,0.2)); grv.castShadow=false;
        grv.position.set(s*(GATE_PASS/2+0.17),(h-2.4)/2,1.55); g.add(grv);}   // the portcullis grooves
      // …AND THE RAISED PORTCULLIS RIDES HIGHER. Its bars hung with their bottoms at 5.30 against
      // a body 5.43 tall: raised, and still decapitating the infantry. h-2.4 puts them at 6.50.
      {const NB=13, sp=GATE_PASS/(NB-1);
       for(let i=0;i<NB;i++){const bar=box(0.22,3.0,0.16,STONEDK); bar.castShadow=false;
         bar.position.set(-GATE_PASS/2+i*sp,h-2.4,1.5); g.add(bar);}}        // the raised portcullis`,
  "03-buildings.js: the vault, grooves and portcullis widen with the passage");

sub("03-buildings.js",
`      const draw=box(3.6,0.34,4.8,0x5A4630); draw.castShadow=false;
      draw.position.set(0,0.17,4.20); g.add(draw);`,
`      const draw=box(GATE_PASS,0.34,4.8,0x5A4630); draw.castShadow=false;
      draw.position.set(0,0.17,4.20); g.add(draw);`,
  "03-buildings.js: the drawbridge is as wide as the gate it serves");

sub("03-buildings.js",
`      for(const s of [-1,1]){const ch=cyl(0.07,0.07,9.15,STONEDK,4); ch.rotation.x=-0.5783; ch.castShadow=false;
        ch.position.set(s*1.7,4.17,4.10); g.add(ch);}                 // the chains`,
`      for(const s of [-1,1]){const ch=cyl(0.07,0.07,9.15,STONEDK,4); ch.rotation.x=-0.5783; ch.castShadow=false;
        ch.position.set(s*(GATE_PASS/2-0.1),4.17,4.10); g.add(ch);}   // the chains, on the leaf's edges`,
  "03-buildings.js: the chains follow the drawbridge's edges");

// ---- FORT a5: the rusticated portal --------------------------------------------------------------
sub("03-buildings.js",
`      const GH=9.4, PW=2.5, PGAP=3.4;            // gatehouse height, pier width, clear passage`,
`      // v132.15 PGAP IS GATE_PASS NOW, and the piers slim from 2.5 to 2.2 to pay for it: the
      // lintel spans PGAP + 2*PW + 0.4, which at 7.8 and 2.2 is 12.6 against the 12.5 curtain
      // segment this gate splits. This is the ONE gate genuinely boxed in — the others simply
      // stepped their drums outward, because a gatehouse already stands wider than a curtain.
      const GH=9.4, PW=2.2, PGAP=GATE_PASS;      // gatehouse height, pier width, clear passage`,
  "03-buildings.js: the age-5 portal opens to GATE_PASS on slimmer piers");

sub("03-buildings.js",
`      // the leaves, SET BACK 1.5 into the reveal and left ajar, which is what says "this opens"
      for(const s of [-1,1]){
        const leaf=box(PGAP/2-0.1,GH-2.6,0.22,P.dark); leaf.castShadow=false;
        leaf.position.set(s*(PGAP/4+0.05),(GH-2.6)/2,-0.55); leaf.rotation.y=s*0.22; g.add(leaf);
      }`,
`      // v132.15 THE LEAVES, ACTUALLY OPEN. "Left ajar" was a 0.22 rad YAW on a pair of leaves that
      // still met in the middle — it angled them without opening them, and the measured daylight
      // between them was 0.23. v131.25 fixed "the gate looks solid" as far as the reveal and this
      // is the rest of that same defect. Hinged at the jambs and folded back, like every other gate.
      _gateLeaves(g,PGAP/2,-0.55,PGAP/2-0.1,GH-2.6,0.22,P.dark);`,
  "03-buildings.js: the age-5 leaves swing open instead of merely leaning");

// ================================ THE COLLIDER READS THE SAME NUMBER ================================
sub("05-combat.js",
`  if(a>=5&&(b.type==="fort_gate"||b.type==="stone_gate"))return 3.4/2-0.7;
  return null;`,
`  // v132.15 GATE_PASS, NOT A SECOND COPY OF IT. This read 3.4 — the model's passage, re-typed here
  // — which is the same species of drift as the hand-copied road spine and the hand-typed bazaar
  // flats. Now that all four model branches leave the same opening, every gate that HAS a measured
  // passage gets one, not just age 5.
  if(a>=3&&(b.type==="fort_gate"||b.type==="stone_gate"))return GATE_PASS/2-0.7;
  if(a>=2&&b.type==="wood_gate")return GATE_PASS/2-0.7;
  return null;`,
  "05-combat.js: the collider's passage is GATE_PASS, and every gate has one");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
