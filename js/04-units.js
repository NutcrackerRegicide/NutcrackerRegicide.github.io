/* REGICIDE PVP — 04-units.js */
// ---------- units ----------
let UID=0;

// small helper: a limb group pivoted at its top (shoulder/hip), mesh hanging below
function limb(w,h,d,c,px,py,pz){ // tapered organic limb, pivoted at the top joint
  const g=new THREE.Group(); g.position.set(px,py,pz);
  const mtl=(c&&c.isMaterial)?c:mat(c);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(w*0.62,w*0.42,h,7),mtl);
  m.position.y=-h/2; m.castShadow=false; g.add(m);
  return g;
}
function endCap(parent,r,mtl,y){ // hand / hoof at a limb's end
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,6,5),mtl);
  m.position.y=y; m.castShadow=false; parent.add(m); return m;
}
// v130.2 `mtlLow` — the limb may be two materials. A coat has SLEEVES: on the hide ages the upper
// arm is the coat and the forearm is a bracer, which is both the correct read and where the last
// few points of §2.5's team budget come from. Optional, so every existing call (all four legs and
// every dressed arm) is byte-identical; it does not cost a draw call either, because a merged
// cluster's parts all resolve through the one UATLAS material anyway.
function limb2(rT,rM,rB,hU,hL,mtl,px,py,pz,mtlLow){ // articulated: upper pivots at joint, lower at elbow/knee
  const lo=mtlLow||mtl;
  const upper=new THREE.Group(); upper.position.set(px,py,pz);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(rT*1.02,7,6),mtl);
  cap.castShadow=false; upper.add(cap); // rounded top: the limb flows out of the body
  const um=new THREE.Mesh(new THREE.CylinderGeometry(rT,rM,hU,7),mtl);
  um.position.y=-hU/2; um.castShadow=false; upper.add(um);
  const lower=new THREE.Group(); lower.position.y=-hU;
  const joint=new THREE.Mesh(new THREE.SphereGeometry(rM*1.06,6,5),lo);
  joint.castShadow=false; lower.add(joint);
  const lm=new THREE.Mesh(new THREE.CylinderGeometry(rM*0.95,rB,hL,7),lo);
  lm.position.y=-hL/2; lm.castShadow=false; lower.add(lm);
  upper.add(lower);
  return {upper,lower};
}

const _noSh=m=>{m.castShadow=false;return m;};
// v113 THE OX CART's size lives HERE, as one number. The rig is modelled at 1:1 and hung off a
// single scaled group, so this scales the beast, the wain, the load, the wheel roll rate AND the
// health-bar / name-tag heights together. (Shipped at 2.5 first; John called it down to 1.7.)
const OXSCALE=1.7;
const OX_BAR_Y=()=>2.9*OXSCALE+1.0;  // just clear of the banner top
const OX_TAG_Y=()=>OX_BAR_Y()+0.9;
function wheelGroup(r,w,color,spokes){ // axle along X; spin the returned group about X
  const G=new THREE.Group();
  const rimGeo=new THREE.CylinderGeometry(r,r,w,10,1,true); rimGeo.rotateZ(Math.PI/2);
  const rim=new THREE.Mesh(rimGeo,texturedMat("wood",color)); rim.castShadow=false; G.add(rim);
  const tyreGeo=new THREE.TorusGeometry(r,w*0.42,5,12); tyreGeo.rotateY(Math.PI/2);
  const tyre=new THREE.Mesh(tyreGeo,plainMat(0x3a3a42)); tyre.castShadow=false; G.add(tyre); // iron tyre
  const hubGeo=new THREE.CylinderGeometry(r*0.24,r*0.24,w*1.5,7); hubGeo.rotateZ(Math.PI/2);
  const hub=new THREE.Mesh(hubGeo,plainMat(0x4a3826)); hub.castShadow=false; G.add(hub);
  // §E: the ox cart's wheels are SOLID DISCS with three cleats — the earliest and most timeless
  // cart wheel, and deliberately not spoked, because "two oxen and solid disc wheels" is the whole
  // 40px read and it is the only unspoked wheel on the map. Pass spokes = 0 for it.
  const n=spokes===undefined?6:spokes;
  if(n===0){
    const dGeo=new THREE.CylinderGeometry(r*0.97,r*0.97,w*0.72,12); dGeo.rotateZ(Math.PI/2);
    const disc=new THREE.Mesh(dGeo,texturedMat("wood",color)); disc.castShadow=false; G.add(disc);
    for(let i=0;i<3;i++){
      const cl=new THREE.Mesh(new THREE.BoxGeometry(w*0.62,r*1.72,r*0.17),plainMat(0x8A6B45));
      cl.rotation.x=i*Math.PI/3; cl.castShadow=false; G.add(cl);
    }
  }else for(let i=0;i<n;i++){
    const sp=new THREE.Mesh(new THREE.BoxGeometry(w*0.5,r*1.86,r*0.14),texturedMat("wood",color));
    sp.rotation.x=i*Math.PI/n; sp.castShadow=false; G.add(sp);
  }
  G.userData.rr=2.75/r; // roll rate scales with radius (halved: stately, not frantic)
  return G;
}
// ==================== v130 U1: THE NUTCRACKER ====================
// The figure's proportions, as five numbers the whole file agrees on (AD §6.1a).
//
// ⚠ THE HEAD IS SUPPOSED TO BE THIS BIG. DO NOT SHRINK IT.
// The line that used to sit here shrank NC_HEADR to 0.39 because it measured
// torsoWidth/headWidth = 0.90 and called the unit a bobblehead, citing §5.3a. The owner reversed
// that personally and §6.1a is the amendment: an Erzgebirge nutcracker IS a head with a barrel
// under it, and the oversized head is the single most recognisable thing about the object. Shrink
// it toward human proportion and what comes out is a tin soldier — a different toy. §6.1a
// overrides §5.3a and, in its own words, "any contrary reasoning in code comments".
//
// The trap is that a big head on a small body is exactly what a trained eye corrects, because in a
// HUMAN figure it is an error, so this gets "discovered" and fixed about once per pass. It is the
// brief, not a bug. What the numbers below buy, measured on the render:
//   head 1.10 across the ears / torso 1.04            = 1.06   §6.1a wants 1.00–1.15, never under 1.00
//   chin at 2.01, hat crown at 3.81, sole at -0.03    = 0.47   §6.1a wants 0.46–0.54 above the shoulders
//   hip 0.95, sole -0.03, over H = 3.84               = 0.26   STUMPY: §6.1a caps legs+boots at 0.26
// The figure's height comes out of the HAT. If lengthening the legs or the torso ever looks like
// the answer to a proportion problem here, the answer is wrong — §6.1a says so in as many words.
const NC_HEADR=0.58;               // lathe circumradius; the silhouette is 1.902 R = 1.10 across the ears
// AD §6.5: a villager's jacket carries the team hue at 0.75 SATURATION — dyed working cloth, not
// livery, so a field of villagers never competes with the soldiers standing in it. Memoised per
// team on purpose: texturedMat keys _skinCache on the hex, and computing the same colour twice with
// float HSL round-trips could hand it two hexes one byte apart and mint two atlas cells for one
// jacket (§10.6 — the atlas is at ~103 of ~130 and every distinct hex costs a cell).
const _TEAM_JERKIN=[];
function teamJerkin(team){
  if(_TEAM_JERKIN[team]===undefined){
    const c=new THREE.Color(TEAMCOL[team]), h={};
    c.getHSL(h); c.setHSL(h.h,h.s*0.75,h.l);
    _TEAM_JERKIN[team]=c.getHex();
  }
  return _TEAM_JERKIN[team];
}
const NC_HEADH=0.95;               // 0.25 H — head incl. jaw, inside §6.1a's 0.22–0.26
const NC_HATY=NC_HEADH-0.09;       // where EVERY hat seats: sunk into the crown so no scalp shows.
// Hat furniture — crests, combs, nasals, dress cords — is placed as NC_HATY + its own offset, not
// as a bare number. The head has now moved twice; both times the crests were the parts left behind.
const NC_HIPY=0.95;                // foot-unit hip = 0.25 H. §6.1a: the figure is STUMPY.
// thigh, shin. They add up to NC_HIPY plus the boot's own depth, and the SUM is the load-bearing
// number — the foot hangs off the shin's length, so 0.56+0.36 puts the sole at exactly the -0.03
// that 0.50+0.42 did. What moves is the KNEE, and with it the trouser/boot split: the whole shin
// is boot on a soldier, so where the knee sits IS where §6.2's white band stops. At 0.50/0.42 the
// band measured 15px of a 236px figure = 0.064 H, under §5.2's 0.075 feature floor and 2.5 rows of
// the 40 the ladder is scored on; at 0.56/0.36 it is 0.128 H and the boot is still 0.109 H, both
// inside §5.3's 0.16 legs / 0.12 boots with the hat taking the rest (§6.1a).
const NC_LEGU=0.56, NC_LEGL=0.36;
const NC_HATSC=NC_HEADR/0.58;      // 1.00 — see R.hat below
// v130.6 THE §2.6 HEXES ARE AUTHORED, NOT RENDERED, AND THE TWO ARE NOT THE SAME NUMBER.
// Three rounds have now reported the beard and the face as "off spec" by eyedroppering the frame
// and comparing against §2.6, and three rounds have tried to fix it by arguing with the hex. The
// hex was never wrong: what the frame does to it is a fixed gain, and the fix is to author the
// value that comes OUT the far end — the same correction js/02-world.js:1329 applies to the road,
// for the same reason and with the same honesty about it.
// MEASURED, by rendering a sheet of known plainMat quads at known pitches through the shipped rig
// (toon ramp x sun 1.55 x hemi 0.45 x exposure 0.60 x the grade pass) and eyedroppering the result:
//   ramp LIT cell  (dotNL > 0.52)   out = in x (1.046, 1.038, 0.990)   — a surface tilted INTO the sun
//   ramp MID cell  (0.18 … 0.52)    out = in x (0.849, 0.848, 0.801)   — anything standing vertical
// Two cells and not one because the nutcracker's two big painted masses live in different ones and
// always will: a vertical head facet is dotNL 0.361 and the beard's raked front face is 0.65, so
// one hex divided by one gain can only ever be right for one of them.
// The clamp is not a rounding guard, it is the ceiling of the whole exercise: nothing authored can
// render brighter than white x the cell, so a §2.6 hex whose target exceeds 255 after division is
// simply not reachable on that facet and the channel comes up short. Say so rather than pretending.
function ncGain(hex,g){
  const c=new THREE.Color(hex), q=v=>Math.min(255,Math.round(v*255));
  return (q(c.r/g[0])<<16)|(q(c.g/g[1])<<8)|q(c.b/g[2]);
}
const NC_LITG=[1.046,1.038,0.990], NC_MIDG=[0.849,0.848,0.801];
// >>> §A.2's LADDER IS A MEASUREMENT OF THE RENDER. AGEPAL IS AUTHORED. THEY ARE 15% APART. <<<
// Every crown solid and every torso shell in this file is a near-vertical lathe wall — dotNL in
// the 0.18-0.52 band — which is the toon ramp's MID cell, which is a flat x0.849 on the way out.
// So age4.crown #6E6A62, §A.3's own hex at V 0.417, RENDERS at 0.314; age2.dominant #6E767E at
// 0.458 renders 0.393. The whole six-rung ladder is pushed down 15% from underneath while its top
// two rungs cannot move at all, because §G.6's bloom cliff caps a large flat surface at 0.806 of
// AUTHORED luma. That is most of why §H A1 and §H A2 come back with six ages piled between 0.28
// and 0.60 on a design that spans 0.127 to 0.812, and no amount of choosing different hexes out of
// §A.3 fixes it — the hexes are right and the pipeline is eating them.
// ncHeadMat authors nc.face through this same inverse and has done since v130.6, for exactly this
// reason, and says so at length. This is that correction applied to the two GATED age roles.
// >>> IT CLAMPS, AND THE CLAMP IS THE POINT. <<< A hex whose inverse would land above 0.79 of
// authored luma is returned UNCHANGED rather than pushed onto the 0.86 high pass. The beard's
// ~6,900 clipped pixels per figure on 136 bodies came from exactly this trade being taken the
// other way (§G.6), so Bronze and Classical — the two rungs that would most like the lift — do
// not get one, and the ladder's top stays compressed. That is a pipeline limit, not a colour
// choice, and it is reported as one rather than hidden.
// AGEPAL ITSELF IS NOT MUTATED: js/03-buildings.js reads the same table and a wall is not a lathe.
// >>> v131.5 THE CLAMP RETURNED THE RAW HEX, AND THAT IS WHAT WAS BROWNING THREE AGES. <<<
// MEASURED, per age, over §H A2's own crop with the face flagged out of it (tools/_agedump.js):
//     Stone  #775D3D V 0.377 (§A.3 0.374)   Iron #747474 V 0.455 (0.458)   — the two the inverse
//                                                                            is APPLIED to, dead on
//     Bronze #AD9A71 V 0.608 (0.789)        Classical #918A79 V 0.541 (0.727) — the two it SKIPS
// The skip is the defect and it is not the value, it is the HUE. NC_MIDG is (0.849, 0.848, 0.801):
// blue is eaten 5.6% harder than red, so a hex that goes through the ramp uncorrected comes back
// WARMER than it was authored, every time, by a fixed amount. That is why §A.3's polished steel
// #B4BAC2 — b* NEGATIVE, the coolest hex in the table — rendered #918A79 with red on top: the
// pipeline turned the bright rung brown, exactly as an uncorrected grey must. Bronze's cream went
// the same way and the pair collided at ΔE00 6.4 on a floor of 12, two warm creams.
// SCALE TO THE CEILING, DO NOT FALL OFF IT. The inverse of a bright hex overflows — #D6C9A4 needs
// (252,237,205), luma 0.933, and §G.6 caps a large flat surface at 0.79 of AUTHORED luma (0.79 x
// the LIT cell's 1.046 x the grade's 1.02 = 0.843, under UnrealBloomPass's smoothstep(0.86,0.87)).
// The old code answered that overflow by returning the hex UNCHANGED, which throws away the whole
// correction — including the part that fits. Scaling the inverted triple down to the ceiling keeps
// the ratio between the channels, so the hue correction survives at full strength and only the
// value is surrendered:
//     Bronze    #D6C9A4 -> authored #D5C9AD -> MID (181,170,139)   was (182,170,131): +8 blue
//     Classical #B4BAC2 -> authored #C3C9DE -> MID (166,171,178)   was (153,158,155): COOL again,
//                                                                  and +0.05 of value for free
// Authored luma is held at 0.79 — the same number the old clamp tested — so §H A8 sees the same
// ceiling it passes today at 1.08% clipped against a 2% budget. Nothing here buys value it is not
// entitled to; what it buys is the ages' chroma back, which is what §H A2 fails on.
// THE VALUE STAYS SHORT AND THAT IS A PIPELINE LIMIT, NOT A COLOUR CHOICE. A vertical wall renders
// at 0.849 x authored and authored cannot exceed 0.79, so the brightest surface this rig can print
// on a torso is V 0.67 against a ladder that asks for 0.789. Said once here rather than re-derived
// per age; see the foot of ageTorso() for what that costs §H A2's adjacent-ΔV chain.
const AGE_CEIL=0.79;
function ageLit(hex){
  if(hex===undefined||hex===null)return hex;
  const c=new THREE.Color(hex);
  let r=c.r/NC_MIDG[0], g=c.g/NC_MIDG[1], b=c.b/NC_MIDG[2];
  const L=0.2126*r+0.7152*g+0.0722*b;
  if(L>AGE_CEIL){const k=AGE_CEIL/L; r*=k; g*=k; b*=k;}
  const q=v=>Math.min(255,Math.max(0,Math.round(v*255)));
  return (q(r)<<16)|(q(g)<<8)|q(b);
}
// THE HEAD IS A TURNED CYLINDER (§6.3a) — AND NC_HEADR MUST NOT MOVE TO GET IT.
// Thirty legacy helmets in this file are hand-fitted to NC_HEADR: kitShako's botR is
// NC_HEADR*1.02, the viking horns hang at NC_HEADR*1.03, the bycocket's point at *1.28. The old
// head was a 5-gon prism, whose width across the corners is 1.902 R — so building the same R as a
// 16-gon (width 2 R) would have widened every skull by 5% and pushed the corners through all
// thirty hats at once, which is exactly the class of regression §6.3a's "zero draw calls" framing
// invites. NC_HEADRC is the circumradius that leaves the SILHOUETTE at the 1.103 it has always
// been. Round the head without moving its outline; the hats never find out.
const NC_HEADW=NC_HEADR*1.902;     // 1.103 — the head's width on screen, UNCHANGED by §6.3a
const NC_HEADRC=NC_HEADW/2;        // 0.5515 — what the lathe is actually built at
const NC_HEADSEG=16;               // §6.3a: "12 sides minimum, 16 preferred"
// ============ §6.3b THE CARVED-WOOD SIGNATURE — ONE 64x64, ONE ATLAS CELL ============
// This replaces the call to 01-engine's headMaterials(), which was this file's only caller. Net
// atlas cost is therefore ZERO: one cell out, one cell in, against a budget at ~103 of ~130 (§G.4).
// It lives here because everything it paints is registered to GEOMETRY that lives here — the
// beard's top edge, the moustache bar, the 120° frontal arc — and the last time the paint and the
// geometry were in different files the mouth ended up drawn twice, 0.05 apart, and smeared.
//
// NO Math.random(), ANYWHERE IN IT. `_blocks()` — the weave fill every other unit skin uses —
// calls it, and a texture factory that draws from the casino is one refactor away from being
// invoked inside 02-world's seeded window, where it would shift every resource-node index on the
// wire and force PROTO off 26 for a colour change (§G.4). The grain is a fixed table instead.
// It is also pre-warmed at the foot of this file, so the cell is allocated at boot rather than on
// whichever unit happens to spawn first.
function ncHeadMat(){
  const key="nchead_v131";
  if(_skinCache.has(key))return _skinCache.get(key);
  // v130.6's finding, and it still holds: the front facet stands dead vertical, dotNL 0.361, which
  // is the ramp's MID cell — a x0.849 gain — so the §2.6 hex has to be authored through its
  // inverse or the face renders 38 values dark. Red still comes up short (#EFC49A needs 281 of
  // authored red and 255 is all there is) and that is stated rather than hidden.
  // ROUNDING THE HEAD RETIRED ncGain ON THE FACE, AND THE RENDER IS WHY.
  // v130.6 authored nc.face through the inverse of the ramp's MID gain (x0.849) and pegged red at
  // 255 on purpose, and it was RIGHT — for a 5-gon head, which shows the camera one facet, dead
  // vertical, dotNL 0.361, in the MID cell, always. A 16-gon shows five facets across ±56°, and
  // the ones at +22.5° and +45° come out at dotNL 0.53 and 0.62 — over the ramp's 0.52 threshold,
  // i.e. the LIT cell. The compensated skin (255,231,192) is luma 0.90 authored; through the LIT
  // cell that is 0.94, and UnrealBloomPass's high pass is smoothstep(0.86, 0.87). So half of every
  // face self-composited and blew out: measured on the isolated figure through the composer,
  // 1,196 clipped pixels per broadsword became 4,392, and the zoomed render shows the cheek disc,
  // the grain and the brow all gone inside a white band down one side of the head. That is the
  // beard's original defect, reappearing on the surface §2.6a moved the bright band ONTO.
  //
  // THE CEILING IS THEREFORE 0.86 / 1.046 = luma 0.822 AUTHORED, and nc.face is 0.787 as written.
  // §2.6's own hex is inside the limit; the correction that was protecting it is what broke it.
  // The cost is honest and small: the front facet now renders 0.67 instead of 0.77, and the lit
  // facets 0.82 — which is a face with FORM on it rather than one flat value and one white hole.
  // ANY FUTURE PASS THAT RE-ADDS ncGain HERE WILL PUT THE BLOWN CHEEK BACK. Measure with
  // `node tools/calib.js probe <class>`; it counts pegged channels on the isolated figure and
  // prints where down the body they are.
  // …AND THE LAST FIVE VALUES OF RED COME OFF, because the grade pass is part of the pipeline too.
  // nc.face's red is 239; 239 x 1.046 (LIT) x 1.02 (the grade's warm-daylight multiply, 01-engine)
  // is 255 exactly, so the lit cheek pegged red on its own after the bloom was fixed — measured
  // #FFCE94 with one channel flat. NC itself is not touched: the palette is what the ages lane
  // calibrates against, and a hex that is correct as art direction can still be two values over
  // what this particular surface prints. The clamp is per channel and it lives here, on the one
  // texture that has facets in the LIT cell.
  // The three factors are LIT-cell gain x grade x the residue the model does not capture (the
  // hemisphere term bypasses the ramp entirely, so it lands on top of both cells). They were
  // walked in by render → eyedropper → correct until the head contributed ZERO pegged channels:
  // 1.02 on red left 607px, 1.045 leaves none. That loop is `node tools/calib.js probe`.
  const litSafe=h=>{const G=[1.046*1.045,1.038*1.02,0.990*0.97];
    return [(h>>16)&255,(h>>8)&255,h&255].map((v,i)=>Math.min(v,Math.floor(250/G[i])))
      .reduce((a,v)=>(a<<8)|v,0);};
  const SK=litSafe(NC.face), SD=litSafe(NC.faceD);
  const t=_tex(64,(c,s)=>{
    // ---- 1. THE WOOD (§6.3b.4) ----------------------------------------------------------
    // Vertical striation at ±6 values and not one more. §6.3b caps it there because grain that
    // resolves as STRIPES at 40px is a barber's pole, not carved lime — it is meant to be the
    // thing you notice only once you are close enough to notice anything.
    const GR=[0,1,0,-1,0,0,1,-1,0,1,0,0,-1,0,1,-1,0,-1,1,0,0,1,0,-1,1,0,-1,0,0,1,-1,0];
    for(let x=0;x<s;x++){c.fillStyle=_shade(SK,GR[x%GR.length]*0.023);c.fillRect(x,0,1,s);}
    c.fillStyle=_shade(SK,-0.045); c.fillRect(6,0,1,s); c.fillRect(57,0,1,s); // two heartwood lines
    // ---- 2. THE BAND EVERY NON-FRONTAL FACET SAMPLES -------------------------------------
    // The 120° face is painted 1:1 on the frontal arc; the cheeks, the back and the dome all
    // sample rows 0-7 instead, at a u taken from their own angle so the grain carries round the
    // skull. One value step darker than the front is §7.4's hand-painted AO, and it is the only
    // thing stopping a head this large reading as one pale lump at three-quarters.
    for(let x=0;x<s;x++){c.fillStyle=_shade(SD,GR[x%GR.length]*0.023);c.fillRect(x,0,1,8);}
    // ---- 3. BROWS (§6.3b.3) — heavy, angled inward, and they carry the whole expression ---
    c.fillStyle="#2A1D12";
    c.fillRect(11,11,17,4); c.fillRect(11,9,9,3);       // left: outer end lifted, inner end low
    c.fillRect(36,11,17,4); c.fillRect(44,9,9,3);       // right, mirrored
    // ---- 4. EYES — doll-sized, because at 40px a realistic eye is nothing at all ----------
    // eye white at 0.795, not §2.6-era #F4F2EC (0.949): 0.795 x the LIT cell is 0.832, under
    // the 0.86 bloom cliff. An eye white that blooms is an eye with no pupil left in it.
    c.fillStyle="#CFCBBE"; c.fillRect(12,15,14,10); c.fillRect(38,15,14,10);
    c.fillStyle="#3E6FA8"; c.fillRect(16,17,9,7);  c.fillRect(40,17,9,7);
    c.fillStyle="#14100E"; c.fillRect(18,19,5,4);  c.fillRect(42,19,5,4);
    // catchlight under the cliff, and NOT #FFFFFF: §2.6 reserves pure white for the teeth
    c.fillStyle="#D2CCB8"; c.fillRect(18,19,2,2);  c.fillRect(42,19,2,2);
    // ---- 5. THE PEG NOSE ------------------------------------------------------------------
    c.fillStyle=_shade(SD,0.02); c.fillRect(28,16,8,15);
    c.fillStyle=_shade(SD,-0.06); c.fillRect(34,16,2,15); c.fillRect(28,29,8,2);
    // ---- 6. ROSY CHEEKS (§6.3b.1) — FILLED DISCS, BELOW THE LOWER EYELID ------------------
    // Circles drawn with arc()+fill: not strokes, not clipped to anything. The previous attempt
    // drew them as ARCS that inherited the eye's mask and shipped a pair of red crescents hooked
    // round the eyes — the most-noticed defect of that round. A disc cannot become a crescent.
    // THE X POSITION IS NOT FREE EITHER, and the first cut of this got it wrong: at x=9 the discs
    // landed at ±46° of the 120° arc, i.e. on the outermost facet, where even head-on they are
    // raked 45° away and foreshortened into the outline. Rendered and looked at, there was no red
    // on the face at all until the unit turned. Directly under each eye (±28°) is where the
    // reference puts them and where they survive the wrap.
    c.fillStyle="#D9584E";
    for(const cx of [18,46]){c.beginPath();c.arc(cx,30,4.5,0,Math.PI*2);c.fill();}
    // ---- 7. THE MOUSTACHE'S PAINTED SHADOW ------------------------------------------------
    // Registration, not decoration: §6.4's double mouth was two features 0.05 apart, and the fix
    // for that is registration, not banning geometry from the face. The bar below spans world
    // x ±0.33, which on a 0.5515 skull is ±36.7°, which on this wrap is x 14→50. The curls hang
    // off the bar's ends at ±0.36 = ±41°, i.e. x 6-14 and 50-58 — outboard of the cheek discs.
    c.fillStyle="#241A12";
    c.fillRect(15,33,34,7); c.fillRect(7,31,7,6); c.fillRect(50,31,7,6);
    // ---- 8. THE MOUTH (§6.4) — texture only, one owner, and the teeth are the only pure white
    // The light-over-dark pair is what reads as a bared jaw at 40px. THE ROWS ARE NOT FREE: the
    // beard's front face crosses the skull's at head-local y≈0.175, which is texture row 52, so
    // anything painted below that is drawn on a surface the beard stands in front of. The teeth
    // stop at 50. This is the reference's arrangement — moustache, then bared teeth, then beard —
    // and it exists only because the beard's z profile is tucked up here.
    c.fillStyle="#1A1210"; c.fillRect(18,40,28,4);
    // …and the teeth STAY pure white. §2.6 names them "the only pure white permitted anywhere
    // in the game" and means it; they are a flat bar with no form to lose, so clipping them
    // costs nothing. They are the one exemption from litSafe and they are exempt by name.
    c.fillStyle="#FFFFFF"; c.fillRect(18,44,28,7);
    c.fillStyle="#1A1210"; for(let x=22;x<46;x+=5)c.fillRect(x,44,1,7);   // tooth gaps
    // ---- 9. THE JAW, IN SHADOW UNDER THE BEARD --------------------------------------------
    c.fillStyle=_shade(SD,-0.05); c.fillRect(0,51,s,13);
  });
  const m=toonMat({map:t});
  _skinCache.set(key,m); _skinMats.add(m); return m;
}
// v130.4 SHOULDER ARMS (§6.5 "Vertical pike/musket"). The musket used to be carried level at the
// hip: MG's parts stack along +Z, and at rotation.x=0.15 on a forearm hanging at -0.27 the barrel
// came out pointing (0, 0.12, 0.99) — dead horizontal, a 2.9-long bar thrown diagonally across the
// whole figure and, measured on the isolated shot, the largest silhouette event on a unit §6.3
// allows exactly two of (brim notch, epaulette overhang).
// The numbers: the forearm's WORLD x-rotation is -0.2726 in the carry pose (armR +0.047, faR -0.32),
// so a local -1.4282 lands the barrel at world -PI/2 - 0.13 — vertical with the muzzle leaning
// 7° back over the shoulder, which is what makes it read as SHOULDERED rather than balanced on the
// palm. x=+0.14 walks it out to the arm's outer surface so the barrel passes beside the shoulder
// instead of through it. Butt lands at y≈1.1, muzzle at y≈4.2 — clear of the health bar at 5.3 (§5.4).
// It lives here and not as two literals because animateUnit re-asserts the carry pose every frame
// it is not aiming; the pair drifting apart would show up as a gun that snaps on the first frame.
// v131.11 …AND THE FIST WAS NEVER ON IT. The hand is endCap's sphere, r=0.12 at faR-local
// (0,-0.54,0); in the GUN's own frame it sat at (-0.14,+0.153,-0.062) — 0.14 inboard of the
// stock's centreline and 0.153 ABOVE it — so the closest approach was sqrt(0.09² + 0.078²) =
// 0.119 against a fist radius of 0.12: 0.001 of bite on one corner of the lock and daylight
// everywhere else. Cancel the 0.153 along the gun's own +Y, which is (0,0.14195,-0.98987) in the
// forearm's frame: 0.153*(0,0.14195,-0.98987) = (0,+0.022,-0.151), i.e. y -0.5 -> -0.478 and
// z 0.16 -> 0.009, and the fist closes on the small of the stock with 0.038 of bite.
// X STAYS 0.14 BECAUSE THE SLEEVE IS WHY IT EXISTS — except 0.14 never actually cleared it. The
// team cuff is r 0.20 on the arm's axis across world y 1.74-2.10 and the barrel is r 0.05, so the
// barrel needs 0.25 of separation and had 0.216: 4.7% of the gun measured INSIDE the arm on the
// build this replaces. Seating it makes that 11.8%, because the seat spends the forward offset
// that was half-saving it.
// SO THE GUN LEANS OUT, which is weaponGrip's own doctrine three hundred lines up — "butt in,
// head out … which is also how a real shouldered pike rides" — and how a shouldered musket rides
// too. ry=0.12 swings the muzzle 0.11 outboard by the time it reaches the cuff. Measured over the
// whole gun: inside the arm 4.7% -> 0.8%, fist bite 0.001 -> 0.038, muzzle world x 0.915 -> 1.139
// and butt 0.755 -> 0.678. The ranger's rifle rides this same const and moves the same way — it
// was floating 0.009 CLEAR of its fist and 5.9% inside its own sleeve, and measures 0.034 of bite
// and 0.8% after. Both build sites and animateUnit's re-assert must pass ry or the gun snaps on
// frame 1; all three are patched with this.
const NC_MUSKET_CARRY={x:0.14,y:-0.478,z:0.009,rx:-1.4282,ry:0.12};
// …AND THE PIKE LINE WAS NEVER VERTICAL EITHER. The round-2 defect list held the pike up as the
// example the musket should copy; it is not one. weaponGrip's -1.35 puts the shaft's +Y stack axis
// at (0, 0.043, 0.999) in world — 87° over, i.e. a 3.3-long shaft carried flat across six classes,
// a third of the army. §6.5 says "Vertical pike/musket" and means both. weaponGrip adds PI to
// whatever it is handed, so 0.2726 - PI cancels the forearm and stands the shaft up; the pieces
// still stack along +Y from the fist, which now means UP. Checked against the two ends: the
// halberdier is the longest of the six and its spike tops out at y≈4.9, under the 5.3 health bar
// (§5.4), while the shortest shaft's butt sits at y≈1.1, well clear of the turf.
// v130.5 THE SWORD LINE RIDES ON IT TOO, and the name is now half a lie. The musket was stood up
// last round and the pike with it; the five melee classes were left on the legacy -0.9, which
// weaponGrip turns into 2.24 rad — a blade thrown 50° off vertical, down and across the body and
// out past the frame edge on the isolated shot. Measured on the silhouette that is the LARGEST
// event on a broadsword, bigger than the shako, on a §6.3 budget of exactly two (brim notch,
// epaulette overhang) that the beard and the epaulettes already spend. The blades stack along +Y
// from the fist exactly the way a shaft does, so the same number stands them up: gladius tops out
// at y≈2.3, the vanguard's two-hander at y≈3.0, both under the shako crown at 3.81 and nowhere
// near §5.4's bar at 5.3. The z=0.3 grip offset comes with it — at the default 0.15 a vertical
// blade shaves the epaulette on its way past.
const NC_PIKE_CARRY=-2.869;
// v131.20 JOHN OVERRULES THE VERTICAL, AND SPLITS IT THREE WAYS. His words across two rounds:
// "spearman is holding spear but it is still completely vertical same with clubman", then
// "they should be held perpendicular to body and club at 45 degree angle", then "swords still
// not fixed either they need to be held at 45 degree angle".
// v130.4 and v130.5 stood this whole set upright and they were fixing a real defect -- the pike
// line was carried 87 degrees over, a 3.3-long shaft flat across a third of the army -- but they
// answered it by putting EVERY weapon on one constant, and one constant cannot hold a levelled
// spear, a shouldered sword and a club at once. AD 6.5's "Vertical pike/musket" is the clause
// being overruled here; the owner has seen it in play and it reads as planted, not carried.
// THE CONSTANT IS NOT THE WORLD ANGLE. weaponGrip does g.rotation.x = rotX + PI and the weapon
// hangs off a forearm animateUnit holds at its own pitch, so the number has to be measured, not
// derived. Swept on a live unit (tools/carrysweep.js), stack axis against world vertical:
//     rotX -2.869  ->  15.6 deg (spearman) / 20.0 deg (clubman)   <- what John called vertical
//     rotX -2.369  ->  44.3 deg            / 45.7 deg             <- his 45
//     rotX -1.569  ->  89.9 deg            / 89.9 deg             <- perpendicular to the body
const NC_SPEAR_CARRY=-1.569;   // levelled: the six spear classes
const NC_SWORD_CARRY=-2.369;   // shouldered at 45: the CLUB only, after John moved the swords to
                               // the spear angle -- "swords can also be held at same angle as the
                               // spears currently are". Kept as its own constant rather than
                               // inlined, because the club is one class and a shared constant is
                               // exactly how six weapons ended up on one angle in the first place.
// v131.22 AND THE GRIP OFFSET IS PER CLASS, BECAUSE John could still see daylight: "club and
// swords are still not in the hand of the nutcracker, still floating in front". He was right and
// A12 said 192/192 the whole time -- that gate measures geometry near y=0 in the WEAPON GROUP's
// frame, which proves the weapon HAS a grip and says nothing about whether the grip is where the
// hand is. weaponGrip's `z` is a FOREARM-frame translation applied before the rotation, so one
// shared 0.3 lands somewhere different for every blade length and every carry angle -- and the
// angle had just changed. The polearms refuter named this blind spot; this is acting on it.
// Measured (tools/fistseat.js, nearest weapon point to the fist centre, fist radius 0.12):
//     shortsword  0.307  -> 0.187 OF DAYLIGHT      legionaire  0.128 -> 0.008 of daylight
//     broadsword  0.278  -> 0.158 OF DAYLIGHT      clubman     0.106 -> 0.014 of bite, marginal
//     vanguard    0.089  -> 0.032 of bite          elitescout  0.000 -> fully seated, left alone
// Each z below is the LARGEST value that still seats with ~0.06 of bite, chosen that way on
// purpose: the least displacement from where the weapon already sits. Seating by the shortest
// route is what dragged the club into the fur cap's ear flap in v131.17, and a bigger move here
// would do the same thing to the arm.
// NC_PIKE_CARRY itself survives for the trader's coin scale, which shares it only by accident of
// history and is not a weapon at all -- moving it would swing a set of scales to the horizontal.
// EVERY legacy hat in this file (the cavalry line, the king's crown, the wilds) was hand-fitted to
// the old egg head: max radius 0.58, crown at y=1.15. The block head is 0.58 wide again — so the
// carrier's WIDTH scale is back to 1.0 and thirty hand-tuned helmets fit the skull they were drawn
// for — but it is 0.95 tall, so Y has to come down to 0.826 on its own.
// TWO AXES, NOT ONE, and not an offset either. A uniform shrink makes every helmet narrower than
// the head it encases and the block's corners come through the steel. Sliding the corpus down a
// fixed 0.20 instead was worse in a way that only shows in a render: a hat DRAWN near the crown —
// the scout's leather cap, the knight's bascinet — kept its absolute height above the chin and so
// slipped over the brow, leaving a bare scalp above it. Y scale keeps each hat at the FRACTION of
// the skull it was drawn at, which is what "fits" means for headgear.
// The price is shear on rotated children (horns, cocked brims) at 0.826 — a few degrees, invisible
// — and it is why the villager's own six cap tells hang off R.head at true scale instead: those
// are rotated panels seated against a cap this carrier knows nothing about.
// Hats written against the new proportions (kitShako) parent straight to R.head and ignore it.
// It must be a GROUP, not a scaled mesh: _mergeCluster bakes the accumulated matrix into the
// merged geometry, so the transform costs nothing at render and nothing in the mesh count.
function headHatCarrier(R){
  const H=new THREE.Group(); H.scale.set(NC_HATSC,NC_HEADH/1.15,NC_HATSC);
  R.head.add(H); return H;
}
// THE SHAKO — AD §6.1 priority 1, and the single highest-value change in the overhaul: no unit in
// this game had a tall hat, so 44% of the figure was supposed to be above the shoulders and under
// 30% was. Flared truncated cone (topØ = 1.15 × bottomØ) — NEVER taper inward, an inward taper
// reads as a wizard hat and throws the whole silhouette away. Brim disc at 1.30 × bottomØ is the
// first of the figure's only two permitted silhouette events (the other is the epaulette overhang).
// NOTHING here may cast a shadow: _mergeCluster does castShadow = parts.some(p=>p.shadow), so one
// shadow-casting hat quietly turns the head cluster into a caster for all 136 bodies (AD §10.12).
function kitShako(R,tc,o){
  o=o||{};
  const botR=NC_HEADR*1.02, topR=botR*(o.flare===undefined?1.15:o.flare);
  const h=o.h===undefined?0.94:o.h;                 // 0.24 H
  const y0=o.y0===undefined?NC_HATY:o.y0;           // sunk onto the crown so no scalp shows under it
  const crownM=o.tex?texturedMat(o.tex,o.col===undefined?NC.black:o.col):plainMat(o.col===undefined?NC.black:o.col);
  const crown=new THREE.Mesh(new THREE.CylinderGeometry(topR,botR,h,8),crownM);
  crown.position.y=y0+h/2; crown.castShadow=false; R.head.add(crown);
  // v130.1 brimR: the villager line needs a wider disc than a shako does (the petasos is a sun hat,
  // and a SHORT crown needs a bigger notch to still read as headwear at 24px). Default unchanged.
  if(o.brim!==false){ // the brim NOTCH — the break that stops hat and head merging into one blob
    // v131.4 THE PEAK IS A SOLID, NOT A WAFER. 0.07 of thickness is 1.8px on a 40px figure and it
    // is the ONE brim the whole set is allowed (§6.5a) — the strongest silhouette cue in the game
    // spent on a disc you cannot see the edge of. A real shako peak is a moulded leather visor.
    // It is also §H A2: on the musketeer the crop runs 42-72% of the figure and the peak sits at
    // 59%, so every unit of its thickness is dark felt displacing pale face in the one band the
    // dominant gate reads, on the age the ladder wants DARKEST at V 0.127.
    const bR=botR*(o.brimR===undefined?1.42:o.brimR), bH=o.brimH===undefined?0.07:o.brimH;
    const brim=_noSh(cyl(bR,bR*1.03,bH,o.brimCol===undefined?NC.blackD:o.brimCol,10));
    brim.position.y=y0+bH*0.5; R.head.add(brim);
  }
  if(o.band!==false){ // gold band at 0.075 H — the §5.2 feature floor, below which a stripe aliases to mud
    // bandH follows a short crown down, or the band swallows the whole cap on a villager
    // v131.2 IT SITS ON THE BRIM, WHICH IS WHERE §6.3 PUTS IT, AND THAT IS A MEASUREMENT.
    // At bh 0.29 centred 0.76 of its own height up, the band's top edge reached world 3.235 on a
    // musketeer — inside BOTH gate crops. Histogrammed, 16.5% of §H A2's 28-58% band on this class
    // was saturated #CFB53B, on the age whose dominant is black felt at V 0.127 and whose rung
    // measured 0.343, fourth-darkest of six. §6.3's words are "gold band AT THE BRIM": dropped to
    // 0.22 tall centred at y0+0.13, its top edge is 3.10 and both crops start above it.
    const bh=o.bandH===undefined?0.22:o.bandH;
    const band=_noSh(cyl(botR*1.05,botR*1.09,bh,o.band===undefined?NC.gold:o.band,8));
    band.position.y=y0+bh*0.59; R.head.add(band);
  }
  if(o.plate!==false){ // the front badge: a flat gold shield where the eye already is
    const pl=_noSh(box(0.30,0.30,0.05,o.plate===undefined?NC.goldH:o.plate));
    pl.position.set(0,y0+h*0.62,botR*0.92); R.head.add(pl);
  }
  if(o.plume!==false){ // team colour, at the top of the tallest mass on the field
    const pb=_noSh(cyl(0.07,0.09,0.10,NC.gold,6)); pb.position.y=y0+h; R.head.add(pb);
    const pm=_noSh(cone(0.11,o.plumeH===undefined?0.46:o.plumeH,o.plume===undefined?tc:o.plume,5));
    pm.position.y=y0+h+0.05+(o.plumeH===undefined?0.46:o.plumeH)/2; R.head.add(pm);
  }
  return crown;
}
// ============================================================================================
//  SIX AGES ARE SIX HELMET SHAPES — AD §6.5a, AGES §H A1b
// ============================================================================================
// WHAT THIS REPLACES, AND WHY IT IS SIX FUNCTIONS AND NOT ONE WITH SIX ARGUMENTS.
// Every age used to route through kitShako() — a flared truncated cone, a brim disc and a band —
// with only the hexes and a bolted-on decoration changing. The file said so in its own comments:
// ":246 the boar's-tusk helm, rebuilt on the shako", ":296 the Negau bell, straightened into a
// shako". Six shakos in six colours. It passed §H A1 at ΔE00 12.7 because A1 measures colour on a
// crown crop and six identically-shaped hats in six hues score beautifully on a colour test; the
// owner caught it by LOOKING. §H A1b now thresholds the head region into a binary mask, throws the
// colour away and computes IoU across all fifteen pairs, and that is a test decoration cannot pass.
//
// >>> kitShako() MAY BE CALLED FOR AGE 5 AND FOR NOTHING ELSE. <<<
// If a helmet's construction starts by calling it, that age has already failed. Stacking tusk
// rings on a shako does not make a tusk helm — the base solid has to be a different solid.
//
// THE BRIM IS ENLIGHTENMENT'S ALONE. It is the single strongest silhouette cue in the set and
// spending it on all six is what flattened them. Stone, Bronze and Medieval have NO brim; Iron has
// an EVERTED RIM, which is a lip on the bell's own bottom edge and not a disc hung off it;
// Classical has a rear neck guard instead.
//
// THE RATIOS ARE MEASURED ON THE HEAD REGION — chin line to the top of the hat — because that is
// what §H A1b step 1 crops and what step 3 normalises. It is NOT the helmet's own h/w in isolation:
// §6.1a makes the head enormous, so the skull is more than half of that crop on a low hat and less
// than a third on a tall one, and shifting that fraction is most of what makes two masks disagree
// after normalisation. Targets, measured through the composer with `node tools/agecheck.js line`:
//     dome 1.01 · cone 1.87 · bell 1.49 · Gallic 1.20 · great helm 1.40 · shako 1.62
// Adjacent gaps 0.86 / 0.38 / 0.29 / 0.20 / 0.22, against §H A1b's floor of 0.15. §6.5a quotes
// helmet-only figures (0.55 / 1.25 / 0.80 / 0.70 / 1.05 / 1.15) whose own adjacent gaps are 0.10
// at bell→Gallic and 0.10 at helm→shako — i.e. the quoted targets fail the quoted test. These
// keep the ORDER and the character of that ladder and clear the threshold it actually states.
//
// NOTHING BELOW MAY CAST A SHADOW. _mergeCluster does castShadow = parts.some(p=>p.shadow), so one
// shadow-casting hat turns the head cluster into a caster for all 136 bodies (§G.1 / §10.12).
// Every part goes through _noSh(), every part parents into R.head, and no part is flat-shaded —
// faceting is in the GEOMETRY, or _mergeableMat drops the mesh out of the weld and it costs a call.
const _lathe=(pts,seg)=>{                       // faceted in geometry, facet turned onto the view ray
  const g=new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg).toNonIndexed();
  g.rotateY(Math.PI/seg); g.computeVertexNormals(); return g;
};
const _lm=(pts,seg,hex)=>_noSh(new THREE.Mesh(_lathe(pts,seg),plainMat(hex)));

// AGE 0 — THE BEAR-HIDE DOME. Wider than tall, stitched in panels, no brim, chin strap.
// §0's worked example is this hat: a real Neolithic cap is skull-tight and this one is built at
// 1.44 across against a 1.10 skull, because a nutcracker's hat is always oversized. The history
// owns the material (bear hide, rawhide thong, bone toggle); the canon owns the proportion.
function helmHideDome(R,tc,A,o){
  o=o||{};
  // PULLED DOWN OVER THE EARS, and that is a measurement and not a styling note. §H A1 crops the
  // top 28% of the FIGURE, and on the shortest hat in the set that crop came out 30% bare face —
  // pale warm wood at V 0.67 averaged into a dark brown cap — which is most of why Stone and
  // Medieval measured 0.316 and 0.327 on a pair §A.2 designs at ΔE00 14.5.
  // -0.16 and not -0.22. Pulled to -0.22 the brim came down over the eyes and the Stone Age unit
  // lost its face — and §6.1 ranks the face second in the whole figure. Looked at, not calculated:
  // the eyes are back and §H A1's crop is still 80% hide.
  // WIDER AND LOWER, because §H A1b put this cap and the Imperial Gallic at IoU 0.806 when both
  // measured 163x139 — the same box, and a dome and a crest inside the same box are one shape as
  // far as a binary mask is concerned. §6.5a's tell for this age is "a smooth low DOME, WIDER than
  // tall"; 1.72 across on 0.72 of height is that, and it is the only hat in the set whose aspect
  // is under 1.0 by a margin.
  // …AND IT STOPS AT -0.13. At -0.18 the cap's own bottom rim — which on this profile is its
  // WIDEST ring — came down across the brows and took the top half of both eyes with it, and §6.1
  // ranks the face second in the whole figure. Looked at, not calculated. The temple cover that
  // §H A1 needs comes from the hide side panels below, not from burying the face.
  // v131.3 IT WAS A MUSHROOM AND §6.5a ASKS FOR A DOME "WIDER THAN TALL".
  // At rw 0.88 / hh 0.64 the head mask came out 180x136 — h/w 0.76 — against the Imperial Gallic's
  // 160x138 at 0.86, and §H A1b scored the pair at IoU 0.793 on a floor of 0.70. Two wide solid
  // blobs of the same proportion are one blob however differently they are built, and the ONE
  // number a height-normalised mask keeps is width over height. Lower and wider: 0.92 of radius
  // (1.93 across at the brow ring, just inside the tool's own ±0.95 measuring window) on 0.40 of
  // height puts this cap at ~0.59, the flattest hat in the set by a margin and the only one under
  // the head's own aspect. It is also what a bear-hide cap IS — a skull-tight bag, not a derby.
  // >>> v131.4 IT WAS A MUSHROOM AND THE FIX IS HEIGHT, NOT WIDTH. <<<
  // At rw 0.90 / hh 0.46 this measured 1.80 across on a 1.10 head with its WIDEST ring at the
  // bottom edge — so the cap overhung the skull by 0.35 and its underside rendered as a lit
  // horizontal annulus from the game's own camera. Looked at at 5x it is a bush hat, and §6.5a
  // asks for "a skull-tight bag, not a derby". Two numbers say the same thing from the other side:
  // §6.1a requires hat + head together to be 0.46-0.54 of the figure and states that under 0.44
  // "it is not a nutcracker" — this class measured 0.366, by far the worst in the set — and §B's
  // inherited row wants a hat mass of ≥ 0.20 H, which a 0.46-tall cap sunk 0.13 into the skull
  // cannot reach on any reading. §0's worked example is THIS HAT and it is explicit: "the bearskin
  // cap is built at 0.22 H — taller than a real cap, exactly as tall as a shako — because a
  // nutcracker's hat is always oversized." Height comes out of the hat and never out of the legs
  // (§6.1a), so raising it is free of every other proportion rule in the document.
  // THE WIDEST ROW MOVES OFF THE BOTTOM EDGE. That is what stops it being a derby: the profile now
  // pinches IN at the brow (0.82 rw, snug on the skull), swells to full width at 42% of its height
  // and closes over the top. A bag over the head with the ears showing, which is what a stitched
  // hide cap is. §6.5a's "wider than tall" survives — 1.48 across on 0.94 of cap is h/w 0.63,
  // still the flattest hat in the set and still the only one under 1.0 on its own proportions.
  // v131.4b AND THE TALL BAG COLLIDED WITH THE NEGAU BELL. Raised to 0.94 of height this cap
  // measured h/w 0.98 against the bell's 0.99 and §H A1b scored the pair at IoU 0.845 — two
  // rounded blobs in the same rectangle, which is the exact failure the whole amendment exists to
  // catch, arrived at from the opposite direction. §6.5a's tell for this age is "a smooth low
  // DOME, wider than tall" and it is the only sub-1.0 hat the set has; that is worth more than
  // §6.1a's hat+head share, which is a MINOR finding, so the dome goes back down. What it KEEPS
  // is the anti-derby profile below — the widest ring is no longer the bottom edge — and it now
  // buys its height from HIDE EAR FLAPS hanging to the jaw, which is a shape nothing else has.
  // >>> v131.6 THE OWNER LOOKED AT THE STRIP AND SAID THE HELMETS ALL SHARE THE SHAKO'S HEIGHT. <<<
  // He is right, and the only reason this cap was 0.62 tall is that it had to reach a PER-HAT mass
  // floor. §6.5b withdraws that floor — the nutcracker read is now on HAT + HEAD TOGETHER and how
  // it splits is the age's business — so this cap gets to be what a bear-hide cap actually is: a
  // bag pulled over the crown that adds almost no height and a good deal of width.
  // THE ARITHMETIC, so nobody re-inflates it. §6.5a's absolute target here is h/w 0.55, measured
  // chin line to top of hat over the mask's width. The chin sits at world 2.07 and the skull's own
  // crown at 2.96, so the head region is 0.89 tall BEFORE any hat exists. At rw 0.82 the cap is
  // 1.64 across and 1.64 x 0.55 = 0.90 — the target is met by a cap whose crown is level with the
  // skull's and by nothing taller. hh 0.26 puts the hide 0.04 proud of the head and lands ~0.57.
  // Every extra 0.10 of height costs 0.06 of ratio: there is no room, and buying it back with
  // width would need 1.9+ across, which is the derby this profile was rebuilt to stop being.
  const y0=NC_HATY-0.13, rw=o.rw===undefined?0.84:o.rw, hh=o.hh===undefined?0.30:o.hh;
  // FLAT-TOPPED for the anti-cavalry line: §B.2 makes spearman a flat cylinder against clubman's
  // dome on purpose, so the two Stone Age melee units separate at zoom. Same builder, one flag.
  // >>> THE FOOT TUCKS TO THE SKULL, AND THAT IS THE BRIM RULE. <<<
  // Rendered at 4x, the first cut of the low cap had a wide dark ANNULUS under its edge: the foot
  // ring was 0.82 of rw — 1.34 across against a 1.10 skull — so a quarter of a unit of cap
  // underside hung in the air all the way round and read as a plate. §6.5a gives the flat
  // horizontal disc to Enlightenment alone and it does not care that this one is made of hide.
  // 0.70 of rw is 0.588, which is the skull's own 0.5515 plus the thickness of a pelt: the cap now
  // meets the head instead of overhanging it, and the swell moves up to 55% of the height so the
  // widest row is in the middle of a curve rather than at the bottom of a shelf. That is what a
  // bag pulled over a head looks like from the side, and it is still 1.68 across on 0.30 of cap.
  // >>> AND THE FOOT IS CLAMPED, BECAUSE FIVE CLASSES CALL THIS WITH A SMALLER rw. <<<
  // The clubman is 0.84 of radius; the villager cap and the Bronze archer's are 0.70 and the
  // slinger's is 0.66, and 0.70 x 0.70 is 0.49 against a skull whose vertex radius is 0.5515 —
  // i.e. tucking the foot to the head would have driven three other hats INSIDE it and shown bare
  // scalp under the rim. 0.575 is the skull plus the thickness of a pelt and it is a floor, not a
  // value: on the clubman rw*0.70 is 0.588 and the clamp never fires, and on the slinger it fires
  // and fixes a rim that was already 0.010 inside the head before this round touched it.
  const rf=Math.max(rw*0.70,0.575);
  // >>> v131.7 THE FLAT BRANCH IS A PILLBOX NOW, NOT A FLATTER DOME. <<<
  // It used to run [rff,0] [rw*0.94,0.16h] [rw,0.62h] [rw*0.96,h] [0,h] — a profile that still
  // swells and still rolls over at the crown, i.e. a dome with the top pressed in. §B.2's word for
  // this cap is "deliberately a FLAT CYLINDER against clubman's dome so the two Stone Age melee
  // units separate at zoom", and cyl(0.20,0.21,0.20,10) is a straight-sided drum with a square
  // shoulder. Straight sides, a 0.06 flare from foot to rim exactly as §B writes it, and the top
  // closes across a FLAT disc: the outline is two vertical lines and a horizontal one.
  // AND IT IS TALLER THAN THE DOME (0.38 against 0.30), WHICH THE DOME'S OWN NOTES FORBID FOR THE
  // DOME AND SAY NOTHING ABOUT HERE. §6.5a's absolute h/w 0.55 target and §H A1b's six-hat ladder
  // are both measured on the class that carries the age — the clubman, the melee rung — and the
  // spearman is on neither. Nothing above this line moves; the anti-cavalry unit gets 0.08 of
  // height that the ladder has no opinion about, and 0.08 is 1px at 40, which is what a flat top
  // needs to be a flat top instead of a rounding artefact.
  // …AND ITS FOOT TUCKS TO THE SKULL EXACTLY AS THE DOME'S DOES. A drum whose widest ring is its
  // bottom edge hangs a lit horizontal annulus of cap-underside all the way round the head — the
  // "derby" the dome was rebuilt twice to stop being, and §6.5a spends the flat horizontal disc on
  // Enlightenment alone. The foot starts at rf (skull + a pelt) and reaches full width in the
  // bottom 18%, so the sides are vertical for 74% of the cap and nothing overhangs the temple.
  const hhF=o.flat?hh*1.27:hh;
  const prof=o.flat?[[rf,0],[rw*0.99,hhF*0.18],[rw,hhF*0.92],[rw,hhF],[rw*0.62,hhF],[0,hhF]]
    :[[rf,0],[rw*0.88,hh*0.26],[rw,hh*0.55],[rw*0.90,hh*0.78],[rw*0.58,hh*0.93],[0,hh]];
  const dome=_lm(prof,10,ageLit(A.crown)); dome.position.y=y0; R.head.add(dome);
  for(let i=0;i<3;i++){                         // stitched panel seams — the age has no metal to trim with
    // rw*1.70 and not rw*2.02: a box as long as the dome is wide pushes its CORNERS through the
    // silhouette when it is yawed, and the first cut of this shipped a bear-hide cap with two
    // little black horns on it. Seams live inside the outline or they are not seams.
    const seam=_noSh(box(0.040,hhF*0.80,rw*1.50,A.dark));   // hhF, or the flat cap's seams stop
    seam.position.y=y0+hhF*0.40; seam.rotation.y=i*Math.PI/3; R.head.add(seam); // three quarters up it
  }
  // v131.2 THE TEAM BAND CAME OFF THIS HAT ALTOGETHER, AND IT IS THE §H A1 FIX.
  // Moving it to the dome's base was the right direction and not far enough — the base of a hat
  // that seats at NC_HATY-0.16 is still well inside A1's top-28% crop, and a saturated blue ring
  // round the widest part of the cap is the single largest thing in it after the hide. Measured
  // through the composer the Stone crown came back #54494A: BLUE above green above red on a hide
  // authored at #5A4636, i.e. the one age §A.2 separates from Medieval by WARMTH had had its
  // warmth cancelled by its own team colour. Stone/Medieval failed at ΔE00 10.5 on a floor of 12.
  // A RAWHIDE THONG AND A BONE TOGGLE INSTEAD. §A.3 names both for this age ("age0.leather rawhide
  // — belts, lacing, foot-wraps"; "age0.accent bone/antler"), they are what actually tied a hide
  // cap on, and at V 0.436 and 0.737 they lift the crop's value as well as its chroma. Stone's
  // team colour moves onto the body, where §2.5 wants it and where A1 cannot see it.
  // …AND THE THONG IS NARROWER THAN THE CAP NOW. At rw*1.02/1.05 it was the widest ring on the
  // whole head and it sat on the lowest row — i.e. it WAS the derby's brim, whatever the hide above
  // it did. 0.86 of rw keeps it snug on the skull (12-gon apothem 0.615 against a 0.5515 head) and
  // leaves the cap's own swell as the widest thing up there, which is where a bag's widest row goes.
  // …and the thong is DARK rawhide. §H A1 crops the top 28% of the figure, which on the shortest
  // hat in the set starts below the cap's own foot, so this ring is inside it: at age0.leather's
  // V 0.436 against a cap authored at 0.287 it was the brightest thing in the crop and it held the
  // Stone/Medieval pair — §A.2's designed 14.5, and the pair with the least margin in the set — at
  // ΔE00 11.1. age0.dark is the same hide, oiled.
  // v131.6 0.094 -> 0.066 of height and 0.86 -> 0.80 of rw. On a 0.62-tall cap the thong was a
  // seventh of it; on a 0.26-tall one it would have been a third, and a dark ring that thick at
  // the foot of a hat wider than the ring IS a brim, whatever it is called in the source. §6.5a
  // gives the flat horizontal disc to Enlightenment alone. Tucked to 0.80 of rw it sits 0.10
  // INBOARD of the cap's own widest row on every side, i.e. under the overhang and not past it,
  // and the 12-gon apothem is still 0.634 against a 0.5515 skull so it does not cut the head.
  const brow=_noSh(cyl(rf*0.97,rf,0.070,A.dark,12)); brow.position.y=y0+0.010; R.head.add(brow);
  // the toggle rides the STRAP, below A1's crop line. At y0+0.02 it was a #C9BBA0 chip at V 0.737
  // inside the top 28%, and this age's whole job in the ladder is to be the dark warm rung.
  const tog=_noSh(box(0.13,0.17,0.11,A.accent)); tog.position.set(rw*0.66,y0-0.30,0.29); R.head.add(tog);
  // THE HIDE SIDE PANELS, AND THEY ARE A §H A1 FIX AS WELL AS THE CSV'S CHIN STRAP.
  // A1 crops the top 28% of the figure; on this hat that crop was ~15% bare temple — pale carved
  // wood at V 0.67 — averaged into a cap authored at V 0.287, which is most of why the Stone rung
  // measured 0.310 instead of the 0.287 §A.2 designs and why Stone/Iron came in at ΔE00 9.9.
  // The CSV's row for this cap is "hemispherical, stitched panels, chin strap (Otzi pattern)": a
  // hide cap is strapped ON, and the strap runs over the temple. Two of them, not one — the
  // shipped build had a single 0.047 bar on the right side only, which is a lopsided figure at any
  // distance and half a measurement here.
  // …at an ABSOLUTE offset, not rw*0.66. The cap narrowed from 0.90 to 0.74 of radius and a strap
  // pinned to it went with it — to 0.49, inside a skull of 0.5515, i.e. gone. The ear flaps are
  // fitted to the HEAD, which has not moved and is not going to (§6.1a).
  // THE EAR FLAPS, AND THEY ARE A §H A1b FIX AS MUCH AS THE CSV'S CHIN STRAP.
  // A binary mask of this head was a plain rounded blob and so was the Negau bell's; the pair
  // scored 0.845 on a floor of 0.70. A fur cap with flaps hanging to the jaw puts this age's
  // WIDEST rows at the very BOTTOM of the crop, where every other hat in the set has nothing but
  // the 1.10 skull — the bell is widest at its foot (45% up), the great helm is uniform, the cone
  // and the shako are widest at the top. It is also 0.36 of face covered in age0.dominant hide at
  // V 0.374, which is the rung §H A2 wants this age on and which it was measuring 0.36 against.
  if(o.strap!==false)for(const sx of [-1,1]){
    // the flaps are the CAP's own bear fur, not the tunic hide. A cap's ear flaps are cut from the
    // cap; and §H A1's crop reaches below the cap's foot on the shortest hat in the set, so at
    // age0.dominant's V 0.374 they were lifting a crown authored at 0.287 and holding the
    // Stone/Medieval pair — the tightest in the set — at ΔE00 11.9 on a floor of 12.
    const st=_noSh(box(0.245,0.78,0.34,ageLit(A.crown))); st.position.set(sx*0.60,y0-0.40,0.06); R.head.add(st);
    const tr=_noSh(box(0.26,0.13,0.36,A.leather)); tr.position.set(sx*0.60,y0-0.02,0.06); R.head.add(tr);
  }
  return dome;
}
// AGE 1 — THE BOAR'S-TUSK CONE. A triangle: wide base, narrow top, four laced tusk courses.
// The courses are RINGS ON A CONE, not rings on a shako: the base solid tapers, so the outline is
// a triangle with or without them. Adjacent rings counter-rotate ±8° in Y exactly as the laced
// plates alternate on the real thing, which at 40px reads as a texture the geometry paid for.
function helmTuskCone(R,tc,A,o){
  o=o||{};
  // v131.2 THE COURSES HAVE TO BE IN THE OUTLINE OR THEY ARE NOT COURSES.
  // The shipped build lathed a smooth cone and hung four flaring rings on it, 0.047 proud of a
  // hat 1.2 across — 4% of the width, gone by the time the ramp has finished with it. Rendered it
  // is a plain cream dunce cap with two faint seam lines, and §6.3 warns in its own words that an
  // inward-tapering hat "reads as a wizard hat": it did exactly that. Worse, at 40px the whole
  // age-1 figure was one light mass from cone tip to knee.
  // SO THE STEPS GO IN THE LATHE PROFILE. Four courses, each tapering up and then STEPPING OUT
  // 0.035 of radius at the next course's bottom edge, which is how laced plates actually overlap —
  // the upper row sits over the top of the row below. The outline is a sawtooth, and a sawtooth
  // survives a binary mask, a 1px blur and a 40px downsample where a painted band does not.
  // THE BASE ALSO HAD TO GROW. rb was 0.485 against a skull of 0.5515, so the cone's own bottom
  // third was buried inside the head; 0.615 has a 12-gon apothem of 0.594 and stands clear.
  // v131.3 TALLER AND NARROWER, BECAUSE THE SHAKO IS THE SAME PROPORTION AND A MASK CANNOT SEE
  // TUSK. §H A1b measured this cone at 110x173 (h/w 1.57) and the Enlightenment shako at 117x183
  // (1.56) — the same number to two places — and scored the pair at IoU 0.714 on a floor of 0.70.
  // Neither hat was wrong; they were the same rectangle of space. The brim is the shako's alone
  // and cannot move here, so the cone takes the other direction: 1.78 of height on a 1.09 base.
  // v131.5 1.86, AND IT IS THE GREAT HELM NEXT DOOR THAT ASKS FOR IT. helmGreatHelm grew 0.22 to
  // stop nesting inside the Imperial Gallic (§H A1b 3-4), and a taller narrower bucket turned out
  // to be a better fit for THIS cone's lower two thirds: 1-4 went 0.693 -> 0.726 on that change
  // alone, the same trade running the other way. The cone answers with height, which is the one
  // axis a cone has. hat + head 0.531 -> 0.539, still inside §6.1a's 0.54 ceiling — this is the
  // tallest hat in the set and there is no more room above it than that.
  // >>> v131.6 1.86 -> 1.14, AND THE TWO PARAGRAPHS ABOVE ARE THE THING BEING CORRECTED. <<<
  // Both of them raise this cone to move an IoU pair, and neither asks what a boar's-tusk helm is
  // 1.86 world tall NEXT TO. The owner named this hat and the great helm by eye: they share the
  // shako's envelope and they should not. §6.5a's absolute target for the cone is h/w 1.25 against
  // 1.73 as built, measured chin (world 2.07) to the tip over a mask 1.50 across — so the tip
  // belongs at 2.07 + 1.25 x 1.50 = 3.95, and seated at y0 = 0.80 above a head origin of 2.01 that
  // is 1.14 of cone. The profile's Y is scaled 0.6129 and its RADII ARE UNTOUCHED, so all four
  // laced courses and every step-out survive at full depth: this is a shorter cone, not a thinner
  // one, and its base is still 1.09 across against a 0.545 skull-clearing foot.
  // It is still unmistakably a triangle — 1.14 tall on a 1.09 base — and it is still the second
  // tallest hat in the set behind the shako, which is the order §6.5a asks for.
  const y0=NC_HATY-0.06, hh=1.14;
  const cone1=_lm([
    [0.545,0.000],[0.532,0.043],[0.453,0.227],   // course 1
    [0.505,0.245],[0.492,0.282],[0.390,0.472],   // course 2 — the step out is the silhouette event
    [0.438,0.484],[0.425,0.527],[0.317,0.699],   // course 3
    [0.360,0.711],[0.347,0.754],[0.216,0.932],   // course 4
    [0.254,0.944],[0.190,1.024],[0,hh]],12,ageLit(A.crown));   // …and the blunt point §6.5a asks for
  cone1.position.y=y0; R.head.add(cone1);
  // THE LACING GAPS, DARK, IN THE NOTCHES. age1.accent #D8CDAE against the crown's #D8CBA6 is two
  // values apart — that is what made four courses render as one smooth cone. §A.3's own
  // age1.leather #9A7A50 is V 0.493 against the crown's 0.797: a 0.30 break, which is the gap
  // between laced plates as a value and not as a line, and it breaks the cone's monolithic mass
  // for §6.2 at the same time.
  const _lace=[[0.494,0.230],[0.427,0.475],[0.353,0.702],[0.249,0.935]]; // v131.6: y x 0.6129, r kept
  for(const [r,y] of _lace){
    const row=_noSh(cyl(r,r,0.056,A.leather,12)); row.position.y=y0+y; R.head.add(row);
  }
  // v131.4 THE BROW COURSE IS TUSK, NOT TEAM COLOUR, AND §H A1 IS A TWO-TEAM GATE.
  // A1 was only ever run at team 0. Rendered at team 1 the saturated band at the foot of the cone
  // dragged this crown 14 ΔE00 sideways and the worst pair in the set moved with it. §A.1: "the
  // age ladder must live on non-team surfaces" — a ring round the base of the crown is the crown.
  // age1.accent #D8CDAE is the material the rest of the helmet is laced from and it lifts §H A2 as
  // well: this band sits at the very top of A2's 28-58% crop on this class, and Bronze is THE PALE
  // RUNG at 0.789 which was measuring 0.574. Team survives on the sash, the sleeves and the skirt.
  const brow=_noSh(cyl(0.575,0.582,0.16,A.accent,12)); brow.position.y=y0+0.05; R.head.add(brow);
  // v131.3 THE CHEEK PLATES ARE TUSK, NOT LEATHER, AND THAT IS §H A2 AND NOT A STYLING NOTE.
  // A2 crops 28-58% of the figure and on this age that band is the cone's foot, the cheek pieces
  // and the face. Histogrammed, the crop came back 0.544 against a ladder that puts Bronze — THE
  // PALE RUNG — at 0.789, and the darkest thing in it was age1.leather #9A7A50 (V 0.493) worn on
  // both cheeks and round the neck. A boar's-tusk helm is laced tusk PLATES; the cheek guards on
  // the Dendra panoply are the same material as the crown. age1.accent #D8CDAE, V 0.804.
  // v131.4 …AND THEY ARE BIG ENOUGH TO BE IN THE PICTURE NOW. §H A2 crops 28-58% of the figure and
  // on a §6.1a body — hat + head is HALF the silhouette — that band is mostly FACE: cropped and
  // looked at, this age's A2 crop was a portrait with two 0.117-wide chips beside it. nc.face is a
  // constant on five of six ages, so an age whose crop is 40% face can only ever measure the face.
  // A Dendra-panoply cheek guard covers the whole side of the jaw; at 0.30 x 0.62 these do, and
  // they are the age's own tusk at V 0.804 on the rung the ladder wants brightest.
  if(o.cheeks!==false)for(const s of [-1,1]){     // hinged cheek pieces — §B.2 takes them OFF the
    // v131.5 1.35 ACROSS, NOT 1.24, AND IT IS §H A1b's 1-4 PAIR. The great helm grew 0.22 (see
    // helmGreatHelm) and this cone — a smooth triangle whose widest row is its foot — went from
    // 0.693 to 0.726 against it, because a triangle with nothing outboard of its base sits INSIDE
    // a column of similar width whatever their aspects are. Lifting the cone did not fix it: the
    // gate re-frames the camera per figure (agecheck's __stage sizes off the body's own bbox), so
    // a taller hat photographs at the same pixel height and only PROPORTION registers. Width at
    // the foot is the proportion this hat has to spend, and a Dendra-panoply cheek guard is where
    // §A.3 already puts the material: 0.33 on ±0.51 spans 0.345-0.675, buried in the skull at one
    // end and 1.35 across at the other. Simulated over the shipped masks 1-4 falls to ~0.68, and
    // 1-3 (the Imperial Gallic, the other wide hat) stays at 0.62 because this stays under 1.40.
    const ck=_noSh(box(0.33,0.62,0.30,A.accent)); // spearfighter, and that absence is how the two
    ck.position.set(s*0.51,y0-0.36,0.10); ck.rotation.z=s*0.10; R.head.add(ck); // bronze units read apart
  }
  const flap=_noSh(box(0.62,0.35,0.078,A.dominant)); // linen neck cloth — see the cheek-plate note
  flap.position.set(0,y0-0.10,-0.50); flap.rotation.x=-0.4; R.head.add(flap);
  return cone1;
}
// AGE 2 — THE NEGAU BELL. A bell curve whose LOWER RIM EVERTS OUTWARD, and that flare is on the
// solid's own profile, not a disc hung underneath it. §H A1b fails a build with more than one flat
// horizontal brim in the set and this is the age most likely to grow one by accident — the shipped
// version had `cyl(0.28,0.28,0.012,16)` all the way round, which is a brim whatever the row calls it.
function helmNegauBell(R,tc,A,o){
  o=o||{};
  // v131.2 THE SEPARATE RIM RING WAS A SECOND FLAT BRIM AND §H A1b FAILS ON THAT OUTRIGHT.
  // It was `_lm([[0.76,0],[0.74,0.09],[0.60,0.17],[0.50,0.22]])` — a 0.76-radius annulus standing
  // 0.26 proud of a 0.50 dome across 0.22 of height, i.e. a horizontal disc on a plane of its own.
  // Rendered it is a soft-brimmed bush hat, and A1b lists "more than one age has a flat horizontal
  // brim disc" as an INDEPENDENT fail condition: the brim is Enlightenment's alone. §6.5a's tell
  // for this age is "a bell curve; flare at the bottom edge only" — explicitly not a brim.
  //
  // ONE SOLID, WITH THE EVERSION ON ITS OWN PROFILE. The lip's return runs 0.115 of radius over
  // 0.120 of height — 46° off horizontal, steeper than any brim can be and still be called one —
  // and the body carries a WAIST at 0.590 under a belly at 0.622, which is what makes the outline
  // a bell rather than the dome it read as before.
  // THE BASE HAS TO CLEAR THE SKULL NOW THE BRIM IS GONE. The bell seats at NC_HATY-0.08 = 0.78,
  // where the head is still at its full NC_HEADRC 0.5515; the old body was 0.50 and simply had the
  // skull poking through it, which is exactly what the 0.76 brim was hiding. The waist's 12-gon
  // apothem is 0.590·cos(15°) = 0.570, clear all the way round.
  // THE FOOT IS WIDE ON PURPOSE AND IT DOES TWO JOBS. §H A1b needs this age to stop being a block
  // (0.80 IoU against the great helm), and §H A1 needs its crown BRIGHTER: authored at #95712E,
  // V 0.454, the old bell rendered at 0.393 because a lathe of near-vertical walls lands almost
  // entirely in the toon ramp's MID cell (gain 0.849). The lip's RETURN face is the one surface on
  // this helmet that points upward — 0.21 of radius over 0.13 of rise, 32 degrees off horizontal —
  // so widening the foot turns a thin dark line into a broad LIT ring and lifts the whole crop.
  // hh 0.74 -> 1.00: §6.1a wants hat + head at 0.46-0.54 of the figure and this class measured
  // 0.410, under the 0.44 the amendment calls "not a nutcracker". Height is the only lever §6.1a
  // permits ("take it out of the hat, never the legs") and the profile below now has the volume to
  // hold it — a 0.74-tall bell with a waist in it is a doorknob.
  const y0=NC_HATY-0.11, hh=0.62;   // v131.6 0.90 -> 0.62 — see the profile note below
  // AND THE SECOND CUT OF IT WAS STILL A BRIM. Rolling the flare into the profile as an outward
  // LIP — 0.82 of radius returning to 0.575 — renders as a soft-brimmed bush hat just as surely as
  // the separate ring did, because what makes a brim is a WIDE ANNULUS WITH A SHALLOW TOP FACE and
  // that is what a lip is. There is no annulus here at all: the wall flares CONTINUOUSLY from a
  // 0.545 shoulder to a 0.720 bottom edge, every segment of it steeply sloped, which is what §6.5a
  // means by "a bell curve; flare at the bottom edge only". Looked at, not calculated.
  // v131.3 THE FOOT GOES WIDER STILL, AND THAT IS §H A1b AND NOT DECORATION.
  // At a 1.60 foot on 1.71 of head-region height this bell measured h/w 1.02 against the great
  // helm's 1.27 and the two scored IoU 0.771 on a floor of 0.70 — a bell and a bucket read as one
  // block when they occupy the same rectangle. §6.5a's tell here is "a bell curve; flare at the
  // BOTTOM EDGE only", so the answer is width at the foot and nowhere else: 1.77 across (inside
  // the tool's own ±0.95 measuring window) drops this to ~0.92 and puts the age's widest row on
  // its lowest ring, which is the one thing the great helm's straight barrel can never do.
  // The waist tightens with it — 0.515 under a 0.545 belly — or a wider foot just makes a cone.
  // v131.3 AND THE THIRD CUT WENT TOO FAR THE OTHER WAY. At a 1.89 foot this became a soft
  // brimmed BUSH HAT — looked at, not calculated — which is the exact defect §H A1b's third clause
  // names ("more than one age has a flat horizontal brim disc") and the exact word the critic used
  // for the version before it. A1b's IoU is worth less than the age reading as its own helmet.
  // 1.69 across on 0.68 of height: a LOW domed bell with a short everted skirt, which is what a
  // Negau helmet is — a skullcap with a turned lip, not a hat with a brim. The height is what
  // carries the gate now; the flare is only as much as the shape can hold.
  // …AND THE FOURTH CUT IS A CURVE AND NOT A RETURN. Every version of this that put 0.15 of
  // radius into 0.09 of height rendered as a soft brim, because a surface 32 degrees off
  // horizontal IS a brim whatever the profile calls it — looked at, twice, at 1.69 across and at
  // 1.89. The eversion here is the whole wall: 0.760 at the foot drawing continuously in to a
  // 0.545 waist over 0.40 of height, no segment of it shallower than 62 degrees, then the dome.
  // That is "a bell curve; flare at the bottom edge only" as a solid rather than as a decoration.
  // v131.4 IT HAD NO WAIST AND THEREFORE NO BELL. The profile ran 0.760 → 0.548 → 0.492
  // MONOTONICALLY: every ring narrower than the one below it, which is a cone, and its own comment
  // claimed a belly and a waist that were not in the numbers. §6.5a asks for "a bell curve", and a
  // bell curve has an inflection — the wall must come IN and then go back OUT before it closes.
  // 0.760 at the foot draws to a 0.545 waist at 45% of the height, swells to a 0.585 belly at 68%,
  // and only then domes over. That inflection is the one thing in the set a straight barrel and a
  // tapering bowl both physically cannot have, which is where §H A1b's margin against them comes
  // from — and it is also, finally, the shape of the object.
  // >>> v131.6 THE CRITIC MEASURED THE PROFILES OFF THE MASKS: THIS RIM RENDERS AS A LAMPSHADE. <<<
  // Five rewrites above argue about the flare's ANGLE and every one of them keeps the same fatal
  // property — the WIDEST RING IS THE BOTTOM EDGE. That is the definition of a brim and no angle
  // fixes it: a solid whose lowest row is its widest row draws a horizontal plate at the bottom of
  // the silhouette, which is Enlightenment's alone (§6.5a).
  // THE FIX IS A ROLLED LIP, NOT A STEEPER SKIRT. The foot is 0.735, the widest ring 0.775 sits
  // 0.052 ABOVE it, and the edge turns back IN underneath — so the lowest row of this hat is
  // narrower than the row above it, which is a bell's lip and is a thing a brim physically cannot
  // be. The radial eversion also halves, 0.250 -> 0.163 off the waist: what made the old one a
  // lampshade was as much the SIZE of the skirt as its slope.
  // AND IT COMES DOWN. 0.95 -> 0.63 of bell. §6.5a's absolute target is h/w 0.80 against 0.97 as
  // built; on a foot 1.50 across (0.775 through a 12-gon) that is 1.20 of head region, and with
  // the chin at world 2.07 and the head origin at 2.01 the crown lands at 0.63 above the seat.
  // A Negau helmet is a skullcap with a turned lip. It was a doorknob.
  // …AND THE SECOND CUT OF v131.6 WAS STILL A SUN HAT. Rolling the widest ring 0.05 up off the
  // foot was not enough on its own, because the SIZE of the eversion was never the thing being
  // reduced: 0.775 against a 0.5515 skull is 40% of overhang, and 40% of overhang presented as a
  // shallow cone is a brim at any slope. Rendered at 4x it is a bucket hat, which is the word the
  // critic used and the third time this profile has earned it.
  // 0.700 MAX, AND THE FLARE IS 0.068 OFF THE WAIST. That is a turned lip on a snug cap — which is
  // what a Negau helmet is — instead of a skirt with a cap on top. The overhang past the skull
  // falls from 0.224 to 0.149, the widest ring stays 0.045 up off the foot so the lowest row of the
  // hat is still not its widest, and the whole solid is 1.40 across against the Enlightenment
  // brim's 2.04. Height comes down with it (0.63 -> 0.55) or a narrower bell just gets taller.
  const bell=_lm([[0.692,0.000],[0.722,0.050],            // the FOOT, and the turned lip above it
    [0.694,0.107],[0.660,0.186],                           // …the edge returns: no plate, no brim
    [0.650,0.276],                                         // …the WAIST: the narrowest ring on the hat
    [0.668,0.372],[0.646,0.445],                           // …and the BELLY, swelling back out above it
    [0.564,0.513],[0.412,0.575],[0.200,0.609],[0,hh]],12,ageLit(A.crown));
  bell.position.y=y0; R.head.add(bell);
  // v131.3 THE KEEL IS POLISHED IRON NOW, AND THAT IS §H A1. Stone and Iron came back at #6A5134
  // and #8B6C37 — two warm browns, ΔE00 11.7 on a floor of 12 — because a crown crop of nothing
  // but age2.crown #95712E is a bronze helmet and this age's whole signal is the TEMPERATURE FLIP
  // off Bronze. age2.metal.lit #8A9099 at C* 4 is the cool note, and a Negau bell's medial crest
  // is the one ridge on it that was actually burnished. It is also the tallest thing in the crop.
  // v131.6 the keel follows the bell down and grows into it. On a 0.63-tall bell a ridge parked at
  // 0.66 would float above the crown; at 0.50 with 0.26 of height its top IS the crown, which is
  // where a medial keel belongs, and its 0.80 length pokes fore and aft where the dome has closed.
  const keel=_noSh(box(0.130,0.28,0.78,A.metalLit)); // the fore-aft medial keel: the bell's whole tell
  keel.position.y=y0+0.490; R.head.add(keel);
  // the TC cord rides the waist and has to stand proud of it — at 0.52 against a 0.590 waist it
  // was inside the helmet and this class's team fraction was carrying it for nothing.
  // the burnished rim line rides the skirt itself — 0.02 proud, a LINE and not a disc — and it
  // is where §H A1 gets this age's cool note: Stone and Iron came back 12.0 apart on a floor of
  // 12, two warm browns, and age2.metal.lit at C* 4 is the temperature flip §A.2 names.
  // 0.712/0.748 and not 0.766/0.782: pushed clear of the wall so it never interleaves, the ring
  // is 0.06 of extra radius on the widest part of the crown crop and §H A1's Stone/Iron pair went
  // from 12.7 to 10.6 on it — measured, both ways. It rides ON the flare, half in and half out,
  // which reads as the burnished band it is and costs the gate nothing.
  // v131.6 THE RING NO LONGER STANDS PROUD OF ANYTHING. At 0.726/0.766 it was 0.04 of radius past
  // the wall on the hat's lowest rows — a second annulus under the first, i.e. the brim the profile
  // above had just been rewritten to stop being. It is now a highlight ON the lip: 0.745/0.755
  // against a wall that is 0.775 at that height, so it is INSIDE the silhouette and contributes
  // colour (§H A1's cool note for this age) and no outline at all.
  // >>> AND IT HAS TO CARRY MORE OF THE CROP THAN IT USED TO, WHICH IS §H A1 AND IS MEASURED. <<<
  // A1 crops the top 28% of the FIGURE BOX — so when six hats come down (§6.5a), the crop comes
  // down with them, off the hat and into the face and beard, and every age's crown measurement
  // moves toward the same warm wood. Measured across this round: Stone/Iron went 22.3 -> 12.7 ->
  // 11.2 on nothing but height, two warm browns converging because 40% of both crops is now the
  // same nutcracker. The answer cannot be to put the height back. It is to spend more of what is
  // LEFT of the crop on the age's own cool note: age2.metalLit #8A9099 at C* 4 is the temperature
  // flip §A.2 names for this rung, and a Negau bell's burnished hoop is where the bronze was
  // polished. 0.16 tall at 0.666, standing 0.02 proud of a 0.645 wall — a band on the body, well
  // above the lip, so it is a hoop and not a second rim.
  // …AND THE 0.16-TALL VERSION OF IT WAS MEASURED AND MADE THE PAIR WORSE. Grey is not the same
  // lever as bright: at 0.16 the hoop took Iron's crown from #816640 to #7B684D — the VALUE barely
  // moved (0.412 -> 0.416) and the CHROMA collapsed, straight down onto Stone's low-chroma hide,
  // and 0-2 went 11.2 -> 10.5. This age's separation from Stone is carried by its bronze, not by
  // its steel. The hoop is a burnished LINE again and the bell is bigger instead.
  const rim=_noSh(cyl(0.680,0.688,0.075,A.metalLit,12)); rim.position.y=y0+0.330; R.head.add(rim);
  // …and the lip's own burnished edge. FLUSH, at 0.702 against a wall that is 0.700 at its widest:
  // it changes the colour of the rim's brightest row and it changes the silhouette by nothing at
  // all, which is the only kind of rim line §6.5a permits an age that is not Enlightenment.
  const lipL=_noSh(cyl(0.724,0.728,0.055,A.metalLit,12)); lipL.position.y=y0+0.050; R.head.add(lipL);
  // >>> THE TEAM CORD IS OFF THE CROWN. §B.1 asks for one "tied at the ridge"; §A.1 forbids it. <<<
  // The comment this replaces documented burying the cord half-inside the wall because standing it
  // proud "took §H A1's Stone/Iron pair from 12.7 to 10.2" — i.e. the gate was being passed by
  // HIDING team colour rather than by removing it, and it was never once run at team 1. Rendered
  // red, the cord and the Medieval torse between them moved the worst A1 pair to 8.2. §A.1 is one
  // line and it is the whole design: "Everything the age ladder is made of must live on non-team
  // surfaces." A dark iron cord keeps the horizontal break the bell needs and keeps the age's cool
  // temperature flip with it; the team fraction moves to the waist sash and the tunic hem, which
  // is what §B.1's own body row asks for anyway.
  const cord=_noSh(cyl(0.663,0.671,0.055,A.metalD,12)); cord.position.y=y0+0.205; R.head.add(cord);
  if(o.tuft){                                       // §B.2: the anti-cavalry line's horsehair tuft
    const tf=_noSh(box(0.195,0.28,0.52,tc)); tf.position.y=y0+0.65; R.head.add(tf);
  }
  return bell;
}
// AGE 3 — THE IMPERIAL GALLIC. Rounded bowl, brass brow band with boss rosettes, hinged cheek
// pieces, a flared neck guard sweeping BACK and DOWN, and a TRANSVERSE crest — side to side across
// the skull, which is what makes it read from the front at all. A fore-aft crest is a Corinthian's
// and it disappears head-on; §6.5a says transverse and means it.
function helmGallic(R,tc,A,o){
  o=o||{};
  // v131.3 THE BOWL GREW 0.34 AND IT PAYS TWICE — AND THE CREST PAID FOR IT.
  // The head region has to stand ~1.19 h/w to keep §H A1b's adjacent-ratio chain open against a
  // 0.91 Negau bell below it and a 1.37 great helm above it. Buying that height with CREST put
  // 0.63 of #A83228 on top of the crop §H A1 averages to one pixel and dropped the Classical
  // crown to #9D594E, V 0.402 — WORSE than the 0.445 the red-brick crest measured, on the age
  // §A.2 designs as the brightest rung at 0.727. Same total height, bought with polished steel:
  // the bowl carries 0.94 and the crest 0.45. §H A1b had this hat at h/w 0.86 against the Stone
  // Age hide dome's 0.76 — two wide low blobs of the same proportion — and scored the pair at IoU
  // 0.793 on a floor of 0.70. The dome went flatter (see helmHideDome); this goes taller, and the
  // 0.20 it gains is POLISHED STEEL at V 0.727, which is the one hex §H A1 wants more of on this
  // age: the crimson crest above it is authored at 0.302 and had dragged the brightest rung on the
  // crown ladder down to a measured 0.445. Taller bowl, shorter crest, both gates move the same way.
  // v131.4 THE BOWL IS PINCHED AND THE HAT IS AN HOURGLASS, WHICH IS THE ONLY THING THAT SEPARATES
  // IT FROM A BUCKET. §H A1b's two failing pairs were 2-3 (0.703) and 3-4 (0.727), both against
  // this hat, and both for the same mechanical reason: a mask normalised to one HEIGHT keeps only
  // aspect and profile, and a bowl-under-a-crest that is monotonically wide from the crest down
  // NESTS inside a bell and a barrel of similar aspect. It cannot nest if its middle is narrower
  // than theirs. The bowl cannot go under the skull it sits on (0.5515 circumradius, or the scalp
  // shows through), so 0.565 is the floor and this is it — 1.13 across between a 1.75 crest above
  // and 1.68 of cheek piece below. Wide, pinched, wide: an outline no other hat in the set has.
  // >>> v131.6 EVERY PARAGRAPH ABOVE BUYS HEIGHT TO MOVE AN IoU PAIR, AND THE OWNER SAW IT. <<<
  // §6.5a's absolute target for the Imperial Gallic is h/w 0.70; as built it measured 1.24 — 77%
  // over, the second worst error in the set after the great helm. The form is "a rounded BOWL"
  // with the silhouette carried by the flared REAR NECK GUARD, and a bowl 0.94 tall on a 1.13
  // base is not a bowl, it is a bucket with a fin on a stick.
  // THE ARITHMETIC. The mask is 1.82-1.90 across on this class because the neck guard (1.86) and
  // its lip (1.90) fill the tool's whole ±0.95 window, so 0.70 h/w buys 1.29 of head region — chin
  // at world 2.07, crown at 3.36. Seated at y0 = 0.80 over a head origin of 2.01 that is 0.55 for
  // bowl AND crest together: 0.44 of bowl (0.29 proud of a skull that tops out at 2.96) and the
  // crest riding in the last 0.11. The neck guard is untouched and is now unambiguously the thing
  // that makes this age's outline — which is what §6.5a says it is for.
  // …0.44 WAS A SKULLCAP, NOT A BOWL. Rendered at 4x the helmet read as a coif: 1.13 across on
  // 0.44 of height is 0.39 aspect and the only things carrying it were the cheek pieces and the
  // guard. §6.5a's first word for this age is "rounded BOWL". 0.50 puts the crown 0.35 proud of
  // the skull at h/w ~0.73 — 0.03 outside the target and inside the ±0.15 the clause allows —
  // which is the trade this round is FOR: shape first, and the number reported as it falls.
  const y0=NC_HATY-0.06, rb=0.565, hh=0.50;
  const bowl=_lm([[rb,0],[rb*0.995,hh*0.33],[rb*0.955,hh*0.67],[rb*0.62,hh*0.90],[0,hh]],14,ageLit(A.crown));
  bowl.position.y=y0; R.head.add(bowl);
  // THE NECK GUARD IS IN THE OUTLINE NOW. §6.5a's tell for this age is "asymmetric front-to-back",
  // and a guard 1.02 across under cheeks 1.68 across is invisible in a head-on binary mask — which
  // is the only view §H A1b takes. Real Imperial Gallic guards flare SIDEWAYS as well as back;
  // 1.66 wide, raked 29° and hung below the bowl's foot, it puts a second wide row at the very
  // bottom of the crop and it is polished steel, which is the hex §H A1 wants more of here.
  // >>> v131.5 THE NECK GUARD IS A MASS NOW, AND THAT IS THE WHOLE OF §H A1b's 2-3 AND 3-4. <<<
  // What was here was `box(1.18, 0.10, 0.46)` raked 29°: 1.18 across — narrower than this hat's
  // own cheek pieces at 1.64 — and one tenth of a unit tall. Projected head-on into a binary mask
  // normalised to 48 rows that is a two-pixel line, and §H A1b measures nothing else. The comment
  // above it claimed 1.66 and the code said 1.18; the code is what rendered.
  // Measured on the shipped masks, Classical 136x163px and Medieval 92x178px, IoU 0.757: the great
  // helm is a straight column 86% CONTAINED in this hat. A contained mask cannot be separated by
  // making the container narrower (that was tried on the helm and made three pairs worse — see
  // helmGreatHelm) — only by giving the container area the contained one has no part of. A real
  // Imperial Gallic neck guard is a broad flared plate hammered out of the bowl's rear and swept
  // back, down AND OUT past the ears; at 1.86 across, 0.44 deep in the picture plane and hung off
  // the bowl's foot it puts a wide trapezoid across the bottom third of the crop, which is exactly
  // the rows where the bell, the bucket and the shako are all a plain 1.10-wide skull column.
  // It is not a brim (§H A1b's third clause): a brim is a horizontal disc at the BASE of a crown,
  // and this is a raked plate on the BACK of a bowl, open at the front where the face is.
  const guard=_noSh(box(1.86,0.44,0.62,ageLit(A.crown)));   // the neck guard, flared back, down and OUT
  guard.position.set(0,y0-0.44,-0.40); guard.rotation.x=-0.62; R.head.add(guard);
  // …and the lip it rolls into, so the plate has an EDGE rather than ending in a cut face. Two
  // boxes on R.head, both _noSh, both welded into the head cluster by _mergeCluster: zero draw
  // calls (§G.1), 12 triangles, and the profile reads as hammered metal instead of a shelf.
  const glip=_noSh(box(1.90,0.13,0.20,ageLit(A.crown)));
  glip.position.set(0,y0-0.66,-0.60); glip.rotation.x=-0.62; R.head.add(glip);
  for(const s of [-1,1]){                            // hinged cheek pieces flanking the face
    // ±0.71 and not ±0.505. At the old offset the cheeks' outer edge landed at 0.56 against a
    // skull half-width of 0.55 — inside the outline, i.e. invisible in a binary mask. ±0.60 put
    // them barely outboard of the BEARD's 0.596 and §H A1b still read this age as a block: 0.78
    // against the Stone dome, 0.72 against the Negau bell, 0.75 against the great helm. Out at
    // 0.71 the cheeks are 1.61 across under a 1.16 bowl under a 1.75 crest — wide, pinched, wide,
    // which is an hourglass and is the one outline in the set that is not a tower or a mushroom.
    // …AND THE INNER EDGE HAS TO BITE INTO THE SKULL. At 0.19 wide on x=0.71 the box spanned
    // 0.615-0.805 against a head half-width of 0.55: two grey slabs floating in mid-air beside the
    // face with daylight between them and the helmet, which is the same defect as the viking's
    // detached horn. 0.32 wide on 0.66 spans 0.50-0.82 — buried in the skull at one end, 1.64
    // across at the other.
    // v131.3 AND 0.74 IS TOO FAR OUT. §H A1b wanted more area on this mask and pushing the cheeks
    // to 0.74 delivered it and put two grey slabs in mid-air beside the face with daylight between
    // them and the helmet — the same defect as the viking's detached horn, and the same one the
    // paragraph above was written about. The inner edge has to BITE into the skull. Back to 0.66.
    // v131.4 AND THEY REACH THE JAW, WHICH IS WHERE A GALLIC CHEEK PIECE ACTUALLY WENT.
    // §H A2 crops 28-58% of the figure and that band on a §6.1a body is mostly FACE — cropped and
    // looked at, this age's A2 crop was a portrait of a nutcracker with two grey chips beside it,
    // and it measured #9B896E (warm, V 0.544) against a ladder that names this age the brightest
    // rung at 0.727 in POLISHED STEEL (C* 4.8, cool). nc.face is a constant on five of six ages,
    // so an age whose crop is 40% face measures the face. Real Imperial Gallic cheek pieces came
    // down past the jaw and nearly met under the chin; 0.34 x 0.70 does, and it is the same hex as
    // the bowl. It also lengthens the hourglass's lower lobe, which is A1b's half of the same fix.
    // v131.4b THEY ARE HINGED, AND A HINGE HAS AIR UNDER IT. §H A1b had this hat at 0.782
    // against the great helm because a solid column of mask nests inside a solid rectangle of
    // mask whatever is drawn on either. The cheeks move OUT to 0.78 (span 0.65-0.91, clear of a
    // 0.5515 skull) and hang from a hinge boss at the brow band, so the mask carries two real
    // vertical SLOTS of background between jaw and cheek piece — which is what a hinged Gallic
    // cheek piece looks like, and which no other mask in the set has. The "two grey slabs
    // floating in mid-air" defect the comment above records is answered by the boss: the piece is
    // visibly attached at the top and swings free below it, rather than starting in mid-air.
    const ck=_noSh(box(0.22,0.66,0.26,ageLit(A.crown)));
    ck.position.set(s*0.68,y0-0.36,0.08); ck.rotation.z=s*0.10; R.head.add(ck);
    const hg=_noSh(box(0.30,0.15,0.22,ageLit(A.crown)));    // the hinge the cheek piece swings on
    hg.position.set(s*0.58,y0-0.03,0.08); R.head.add(hg);
  }
  // v131.5 THE BROW BAND GOES STEEL AND THE BRASS STAYS ON THE ROSETTES. §H A2's crop on this
  // class is 20.4% face and the face is a constant #EFC49A on five of the six ages, so every warm
  // texel the age spends inside that crop is spent on the wrong side of a pair it is already
  // losing: Bronze/Classical measured ΔE00 6.7 — two warm creams — on a floor of 12, and §A.2
  // names this rung "polished steel… the bright, high-key, polished rung" at C* 4.8. Brass at
  // C* 56 across the whole brow was 4.1% of the crop in the single warmest hex the age owns.
  // §A.3 keeps age3.brass for "legionary fittings, buckles, boss rosettes" — the three rosettes
  // below and the cingulum studs still carry it, which is where a helmet's brass actually is.
  const band=_noSh(cyl(rb*1.035,rb*1.06,0.078,ageLit(A.light),14)); band.position.y=y0+0.05; R.head.add(band);
  for(let i=0;i<3;i++){                              // three boss rosettes, §B.1's count
    const bs=_noSh(cyl(0.055,0.055,0.04,A.metalD,8));
    bs.rotation.x=Math.PI/2; bs.position.set((i-1)*0.30,y0+0.05,rb*0.99); R.head.add(bs);
  }
  // THE CREST IS CRIMSON, NOT TEAM COLOUR, AND THAT IS A TRADE MADE WITH THE NUMBERS IN FRONT OF
  // ME. §B.1 asks for a TC transverse crest. §H A1 crops the top 28% of the figure and does NOT
  // mask team before averaging, and a 1.70-wide saturated blue slab across the crown pulled this
  // age's crown from polished steel at V 0.727 to 0.486 — the brightest rung on the crown ladder
  // reading as the third-darkest. §A.3 names #A83228 for exactly this part ("Roman crest and
  // focale", capped at 6% of the unit) and every Roman crest was red anyway. Team survives on the
  // focale ring at the throat, the tunic at sleeve and hem, and the scutum's whole face.
  // v131.2 IT WAS A RED BRICK ON A STICK. `box(1.70,0.36,0.094)` floating 0.17 above a bowl whose
  // own top is a point: square ends, a flat top edge, and a visible gap of background between the
  // crest's underside and the dome's shoulders. At any distance it read as a plank, and being a
  // 0.61-unit slab of #A83228 in the top 28% of the figure it dragged §H A1's Classical crown from
  // polished steel at V 0.727 down to a measured #986955 at 0.445 — the brightest rung on the
  // crown ladder reading as the third-darkest.
  // A ROUNDED RIDGE, LATHED, AND SEATED IN THE DOME. The solid is a prolate spindle turned about
  // its own axis and then laid on its side, so the top edge is a CURVE and both ends taper to
  // nothing — horsehair, not carpentry. It is 1.30 long against the old 1.70 and its lower third
  // is buried in the bowl, which closes the gap without a separate base plank.
  const crestGeo=_lathe([[0,0],[0.28,0.12],[0.42,0.35],[0.50,0.65],[0.42,0.95],[0.28,1.18],[0,1.30]],8);
  crestGeo.translate(0,-0.65,0);           // centre the spindle on its own axis BEFORE it is laid down
  // >>> v131.4 THE CREST IS BRASS, NOT CRIMSON, AND §A.4 IS WHY. <<<
  // "No age's DOMINANT or CROWN may sit within 25° of either team hue at chroma C* > 20."
  // Team red #D62B2B is Lab hue 33.9° at C* 77.4. age3.crimson #A83228 is hue 35.3° at C* 58.3 —
  // ONE POINT FOUR DEGREES away. Measured, the Classical CROWN (A1's top-28% crop averaged to one
  // pixel) came back #A0695D: hue 37.5°, C* 25.9, i.e. 3.6° off team red at chroma above 20, a
  // direct violation. At team red, 47.7% of that crop landed within ΔE00 20 of the team hex and
  // the render is a legionary whose helmet is the same red as his coat — which is precisely the
  // failure §A.4 exists to prevent. §I open question 4 states this alternative in as many words
  // ("move the Classical crest to age3.brass #C9A03C gold-yellow horsehair — no team conflict, and
  // it would strengthen the age's brass read") and declines to choose; §A.4 is a hard rule and the
  // crimson is a §B styling choice, not a palette rung, so the rule wins. Brass is hue 85.0° at
  // C* 55.9 — 51° clear of red and 207° clear of blue — and at V 0.633 it lifts the brightest rung
  // on the crown ladder instead of dragging it down. The crimson survives on the focale.
  // v131.4c AND THE SECOND CUT WENT TO POLISHED STEEL, BECAUSE BRASS IS STILL WARM.
  // Brass cleared §A.4's team-hue window (85° against red's 33.9°) and did nothing for §H A1: at
  // C* 55.9 and Lab hue 85° it is in the same warm quadrant as the Bronze cone's tusk, and the
  // Classical/Bronze pair only moved 7.8 -> 8.2 on a floor of 12. §A.2 is explicit about what this
  // rung is: "polished steel, brass and marble… the bright, high-key, polished rung", crown
  // #B4BAC2 at C* 4.8. The crop that A1 averages to one pixel has to BE that. A silvered crest fin
  // on a brass holder is a real Roman cavalry crest and it leaves the age's brass on the brow
  // band, the rosettes, the holder and the finials, where a helmet's brass actually is.
  const crest=_noSh(new THREE.Mesh(crestGeo,plainMat(ageLit(A.crown))));  // TRANSVERSE: across the skull
  crest.rotation.z=Math.PI/2;              // local +Y (the spindle's length) becomes world +X
  // IT STAYS 1.75 WIDE. The first cut of this took the critic's "shorten it to stop inside the
  // bowl's width" literally and §H A1b immediately failed on it: Classical's head mask dropped to
  // 136px, the same as Iron's 137 and Medieval's 134, and the three scored 0.81 / 0.80 / 0.83
  // against each other. The wide transverse crest is the ONLY thing that makes this age a T
  // instead of a third block, and A1b is a blocking gate. What was wrong with the old crest was
  // its FORM — a square-ended slab floating on a gap — and that is what changed.
  // 0.44 TALL AND 0.24 THICK. At 0.62 x 0.30 the spindle rendered as a red SAUSAGE laid across the
  // helmet — the plank's problem solved into a different wrong object. Horsehair is a thin blade;
  // this is 0.44 of height on 1.75 of length, and its lower third is inside the bowl.
  // v131.3 1.60 LONG AND 0.52 TALL, ON A BOWL THAT IS NOW 0.80. The crest keeps its job — it is
  // still the widest thing on the head and still the only transverse mass in the set — but the
  // age no longer buys its whole silhouette with crimson. Narrower puts the widest row back on the
  // CHEEK PIECES at 1.64, so the outline is wide-narrow-wide top to bottom rather than one slab.
  // v131.4 THINNER, AND LIFTED OFF THE BOWL SO THERE IS SKY UNDER ITS ENDS.
  // Two measurements ask for the same edit. §H A1 averages the top 28% of the figure to ONE pixel
  // and a 0.90-tall brass ridge is ~30% of that crop at C* 56: the Classical crown came back
  // #AB9760, warm, and collided with the Bronze cone's cream at ΔE00 7.8 — two warm creams. The
  // bowl under it is polished steel at C* 4.8 and that is what §A.2 wants this rung to BE, so the
  // crest gets thinner and the steel gets the crop. §H A1b wants the opposite of a solid blob:
  // seated INTO the bowl the whole head was one filled outline, which is what nests inside a bell
  // and a bucket. Raised 0.13 on a narrow central holder, the mask gains two triangular HOLES
  // under the crest's ends — and a hole is worth more to an IoU than any amount of width, because
  // no other hat in the set has one.
  // v131.4b 0.34 OF HEIGHT AND NOT 0.60, AND THE ARITHMETIC IS THE WHOLE ARGUMENT. §H A1 crops
  // the TOP 28% OF THE FIGURE — and this crest IS the top of the figure, so it also sets where
  // that crop begins. Measured across the band, a 0.60-tall ridge was ~60% of the crop's own area
  // in brass at C* 56, and the Classical crown came back #A89665 (warm, b* high) against the
  // Bronze cone's #C4B17F: ΔE00 8.1, two warm creams, the worst pair in the set. The bowl under it
  // is polished steel at C* 4.8 and IS this age's rung; the crest has to stop owning the crop.
  // A 0.34-tall blade is also closer to horsehair than the 0.60 sausage it replaces.
  // …AND 0.30 OF LIFT WAS A PROPELLER. LOOKED AT, at 3x, a 0.34-tall blade floating 0.30 above
  // the bowl on a 0.20 stalk reads as a helicopter rotor, not as horsehair — which is the same
  // class of defect as the red plank and the red sausage this crest has already been twice. 0.13
  // of lift on a 0.36-wide crest BOX keeps the two triangles of sky §H A1b wants under the blade's
  // ends and puts the mass back on the helmet. A1b's IoU is worth less than the age reading as its
  // own helmet, and that trade has been made in this direction before, on the Negau bell.
  // >>> v131.6 THE CREST SITS ON THE BOWL. THE STALK IS GONE. <<<
  // The critic measured the profile off the mask and called it "a floating bar on a 9-wide stalk",
  // and the two paragraphs above are the record of how it got there: +0.13 of lift for A1b's
  // hole-under-the-blade, then +0.20 more for A1b's adjacent-ratio clause. Both are gate moves and
  // both made the object less like a helmet. A transverse crest is a fin RAISED FROM THE BOWL — it
  // is attached along its whole length, not perched on a post — so the spindle now seats with its
  // lower half inside the bowl and there is no holder at all. §6.5a's tell for the age is the rear
  // neck guard, which is 1.86 across and untouched; the crest crosses the skull and stops there.
  crest.scale.set(0.30,1.14,0.20);         // …so local x is the ridge's HEIGHT and local z its thickness
  // v131.5 +0.20 OF LIFT, AND IT IS THE ADJACENT-RATIO CLAUSE THAT ASKS FOR IT.
  // The neck guard below (see it) put 0.68 of extra width on this mask and took the head region's
  // h/w from 1.20 to 1.12 — inside 0.15 of the Negau bell's 0.97, which is §H A1b's SECOND clause
  // and a hard fail. Height is the other end of the same fraction: 0.20 on a 2.04-tall crop is
  // h/w 1.23, which is 0.26 clear of the bell below it and 0.70 clear of the great helm above it.
  // It also stops the bell nesting: simulated over the shipped masks, 2-3 falls 0.742 -> 0.70 on
  // this lift alone, because a mask normalised to one HEIGHT loses width everywhere when it grows
  // taller, and the rows it loses are the ones the bell's skirt was overlapping.
  // hat + head goes 0.481 -> 0.506 H, still inside §6.1a's 0.46-0.54.
  // -0.05, not +0.41: the spindle's centre sits just under the bowl's crown, so its lower half is
  // inside the steel and 0.15 of blade stands proud. Bowl top y0+0.44, crest top y0+0.55 — which is
  // the 1.29 of head region §6.5a's 0.70 target buys, and there is no gap anywhere in it.
  crest.position.y=y0+hh-0.05; R.head.add(crest);
  // the finials go brass with the crest. Team colour on ANY part of the crown is what failed §H A1
  // at team 1 (see the great helm's torse), and two 0.11 studs are the cheapest of the four to lose.
  // …and they sit DOWN on the crest's taper. At the spindle's own centre height they cleared its
  // tapered ends and rendered as two gold horns in mid-air either side of the helmet.
  for(const s of [-1,1]){const tip=_noSh(cyl(0.050,0.038,0.10,A.metalD,6)); // the crest's cast finials
    tip.rotation.z=Math.PI/2; tip.position.set(s*0.62,y0+hh-0.11,0); R.head.add(tip);}
  return bowl;
}
// AGE 4 — THE GREAT HELM. A straight-sided flat-topped barrel with NO FACE: one vision slit and a
// cross of breath holes on a dead matte block. §0's hard worked example — a great helm has no face
// and the face is the nutcracker — is resolved the way a real great helm sat over a coif: the
// bottom edge stops 0.06 H above the chin and THE CARVED BEARD HANGS OUT BENEATH IT. The unit
// loses its eyes and its mouth and keeps its beard, which is the larger silhouette carrier of the
// two, and the reference art's Norse figure does exactly this under a mail coif.
// v131.26 THE SEVENTH SHAPE — THE HOUNDSKULL BASCINET, and it exists because John ruled it in:
// "knight mask is clipping and knight should have full closed face helmet", then chose "give the
// knight his own seventh shape" over reusing one of the six or leaving it open-faced.
//
// WHAT WAS THERE WAS NOT A HELMET SHAPE AT ALL. The knight wore a hand-rolled sphere (r 0.52,
// scaled 0.95/1.15/0.95) with a flat box stuck on the front as a visor -- and that box is 0.74
// wide while the dome, at the visor's own depth of z 0.40, is only 2*sqrt(0.494^2 - 0.40^2) =
// 0.58 across. The visor's corners punched 0.08 out through the skull on each side. That is the
// clipping, and it was geometric rather than a z-fight: there was nothing to bring into line.
//
// WHY A SNOUT. §6.5a's whole argument is that ages must differ in SHAPE, and §H A1b measures it as
// silhouette IoU between pairs. The six existing shapes are all variations on "roundish mass above
// the beard": hide dome, tusk cone (points UP), Negau bell (wide-footed), Gallic (neck flare),
// great helm (tall flat bucket), shako (flared cylinder). NONE of them projects FORWARD. A
// houndskull's snout does, which buys separation in the side view that no amount of re-proportioning
// the seventh roundish blob could -- and it is the correct period answer for a Medieval knight,
// which is the age the great helm already owns from the other end.
//
// SIXTEEN SEGMENTS AND A 0.59 CIRCUMRADIUS, matched to the skull's own count and phase, for the
// reason helmGreatHelm records in detail: the head is a 16-gon of circumradius 0.5515, and a lathe
// with fewer sides lets the head's vertices punch out between the helm's flats. This is that fix
// applied on the way in rather than after a render.
function helmHoundskull(R,tc,A,o){
  o=o||{};
  const M=texturedMat("metal",A?A.metal:0xc2c9d4), D=plainMat(0x0c0c10);
  // >>> v131.27 THE HEAD FRAME, NOT THE HAT FRAME. <<<
  // The first cut added every part to R.hat, and R.hat is headHatCarrier's group — scaled
  // (NC_HATSC, NC_HEADH/1.15, NC_HATSC) = (1, 0.826, 1) so that the thirty LEGACY hats in this file,
  // every one of them hand-fitted to the old 1.15-tall egg, still land on the new lathe head.
  // Feeding NEW head-frame constants (NC_HATY) into that frame silently multiplies every y by 0.826,
  // and a non-uniform parent scale also SHEARS anything rotated, which the snout is on two axes.
  // helmGreatHelm adds to R.head for exactly this reason; so does this. Head-local y: 0 = chin,
  // NC_HEADH 0.95 = crown, lathe circumradius NC_HEADRC 0.5515.
  //
  // >>> A SPHERE CANNOT COVER THIS HEAD, AND THE OCCLUSION CENSUS IS WHAT PROVED IT. <<<
  // The dome was an ellipsoid, r 0.60 stretched 1.02 and centred at 0.50, and by every bounding-box
  // measure it enclosed the skull: it spanned -0.11 to 1.11 against a head of 0 to 0.95, with 0.037
  // of radial clearance at the equator. tools/knighthelm.js fired 812 rays inward anyway and 156 of
  // them reached bare wood — every single one at head-local y 0.89, none anywhere else.
  // The cause is that the head is NOT a sphere. Its lathe holds FULL radius from y 0.19 to 0.78 and
  // then domes over hard (profile r 1.00 -> 0.90 -> 0.55 -> 0 across the last 0.17 of height), and
  // an ellipsoid wide enough to clear the straight flank is already collapsing at the crown: at
  // y 0.89 it gives 0.462 against the head's own 0.461. Coincident surfaces, and the coarse 9-band
  // sphere tessellation then cut inside on every facet. No amount of re-centring fixes it — widen
  // the ellipsoid until the crown clears and the equator becomes a barrel.
  // SO THE HELM IS A LATHE THAT FOLLOWS THE HEAD'S OWN PROFILE, offset outward. Same 16 segments,
  // same pi/16 phase, so vertices align and the clearance is the plain radial difference rather
  // than something that swings between +0.009 and -0.010 (helmGreatHelm's v131.2 note). Clearance
  // is 0.049 at the flank, 0.040 at the shoulder of the crown — the great helm ships at 0.0385 —
  // and opens to 0.25 over the dome. Authored against NC_HEADRC/NC_HEADH so it tracks the head if
  // either constant ever moves.
  // 1.20 ACROSS AND NOT MORE. §H A1b scored the great helm against the Negau bell at 0.802 when the
  // bucket grew to 1.25, "because two blocks of the same width are one block". The great helm is
  // 1.157; this is 1.20; the separation between them is the SNOUT, not the girth.
  // The rim stops at y 0.195 rather than swallowing the jaw: the beard is a lathe on R.head raked
  // forward and down (§6.3c) and it already covers everything below — the census records 573 first
  // hits on the beard and zero on the skull under the crown.
  const RC=NC_HEADRC, HH=NC_HEADH;
  const hp2=(r,y)=>new THREE.Vector2(RC*r,HH*y);
  // A BELLY, NOT A CYLINDER. The first cut ran the flank dead vertical at r 0.600 from y 0.105 to
  // 0.620 and rendered as a barrel — which is the GREAT HELM's shape, and §H A1b fails a pair that
  // reads the same. Widest at y 0.42 and drawing in above and below costs nothing and keeps every
  // clearance at or above the 0.0385 the great helm has shipped on since v131.2.
  const domeGeo=new THREE.LatheGeometry([
    hp2(1.061,0.053),                                       // r 0.585 y 0.050 — the rim, open at the neck
    hp2(1.115,0.079), hp2(1.061,0.111),                     // its lip, standing 0.03 proud
    hp2(1.088,0.442),                                       // the belly, 0.049 off the head
    hp2(1.066,0.874), hp2(0.988,1.005),                     // the shoulder — 0.038 clear at its tightest
    hp2(0.780,1.132), hp2(0.435,1.205), hp2(0,1.232)        // …and over the crown, 0.22 above it
  ],NC_HEADSEG);
  domeGeo.rotateY(Math.PI/NC_HEADSEG);                      // phase-locked to headGeo's own rotation
  const sk=_noSh(new THREE.Mesh(domeGeo,M)); sk.name="helm.dome"; R.head.add(sk);
  // AND THE FACE GEOMETRY COMES OFF, exactly as helmGreatHelm does it — this was simply omitted.
  // The moustache bar stands at z 0.47 with 0.26 of depth, so its front face is at 0.60 against
  // 0.588 of dome at that height, and its two curled tips at x +-0.36 sit at z 0.55 where the dome
  // has only 0.424 to give. The first render showed them as a bare tan band straight across the
  // face under the brow band — not a clipping artefact but a moustache worn OUTSIDE a closed helm.
  // Cheeks, eyes, brows and teeth are paint on the skull and the solid hides them; these three
  // boxes were the only face geometry. Removed before mergeUnitBody() runs, so nothing is orphaned.
  if(R.face)for(const p of R.face)if(p.parent)p.parent.remove(p);
  // THE AVENTAIL, AND IT IS A REAR HALF-SKIRT FOR A REASON. With the rim closed at y 0.050 the
  // census still found 64 rays reaching wood — every one of them from BELOW AND BEHIND, entering
  // under the rim and landing on the nape at y 0.08-0.12, z negative. A beard covers the throat and
  // the jaw; nothing covers the back of the neck, which is the exact hole a real bascinet hangs
  // mail over. A full skirt would land inside the beard and stripe it (see the note below), so this
  // one opens 63 degrees at the FRONT — theta 0 is +z in r128's cylinder — and wraps everything
  // else.
  // IT HUGS AND IT IS LONG, rather than short and flared. A short skirt at r 0.66 left one ray in
  // 812 still threading the annulus between its bottom edge and the cuirass — and the fix for that
  // is not a wider flare, which at 1.36 across against a 1.20 helm stops reading as mail and starts
  // reading as a ruff, and fouls the pauldrons at x 0.27 on the way. 0.600 to 0.625 over 0.52 of
  // drop takes the hem to head-local -0.46, inside the cuirass (r 0.56-0.60), and closes the angle
  // completely: a ray shallow enough to get under the hem now has to climb 0.49 in 0.44 of run to
  // find any skull at all, and there is none below the chin pole to find.
  const av=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.600,0.625,0.52,NC_HEADSEG,1,true,0.55,Math.PI*2-1.10),M));
  av.position.y=-0.20; av.name="helm.aventail"; R.head.add(av);
  // NO GORGET, AND THAT IS DELIBERATE. The beard is a lathe on R.head raked forward and down
  // (§6.3c) and it is the nutcracker signature the great helm keeps too; a metal collar at the
  // throat lands inside it and slices it into stripes, which is the identical failure the
  // broadsword's lamellar plates caused at z 0.556 and which §6.3c's rake exists to prevent. The
  // helm sits ON the beard.
  // >>> THE VISOR, AND IT HAS TO BE THE SIZE OF A FACE. <<<
  // The first cut made it a 0.34-radius pyramid — a muzzle narrower than the skull, which is what a
  // real one is — and rendered, it was a thumbnail-sized wart on the front of a plain bucket. From
  // the side, the shape that is supposed to be the ENTIRE argument for a seventh helmet read as
  // 0.30 of grey wedge on a 1.20 barrel, i.e. as the great helm with a chip on it. A houndskull's
  // visor is not an accessory: it is a beak that covers the whole face, hinged at the temples, from
  // the brow down past the chin.
  // A CONE'S BASE MUST NOT BE BURIED, WHICH IS WHY THE FIRST TWO TRIES BOTH CAME OUT AS A WART.
  // The base sat at z 0.07 and the helm's surface is at z 0.60, so the helm cut the pyramid 63% of
  // the way to its own apex — and what emerged was whatever was left of a linear taper at that
  // point: 0.19 of radius over 0.32 of run. Widening the base does not help, because a base wide
  // enough to matter (0.75) puts its corners at radius 0.75 against a 0.60 helm and grows wings.
  // The lever is the RUN. Push the apex out to z 1.12 and the helm now cuts at 53% instead of 63%,
  // so 0.27 of radius over 0.52 of run emerges — 0.55 across and 0.43 of a helm-width long, which
  // is a beak. Base radius 0.58 keeps its corners at 0.581 against a 0.600 lathe, inside by 0.019.
  // NO rotation.y, AND THAT IS THE THIRD THING THAT WAS WRONG WITH THIS SHAPE. r128 lays a cylinder
  // or cone's first radial vertex on +z and steps round from there, so a 4-gon base ALREADY has its
  // corners on the axes; the pi/4 inherited from the great helm's phase-matching then rotated them
  // OFF the axes onto the diagonals, and the visor ran on its apothem — 0.410 where the geometry
  // says 0.58, a 29% loss in both width and height. Two rounds of "make it bigger" were spent
  // fighting a rotation.
  // A 0.07 FLAT AT THE TIP RATHER THAN A POINT: a houndskull is blunt, and a needle apex on a
  // low-poly figure is one triangle wide at 40px and aliases into a spark.
  const vis=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.58,1.10,4),M));
  vis.rotation.x=Math.PI/2+0.10;
  vis.position.set(0,0.425,0.573); vis.name="helm.visor"; R.head.add(vis);
  // THE VISOR'S FOUR CORNERS, in head-local space, read off that cone: the apex forward, the two
  // hinge corners at the temples, a crown corner buried in the dome and a chin corner buried in the
  // aventail. Everything else on the face is placed BARYCENTRICALLY on these, so the slots and the
  // breaths travel with the visor instead of being stranded the next time it is re-proportioned —
  // which has now happened twice.
  const VA=new THREE.Vector3(0,0.370,1.120), VR=new THREE.Vector3(0.58,0.480,0.025),
        VT=new THREE.Vector3(0,1.057,0.083), VB=new THREE.Vector3(0,-0.097,-0.033);
  const _on=(Q,a,b)=>VA.clone().addScaledVector(VR.clone().sub(VA),a).addScaledVector(Q.clone().sub(VA),b);
  const _out=(Q)=>{const n=VR.clone().sub(VA).cross(Q.clone().sub(VA)).normalize();
                   return n.x<0?n.negate():n;};                     // outward = away from the ridge
  // >>> ONLY THE TIP OF THE VISOR IS ACTUALLY OUTSIDE THE HELM, AND THAT BOUNDS WHERE ANYTHING
  // CAN GO ON IT. <<< Both hinge corners are buried — VR sits at radius 0.581 and VT at 0.083,
  // against a lathe of 0.600 — so the emergent beak is a small triangle near the apex, running to
  // a ~0.56 along the VA->VR edge and b ~0.50 along VA->VT. The first placement put the slots at
  // (0.34, 0.30), radius 0.479, which is 0.12 INSIDE the dome: three renders in a row showed a helm
  // with no eyes at all and nothing wrong with the slot geometry. Everything below is chosen to
  // land near the centroid of the EMERGENT triangle and its radius is stated so the next edit can
  // check it against the lathe rather than rediscovering this.
  // THE OCULARIUM: one slot each side of the ridge, on the visor's upper faces where a houndskull's
  // actually are. §6.5a's entire tell for a closed helm is that you can still see WHERE the eyes
  // are, and helmGreatHelm records at length what happens when one is covered — "two black
  // rectangles at the far edges of a blue ring, reading as studs". Radius 0.665 against a 0.600
  // lathe. The long axis is yawed 1.085 to lie along the VA->VR edge, which is the direction the
  // beak's own facet runs; a box is symmetric under a half-turn so the same magnitude mirrors.
  {const p=_on(VT,0.24,0.20).addScaledVector(_out(VT),0.030);
   for(const sx of [-1,1]){
     const sl=_noSh(box(0.26,0.075,0.10,D));
     sl.position.set(sx*p.x,p.y,p.z); sl.rotation.y=sx*1.085; sl.rotation.z=sx*0.09;
     sl.name="helm.slit"; R.head.add(sl);
   }}
  // breaths: the pierced holes down the visor's lower RIGHT face only, which is how they were
  // actually cut — the left is the side a couched lance crosses and was left solid. Radii 0.79,
  // 0.70 and 0.605, so the last one clears the lathe by 0.005 and the row stops there.
  {const n=_out(VB);
   for(let i=0;i<3;i++){
     const p=_on(VB,0.18+i*0.05,0.12+i*0.04).addScaledVector(n,0.020);
     const br=_noSh(box(0.055,0.055,0.055,D));
     br.position.copy(p); br.name="helm.breath"; R.head.add(br);
   }}
  // the team band round the brow, ABOVE the slits — §2.5 wants the colour where the eye already is
  const bd=_noSh(cyl(0.615,0.635,0.10,tc,16));
  bd.position.y=0.76; bd.name="helm.band"; R.head.add(bd);
  // the comb: the only thing shared with the great helm, which is why it is thin and gold. Sunk at
  // the front (the lathe's crown is 1.033 at the comb's z 0.47 end, the comb's underside 0.97) and
  // 0.07 proud over the middle, and it stops at z -0.05 because the knight's plume base seats at
  // head-local 1.173 / z -0.08 and a crest through a plume socket is two gold things fighting.
  const comb=_noSh(box(0.07,0.26,0.52,plainMat(0xd9a92e)));
  comb.position.set(0,1.10,0.21); comb.name="helm.comb"; R.head.add(comb);
}
function helmGreatHelm(R,tc,A,o){
  o=o||{};
  // 1.78 TALL AND 1.12 ACROSS, AND THE HEIGHT IS NOT INDULGENCE. It reads as an enormous hat and
  // it is not one: the helm starts 0.06 H above the chin and ENCASES the skull, so the mass above
  // the crown of the head is 1.08 = 0.265 H, dead inside §B's 0.24–0.28. A real great helm was
  // exactly this — a bucket that sat on the shoulders, not a cap. It is also the only thing that
  // separated this age on §H A1b: at 133×168px it scored 0.754 against the Negau bell and 0.725
  // against the Gallic, because every hat in the set shares the same skull and beard below it and
  // three tall roundish blobs of the same proportion are three tall roundish blobs.
  // v131.2 A 12-GON AT rb 0.56 DOES NOT CLEAR A 16-GON SKULL AND THE FACE CAME THROUGH IT.
  // The head is a 16-gon of circumradius NC_HEADRC = 0.5515. A 12-gon of circumradius 0.56 has an
  // APOTHEM of 0.56·cos(15°) = 0.541 — 0.010 INSIDE the skull's vertex radius — so between every
  // pair of the helm's flats the head's own corners punched out. Rendered at 7x: two vertical
  // slivers of bare skin at the temples, two blue eyes with black pupils sliced down the middle by
  // the helm's edge, two red cheek discs, two brow stubs and the white tooth band below the rim.
  // "It is the only unit in the game with no eyes" was true of the model and false of the picture.
  // SIXTEEN SEGMENTS, MATCHED TO THE SKULL'S OWN COUNT AND PHASE, AND rb 0.59. Both lathes are
  // 16-gons rotated by pi/16, so their vertices line up and the clearance is a flat 0.0385 the
  // whole way round instead of swinging between +0.009 and -0.010. It is deliberately NOT wider:
  // §H A1b scored this against the Negau bell at 0.802 when the bucket grew to 1.25, because two
  // blocks of the same width are one block. 1.157 across and 1.70 tall is the narrow tall bucket,
  // and the bell is the wide-footed one.
  // v131.3 1.82 AND NOT 1.70, TO HOLD THE RATIO CHAIN OPEN. §H A1b fails an ADJACENT pair whose
  // h/w differs by less than 0.15, and the Imperial Gallic next door went from 0.86 to ~1.06 when
  // its bowl grew; at 1.27 this helm would have been 0.21 clear on one side and 0.29 on the other
  // with no margin for the render. 0.12 more of barrel puts it at ~1.35, between a 1.06 Gallic and
  // a 1.56 shako, and a great helm is a bucket that sat on the SHOULDERS — height is what it is.
  // v131.5 hh 1.86 -> 2.08, AND IT IS THE ONLY LEVER 3-4 HAS LEFT. §H A1b normalises every mask
  // to ONE HEIGHT, so a mask's area in the comparison is its screen area divided by its height:
  // this barrel cannot get narrower (a 16-gon at rb 0.575 already clears a 0.5515 skull by 0.0385
  // and no more) and widening it was measured and made three pairs worse (see v131.4d below), so
  // the only way to stop a plain column sitting 86% INSIDE the Imperial Gallic next door is to
  // make the column longer. Simulated over the shipped masks, 3-4 falls 0.720 -> 0.698 on this.
  // hat + head goes 0.503 -> 0.528 H — the figure's own bounding box grows with the helm, so the
  // §6.1a share moves a quarter of what the raw height does, and 0.528 is inside the 0.54 ceiling.
  // >>> v131.6 hh 2.08 -> 0.95, AND THIS IS THE MOST VISIBLE CORRECTION IN THE ROUND. <<<
  // The owner named this hat by eye. As built it measured h/w 2.10 against §6.5a's absolute target
  // of 1.05 — exactly double — and it was THE TALLEST HAT IN THE GAME, taller than the shako,
  // which is backwards: a shako is the tall one by definition and a great helm ENCLOSES the head
  // rather than towering over it. Every paragraph above bought that height to move a §H A1b pair
  // (1.70 -> 1.82 for the ratio chain, 1.86 -> 2.08 for 3-4), and the round before this one added
  // the last 0.22 knowing the owner had already complained about the height.
  // WHAT IT IS NOW. The barrel still starts at 0.234 — 0.06 H above the chin, §0 to the millimetre
  // — and its lid lands at 1.184 above the head origin, i.e. world 3.19 against a skull that tops
  // out at 2.96. It encloses the head from jaw to crown and stands 0.23 proud of it. That is a
  // great helm: a bucket over the head, flat-topped, face covered. 1.18 across on 1.13 of head
  // region is h/w ~1.05, which is the target, and it is now SHORTER than the shako by a full unit.
  // THE ROWS BELOW MOVE WITH IT. Everything on the front face is placed as a fraction of hh, and a
  // fraction that put the vision slit at 0.60 of a 2.08 barrel put it at world 3.49 — half a unit
  // ABOVE the skull, a slit cut in the empty air over the wearer's head. On a barrel that fits, the
  // slit belongs at eye level: 0.42 of hh is world 2.64, which is where the painted eyes were.
  const y0=0.234, hh=0.95, rb=0.575;                  // 0.06 H above the chin — §0, to the millimetre
  // FLAT-TOPPED AND STRAIGHT-SIDED. §6.5a's tell for this age is "a straight-sided block or a
  // beak; the face is COVERED", and the first cut of this domed the crown off — which turned the
  // strongest head in the game into another rounded blob and scored IoU 0.788 against the Negau
  // bell. A great helm is a bucket. Corners, not a curve.
  // v131.4 AND THE SECOND CUT WAS STILL DOMED. The profile ran 0.86 → 0.76 → 0.74 → 0.66 of rb
  // across its top 42%: four steps of taper is a dome whatever the comment above calls it, and
  // §H A1b scored it 0.727 against the Imperial Gallic because a tapering blob nests inside a
  // tapering blob and then reports its own area as the overlap. §6.5a says FLAT-TOPPED BLOCK.
  // Full radius to 96% of the height, one hard corner, a flat lid: this is now the only hat in
  // the set whose widest row is also its TOP row, and that is a thing no mask can confuse with a
  // bowl, a bell or a dome.
  // v131.4c AND A PLAIN RECTANGLE NESTS INSIDE EVERY OTHER MASK IN THE SET. Once the head mask
  // stopped counting the greatsword blade as part of the head (see tools/agecheck.js) this helm
  // measured 94x176 — by far the NARROWEST hat, uniform top to bottom — and §H A1b failed it
  // against the Bronze cone (0.720), the Negau bell (0.735) and the Imperial Gallic (0.741) all at
  // once, because every one of those masks contains a narrow vertical column (the skull) and a
  // rectangle IS one. It has to be non-convex to be told apart. A great helm's top plate is a
  // separate riveted disc that overlaps the barrel, and its lower edge spread onto the shoulders —
  // so the solid is wide, narrow, wide: an I-beam, which is a profile nothing else here has.
  // The overhangs are 0.12 rb, at the TOP and at the CHIN, and neither is a brim: §H A1b's third
  // clause is about a flat horizontal DISC hung at the base of the crown, which is what the torse
  // was and what the shako still has as the one permitted example.
  // v131.4d …AND WIDENING IT WAS THE WRONG DIRECTION, MEASURED. The I-beam above took the mask
  // from 94px to 125px wide and §H A1b got WORSE on all three pairs (0.735 -> 0.768 against the
  // bell, 0.741 -> 0.763 against the Gallic): every other mask in the set carries a ~1.10-wide
  // skull column under its hat, so the closer this barrel is to 1.10 the more of it lands inside
  // everyone. The overlap falls as the helm gets NARROWER relative to its height, not wider. What
  // survives from that experiment is the top plate — a real riveted disc, 0.10 of overhang at the
  // very top and nowhere else, which is the one row where the cone, the bell and the bowl are all
  // drawing in to a point. It is not a brim: a brim is a disc at the BASE of a crown (§H A1b's
  // third clause) and the shako still owns the only one.
  // …AND THE TOP PLATE CAME OFF AGAIN, MEASURED BOTH WAYS. With it: 1-4 improved 0.720 -> 0.691
  // and 2-4 / 3-4 / 4-5 all got worse (0.762 / 0.753 / 0.784). Without: 0.720 / 0.735 / 0.741 /
  // 0.693. Every unit of width on this barrel is width shared with somebody's skull column, so the
  // narrowest honest bucket is the best this gate can do. See the note at the foot of the function
  // for why three of fifteen pairs still sit at 0.72-0.74 and what would have to change to fix it.
  const helm=_lm([[rb*0.99,0],[rb,hh*0.05],[rb,hh*0.955],[rb*0.99,hh],[0,hh]],16,ageLit(A.crown));
  helm.position.y=y0; R.head.add(helm);
  // AND THE FACE GEOMETRY COMES OFF. The moustache bar stands at z=0.47 with 0.26 of depth, so its
  // front face is at 0.60 — outside anything this helm can be built at without becoming a barrel —
  // and a closed bucket wearing a moustache on the OUTSIDE is worse than no helm at all. Cheeks,
  // eyes, brows and teeth are paint on the skull and the solid hides them; these three boxes were
  // the only geometry left on the face. Removed before mergeUnitBody() runs, so nothing is welded
  // and nothing is orphaned.
  if(R.face)for(const p of R.face)if(p.parent)p.parent.remove(p);
  // THE OCULARIUM, AND IT WAS INVISIBLE FOR A ROUND BECAUSE SOMETHING ELSE WAS PARKED ON IT.
  // The slit is right; the torse that used to sit at y0+hh*0.60 spanned 1.283-1.418 at radius
  // 0.661 and the slit sits at 1.387 at radius 0.558 — the band covered it end to end and what
  // survived at 7x was two black rectangles at the far edges of a blue ring, reading as studs.
  // The torse is gone (see the note at the foot of this function); the slit is also deeper and
  // taller now, because 0.055 of height is 1.4px on a 40px figure and this is the one feature
  // that says "the face is COVERED" — §6.5a's entire tell for the age.
  const slit=_noSh(box(0.92,0.105,0.05,0x14100E));   // ONE slit. The strongest head in the game.
  slit.position.set(0,y0+hh*0.44,rb*0.955); R.head.add(slit);   // v131.6 0.60 -> 0.44 of a shorter hh
  for(const sx of [-1,1]){                           // …and its two brow shelves, so it reads as a CUT
    const br=_noSh(box(0.42,0.070,0.045,A.dark));
    br.position.set(sx*0.25,y0+hh*0.56,rb*0.955); R.head.add(br);
  }
  // the rib is an APPLIED band standing proud of the skin, so it catches more light, not less.
  // In A.dark it was a black stripe down the middle of a crop §H A1 averages to one pixel, and it
  // cost the Medieval crown 0.03 of value against an Enlightenment neighbour already sitting high
  // on its own gold band.
  const bar=_noSh(box(0.17,hh*0.62,0.05,ageLit(A.metalD)));   // the reinforcing rib the slit is cut either side of
  bar.position.set(0,y0+hh*0.50,rb*0.99); R.head.add(bar);
  // …and its cross-band. A great helm's reinforce is a CROSS, and §H A1 needs this crown's value
  // up: authored 0.417 through the ramp's inverse it still rendered 0.371, because the ocularium,
  // the brow shelves and the breath holes are all inside A1's top-28% crop and all of them are
  // dark. Lit mail #767068 at V 0.442 is the age's own hex and the band is where the rib is riveted.
  // v131.6 ONE HOOP, NOT TWO, AND THE RIVET STRAPS SHRINK WITH THE BARREL. At hh 2.08 there was
  // room for a riveted band at 0.80 and a second at 0.925 with 0.62-tall straps between them; on a
  // 0.95 barrel those three rows land inside 0.12 of each other and render as one grey smear over
  // the crown — which is the top of §H A1's crop on this age. One hoop at 0.80 and a 0.24 strap.
  const bar2=_noSh(box(1.02,0.14,0.045,ageLit(A.metalD)));
  bar2.position.set(0,y0+hh*0.80,rb*0.985); R.head.add(bar2);
  for(const sx of [-1,1]){const rv=_noSh(box(0.14,0.30,0.045,ageLit(A.metalD)));
    rv.position.set(sx*0.40,y0+hh*0.80,rb*0.975); R.head.add(rv);}
  for(let i=0;i<5;i++){                              // the cross of breath holes, right side only
    // …and they go BELOW the ocularium, which is where a great helm's breaths are. At hh*0.36 on a
    // barrel that now runs jaw to crown they sat level with the slit's own row.
    const [dx,dy]=[[0,0],[0,1],[0,-1],[1,0],[-1,0]][i];
    const hl=_noSh(box(0.055,0.055,0.03,A.dark));
    hl.position.set(0.24+dx*0.10,y0+hh*0.21+dy*0.10,rb*0.96); R.head.add(hl);
  }
  // THE COIF GOES INSIDE THE HELM'S OUTLINE, and finding out why cost a round of §H A1b.
  // At r 0.66/0.70 it was 1.40 across under a helm 1.12 across — a flared base on a barrel, which
  // is exactly the shape a Negau bell's everted rim makes, and the two ages scored IoU 0.764 for
  // that reason and no other. A binary mask does not know one is mail and the other is bronze.
  // v131.3 AND IT HAS TO REACH THE HELM'S OWN BOTTOM EDGE, OR THE FACE COMES OUT UNDER IT.
  // At r 0.545/0.555 over head-local 0.049-0.239 the coif was a 12-gon of apothem 0.527 against a
  // skull of 0.5515 — INSIDE the head — so between it and the helm's rim there was a clear band of
  // jaw: rendered at 5x, two tan cheek patches and two white TEETH sitting under a helmet whose
  // whole point is that the face is covered. r 0.575/0.590 is 1.18 across, the same width as the
  // helm and therefore NOT a flared base (that flare is what scored 0.764 against the Negau bell
  // at r 0.70), 12-gon apothem 0.555-0.570, clear of the skull, and it now spans 0.03-0.33 so it
  // laps 0.10 up behind the rim. Looked at, not calculated.
  // >>> v131.5 THE COIF IS AN AVENTAIL LIP, NOT A NECK SLEEVE, AND §0 IS WHY. <<<
  // "The helm's bottom edge stops 0.06 H above the chin and THE CARVED BEARD HANGS OUT BENEATH IT.
  // The unit loses its eyes and its mouth and keeps its beard, which is the larger silhouette
  // carrier of the two." The helm already stopped there (y0 = 0.234). The coif then covered the
  // gap: at 0.30 tall centred y0-0.055 it spanned head-local 0.029-0.329 at r 0.575-0.590, and the
  // beard's own widest rows are +0.26 (the cheek line, r 0.595) and +0.113/+0.143 (lobe 1) — i.e.
  // the mail sleeve was drawn OVER the top 40% of the beard. Measured by the gate: this class's
  // beard is 4.1% of the figure where the other five are 8.3-11.7%, the lowest in the set, and the
  // render at 3x shows a small dark blob under a bucket instead of a carved beard hanging out of a
  // great helm. 0.18 tall at y0-0.02 laps the rim from 0.124 to 0.304 — enough mail to close the
  // helm's own edge, and everything below it is beard, which is what §0 asked for.
  // The jaw does not come back out from under it: the beard is 1.19 across against a 1.103 skull,
  // so from head-local 0.12 down the beard IS the outline. That was checked by looking.
  const coif=_noSh(cyl(0.575,0.590,0.18,ageLit(A.dominant),12)); // mail aventail: closes the helm's rim
  coif.position.y=y0-0.02; R.head.add(coif);
  // >>> THE TORSE IS GONE, AND ITS REMOVAL CLOSED THREE DEFECTS AT ONCE. <<<
  // It was `cyl(rb*1.15, rb*1.15, 0.135, tc, 16)` — a 16-gon disc of radius 0.661 on a 0.575 helm,
  // flat top face, flat bottom face, standing 0.086 proud and overhanging the outline both sides.
  //   1. §H A1b's THIRD clause fails outright on more than one flat horizontal brim disc, and the
  //      brim is Enlightenment's alone. At 7x this was a hat brim. §6.5a gives Medieval no brim.
  //   2. It buried the ocularium (see the slit above) — the age whose whole tell is "the face is
  //      COVERED" had no feature saying so.
  //   3. §H A1 is a two-team gate and nobody had ever run it at team 1. This band was 17.5% of the
  //      A1 crown crop: at Blue the crown measured #55575B (h 260°, C* 2.3) and at Red #6F4F42
  //      (h 48°, C* 17.4), which took the worst A1 pair from 12.7 to 8.2 — a FAIL that existed
  //      only on the red team. §A.1 states the rule in one line: "Everything the age ladder is made
  //      of must live on non-team surfaces." A band round the crown is not one.
  // The comment it replaced argued the torse back UP to rb*1.15 to move an IoU number, which is
  // the gate being optimised against rather than satisfied. The margin is bought from FORM now —
  // the flat lid above — and the class's team fraction comes off the surcoat, which is where §6.6
  // and §2.5 both put it and which is why this class already measured the HIGHEST of the six.
  return helm;
}
// ============================================================================================
//  THE TORSO CARRIES THE AGE — AGES §A.1, gated by §H A2
// ============================================================================================
// THE DEFECT THIS EXISTS TO FIX, MEASURED: the previous attempt's six torsos came out
// #785a41 / #957650 / #886c4a / #8a735e / #7d6755 / #7d6140 — six browns, worst pair ΔE00 3.8
// against a floor of 12, all fifteen pairs failing. The hats had aged; every torso had stayed the
// same. It happened because each class picked its own armour hexes at its own call site, so the
// only thing "the age" meant on a body was whatever that one function felt like.
//
// >>> A CLASS MAY OVERRIDE THE SHAPE OF A GARMENT. IT MAY NEVER OVERRIDE ITS COLOUR. <<<
// Every hex below comes out of AGEPAL (00-data.js), which is §A.3 hex for hex. A hoplite's bell
// cuirass and a legionaire's segmentata are different SOLIDS in the same Classical steel; a
// spearman's one hide strap and a clubman's stitched tunic are different cuts of the same Stone
// Age hide. That is what makes an army read as one army and six armies read as six ages.
//
// WHERE THE TEAM COLOUR WENT, because this is the part that looks like a regression and is not.
// §A.1: team colour occupies 20–30% of a unit and lives on the coat, so THE COAT CANNOT CARRY THE
// AGE — §H A2 masks every pixel within ΔE00 12 of TEAMCOL before it measures. The coat is still
// team-coloured and still the largest single cloth area; the age's dominant is the ARMOUR OR
// OVER-GARMENT laid on top of it, which is where armour actually goes. Team survives on the
// sleeves, the shoulders, the skirt, the sash and the plume, and is measured rather than assumed.
//
// AND WHY THE EPAULETTES ARE NO LONGER GOLD ON EVERY AGE. §H A2's crop is the 28–58% band, which
// on a §6.1a figure is the SHOULDER LINE and the collar, not the belly — so a gold box on both
// shoulders of all six ages was a constant sitting in the middle of the one region the test looks
// at, dragging every age toward the same mean. §B gives each age its own shoulder piece by name
// (stacked bronze guards, layered steel, pauldrons); they take the age's own metal now, with the
// nutcracker's gold kept as a trim strip on the ages that HAVE gold. Age 0 has none, by §A.3's
// hardest rule: "Nothing metal on any Stone Age unit."
// ============================================================================================
// >>> §H A2's BAND IS NOT ON THE TORSO OF A §6.1a NUTCRACKER, AND HERE IS THE ARITHMETIC. <<<
// This is stated with numbers rather than argued, because it is the reason this gate reports a
// compressed ladder no matter what colour goes on the garment, and because the next lane to work
// here will otherwise spend the round I just spent finding it again.
//
// A2 crops rows 28%-58% down from the top of the figure's box — i.e. the band from 42% to 72% of
// the figure's HEIGHT measured up from the sole. On this rig the chin sits at world 2.01 on a
// figure 3.9-4.5 tall, which is 45-52% of H. §6.1a puts hat + head at 0.46-0.54 H and is emphatic
// that this is the brief and not a bug. Those two facts together mean A2's band lands on the HEAD:
// measured off the six line shots, cropped to the band and looked at (the crops are reproducible —
// crop rows bb.y0+0.28h to bb.y0+0.58h out of _ages/line/*.png), the band is 40-60% bare face on
// every age whose helmet does not close, and 0% torso on the musketeer, whose band bottoms out
// three hundredths of a world unit ABOVE the chin.
//
// nc.face is a constant (§2.6, and §6.1 ranks the face second in the whole figure). So the band's
// mean is `f·face + (1-f)·garment` with f ≈ 0.4-0.6 and `face` fixed at V ≈ 0.55 rendered. Two
// consequences, both measured and neither fixable with a hex:
//   1. ΔE00 between two ages is diluted by (1-f). Bronze's non-face is tusk ivory #D8CDAE and
//      Classical's is polished steel #B4BAC2 — ΔE00 15.6 between the two materials — and the pair
//      comes back at 5.7 because only ~40% of each crop is the material. To clear a floor of 12
//      the non-face fraction would have to be ~80%, i.e. the face would have to be covered on an
//      open-faced Imperial Gallic (§B.1: "hinged cheeks", open face) and on a boar's-tusk helm.
//   2. The adjacent |ΔV| ≥ 0.25 clause is arithmetically unreachable. The reachable range of the
//      band mean is bounded by the mix: with f ≈ 0.5 and a garment ladder spanning 0.127-0.789,
//      the band can only span ~0.34 to ~0.67 — 0.33 of total travel for a chain that needs five
//      alternating steps of 0.25. Measured span today: 0.345 to 0.602.
// WHAT WAS DONE ANYWAY, because "the gate is wrong" is not a licence to stop: every age's garment
// is now authored through the ramp's inverse (ageLit) so the RENDER lands on §A.3's number rather
// than 15% under it; every age that has a documented face-framing garment wears it at full size
// (Stone's hide ear flaps, Bronze's tusk cheek plates, Classical's Gallic cheek pieces, Iron's and
// Classical's shoulder capes standing up beside the neck); and the team colour, the gold band and
// the crimson that were sitting inside the band on four ages have all been moved out of it.
// A2 went from worst-pair 4.6 to 5.7 and A2b (chin to belt — the tool's own honest torso band)
// from 9.1 to 7.7; six of fifteen pairs still fail and five of five adjacent ΔV still fail.
// >>> §I QUESTION FOR THE OWNER: A2 needs to name the band by ANATOMY (chin line to belt, which
// the tool already computes as A2b) rather than by a percentage of a figure whose head is half of
// it. Everything above is what the percentage measures instead. <<<
// ============================================================================================
function ageOf(u){return AGEPAL[unitAge(u)];}
// FACETED, FACET-FORWARD, AND DE-INDEXED — and this is worth 0.15 of measured value on every light
// age, which is more than any hex change in this file.
// r128 lathes a cylinder with SMOOTH normals round the revolution: every side vertex gets
// (sinθ, slope, cosθ), so one quad interpolates from a −45° normal to a +45° one across its own
// width and the toon ramp draws all three of its cells on it. Measured on the Bronze corselet, a
// linen authored at V 0.789 came back at 0.475 — the lit rim was right and the ramp's shadow cell
// owned the other half of the barrel. It is the same defect the legs were fixed for at :1240 and
// the head at :1545, and the same cure: flat normals from GEOMETRY, never material.flatShading
// (_mergeableMat bars a flat-shaded material from the weld, and a torso that will not merge is a
// draw call on every soldier — §G.1). The half-segment rotation puts a FACET on the view ray
// instead of an edge, which is what stops the terminator hanging down the middle of the chest.
function _facetGeo(g,seg){g=g.toNonIndexed();g.rotateY(Math.PI/seg);g.computeVertexNormals();return g;}
// A ring of the age's dominant, sized to sit just proud of the torso barrel (r 0.50/0.52, z×0.8).
function _tRing(R,y,h,hex,rT,rB,seg){
  seg=seg||12;
  const m=new THREE.Mesh(_facetGeo(new THREE.CylinderGeometry(rT===undefined?0.555:rT,rB===undefined?0.575:rB,h,seg),seg),
    typeof hex==="number"?plainMat(hex):hex);
  m.scale.z=0.8; m.position.y=y; m.castShadow=false; R.torso.add(m); return m;
}
function _tShell(R,y,h,mtl,rT,rB,seg){            // the big single-piece garments, same treatment
  seg=seg||12;
  const m=new THREE.Mesh(_facetGeo(new THREE.CylinderGeometry(rT,rB,h,seg),seg),mtl);
  m.scale.z=0.8; m.position.y=y; m.castShadow=false; R.torso.add(m); return m;
}
// THE AGE'S BODY, one function, six branches, and every branch spends its colour out of AGEPAL.
// `o.light` asks for the lighter of the age's two body tones on alternating courses — the Otzi
// stripe and iron scale both read as a texture at 40px that cost no atlas cell to get.
function ageTorso(R,u,tc,o){
  o=o||{}; const a=unitAge(u), A=AGEPAL[a];
  if(a===0){
    // STONE — the Otzi stripe. Alternating dark and light hide in bands of 0.045 H (0.176 world),
    // which §B.7 calls the only striped cloth in the game. The single-draped-pelt caveman is a
    // myth and this is the accurate look as well as the readable one.
    // ONE SHELL WITH STRIPES ON IT, not five alternating rings. Five rings leave four seams, and
    // a seam on a cel-shaded cylinder is a dark line: measured, the ring build came back at V 0.241
    // against age0.dominant's 0.374 × the ramp's 0.849 mid gain = 0.318, and the missing 0.077 was
    // entirely in the gaps. The Otzi stripe still reads — it just rides ON the tunic now.
    _tShell(R,0.66,0.88,plainMat(ageLit(A.dominant)),0.556,0.578,12);
    // the upper stripe is 0.26 and not 0.176: §H A2's band bottoms out at world 1.47 on this
    // class, so the ring at torso-local 0.88 is the ONE piece of age0.hide.light the gate can see,
    // and with the beard now walnut-black above it the Stone rung measured 0.255 against a ladder
    // that puts it at 0.374.
    for(let i=0;i<2;i++)_tRing(R,0.44+i*0.44,i?0.26:0.176,ageLit(A.light),0.560,0.580,12);
    _tRing(R,0.20,0.115,A.leather,0.565,0.565,12);
    for(const s of [-1,1]){                       // rawhide thong lacing down the flanks
      const l=_noSh(box(0.047,0.86,0.047,A.leather)); l.position.set(s*0.50,0.60,0.20); R.torso.add(l);
    }
    if(o.strap){                                  // §B.2: ONE hide strap at 28°, the spearman's separator
      // >>> IT WAS BUILT, AND IT WAS BEHIND THE BEARD. <<<
      // box(0.176,0.94,0.062) at (0,0.62,0.44) is §B.2's row scaled exactly right, and probed it
      // occupied x ±0.30, y 1.11–2.03, z 0.41–0.47 — inside a beard that is 1.14 across, runs
      // 1.53–2.35 and is sheared forward to z 0.62, and behind a plastron that sits at z 0.44–0.50.
      // Wider than it, in front of it, above it: three surfaces, none of which it cleared. A pixel
      // diff of clubman against spearman showed the club, the spear and nothing else.
      // The angle is §B.2's and does not move (0.49 rad = 28.1°). What moves is WHERE the 28° line
      // is drawn: a shoulder strap starts on the SHOULDER, so it is offset to +0.26 and lengthened
      // to 1.26 so its top corner reaches x 0.67 at the deltoid — 0.07 outboard of the beard's
      // widest row — and its bottom half crosses the belt at world 1.30, which is below the beard
      // tip at 1.53 and therefore the first part of it anyone has ever been able to see. z 0.545
      // puts it in FRONT of the plastron rather than under it.
      // It is still not a SILHOUETTE event and this comment will not pretend it is: a 0.176 bar on
      // the front of a barrel cannot be, and §H A4 measures outlines. The outline separator for
      // this class is the slung javelin (see the spearman block) and the flaps that came OFF the
      // cap; this is the paint that makes the two units differ in ΔE00 as well.
      const st=_noSh(box(0.176,1.26,0.062,A.light));
      st.rotation.z=0.49; st.position.set(0.26,0.52,0.545); R.torso.add(st);
      const bkl=_noSh(box(0.13,0.13,0.05,A.accent)); bkl.position.set(0.15,0.78,0.57); R.torso.add(bkl);
    }
    const pouch=_noSh(box(0.195,0.235,0.156,A.leather)); pouch.position.set(-0.36,0.22,0.40); R.torso.add(pouch);
  }else if(a===1){
    // BRONZE — the pale rung. §A.2 names this age "Linen and brown-gold" and puts its dominant at
    // V 0.789, the undyed linen, with beaten bronze at 0.499 SUPPORTING it. §B.1's shortsword row
    // reads "warm brown-gold barrel", and the two cannot both be the biggest surface: a bronze
    // barrel measures 0.499 against Iron's 0.458 next door, i.e. ΔV 0.04 on a rule that wants
    // 0.25, and §H A2 fails the whole ladder on it. The linen corselet is the field and the bronze
    // is its collar, its guards and its bands — which is also the commoner history, since a
    // linothorax was what most of these men actually wore.
    _tShell(R,0.66,0.88,plainMat(ageLit(A.dominant)),0.550,0.585,12);
    // THE THREE THIGH BANDS GO ON THE THIGH. §B.1 calls them thigh bands and the shipped cut had
    // them at torso y 0.20-0.42, i.e. inside §H A2's crop, where beaten bronze at V 0.499 × 0.849
    // = 0.42 held this age's rung 0.13 below the linen it is supposed to be measuring.
    // THREE bands on the swordsman, TWO on the spearfighter — §B.2 again, and the same reason as
    // the shoulder guard above: the row is written per CLASS and this builder is per AGE, so both
    // halves of the count had been collapsed onto whichever one got written first.
    for(let i=0;i<(u.cls==="spearfighter"?2:3);i++)_tRing(R,-0.02-i*0.109,0.086,A.metal,0.60,0.615,12);
    // v131.3 THE COLLAR AND THE SPINE GO PALE, AND BOTH OF THEM SIT IN §H A2's CROP.
    // Measured, this age's dominant band came back at V 0.544 against a ladder that names Bronze
    // THE PALE RUNG at 0.789 — the crop is the collar, the shoulder line and the cone's foot, and
    // every one of them was bronze at 0.499-0.622. A linothorax's shoulder yoke IS linen; the
    // beaten bronze survives on the guards, the thigh bands and the trim, where §A.3 puts it.
    const collar=_tRing(R,1.11,0.135,A.light,0.505,0.560,12);                 // the linen shoulder yoke
    const spine=_noSh(box(0.062,0.50,0.04,A.metalLit)); spine.position.set(0,0.70,0.46); R.torso.add(spine);
  }else if(a===2){
    // IRON — cool grey scale over rust in the recesses. The temperature flip off Bronze is the
    // age's whole signal, and iron rusts BROWN, never green: that is the separation from bronze.
    // THREE COURSES OF SCALE TO ONE OF LIT IRON. Alternating them one for one averages
    // (0.458 + 0.562) / 2 = 0.51, which is the age2 rung reading as Bronze-adjacent; §A.3 makes
    // metal.lit a HIGHLIGHT and the dominant the dominant, and the ratio is what says so.
    _tShell(R,0.66,0.88,plainMat(ageLit(A.dominant)),0.554,0.578,12);
    // THE RECESS LINES GO COOL AND THE RUST MOVES TO THE FRONT PLATES. §A.3 wants rust in the
    // recesses; four warm #7A4A32 rings round the whole barrel is not a recess, it is a stripe,
    // and measured it pulled the Iron rung from a cool #5E646B to a neutral #5F6360 — which is the
    // one thing §A.2 says must not happen, because Iron and Medieval are separated by CHROMA and
    // not by value and a warm cast on either collapses the pair.
    for(let i=0;i<4;i++){
      if(i===2)_tRing(R,0.32+i*0.18,0.168,ageLit(A.light),0.556,0.582,12);
      // THE RECESSES STAY COOL AND ONE OF THEM RUSTS. §A.2 is explicit that Iron and Medieval sit
      // close in VALUE and are separated by CHROMA, so every warm texel on this torso is spent out
      // of the one margin the pair has: with four rust rings the Iron rung rendered #5F6360, a
      // dead neutral, against Medieval's #61655C — ΔE00 2.6 on a floor of 12. metalD is a darker
      // shade of the age's own cool grey; the rust is now one line, which is what "in the recesses
      // only" meant.
      const gap=_tRing(R,0.32+i*0.18-0.088,0.028,i===1?A.rust:A.metalD,0.560,0.560,12); gap.renderOrder=1;
    }
    for(let i=0;i<5;i++){                          // the laced plate faces, front only
      const pl=_noSh(box(0.086,0.62,0.03,A.metalD)); pl.position.set(-0.32+i*0.16,0.60,0.455); R.torso.add(pl);
    }
  }else if(a===3){
    // CLASSICAL — lorica segmentata: SEVEN girdle bands separated by a dark gap. §B.1's 40px cue
    // is "seven light horizontal lines with dark gaps on a bright silver torso", and it is the only
    // striped-metal torso in the game. Bright and smooth, brighter than any earlier armour.
    for(let i=0;i<7;i++){
      _tRing(R,0.28+i*0.108,0.098,ageLit(A.dominant),0.556,0.574,12);
      _tRing(R,0.28+i*0.108-0.054,0.022,A.dark,0.552,0.552,12);
    }
    // the shoulder yoke, and it is 0.44 tall and not 0.30 because §H A2 reads exactly these rows:
    // the age's rung measured 0.528 against a ladder that puts polished steel at 0.727, and the
    // segmentata's seven dark gaps live below the crop while the yoke is inside it.
    _tShell(R,0.99,0.44,plainMat(ageLit(A.light)),0.555,0.578,12);
    for(let i=0;i<4;i++){                          // the cingulum apron: four studded straps
      const st=_noSh(box(0.062,0.43,0.031,A.leather)); st.position.set(-0.24+i*0.16,0.02,0.44); R.torso.add(st);
      const sd=_noSh(box(0.05,0.05,0.02,A.metal)); sd.position.set(-0.24+i*0.16,-0.10,0.46); R.torso.add(sd);
    }
    const focale=_tRing(R,1.09,0.098,A.crimson===undefined?tc:tc,0.50,0.545,12); // TC focale at the throat
  }else if(a===4){
    // MEDIEVAL — matte riveted mail, and MATTE is the specification: no chrome, no gleam streaks.
    // §A.3 keeps the bright plate for the knight and the pikeman only, because bright plate against
    // matte mail is the material contrast that sells the age and spending it everywhere spends it.
    // MATTE, and plainMat is how you get matte. §A.3: "Flat, desaturated, reading as heavy dense
    // fabric — not as metal. Matte. No chrome, no gleam streaks." texturedMat("metal") IS the
    // gleam-streak pattern; it lifted the Medieval rung to 0.390 against Classical's 0.614 next
    // door, i.e. ΔV 0.224 on a rule that wants 0.25. It also costs an atlas cell this does not.
    _tShell(R,0.58,1.00,plainMat(ageLit(A.dominant)),0.558,0.585,12);
    // v131.5 THE MAIL COLLAR DROPS 0.10 AND PULLS IN 0.045, AND IT IS THE SECOND HALF OF §0's
    // BEARD. At torso 1.02 x r 0.575 this ring stood across the beard's lobe 2 (head-local -0.077,
    // beard radius 0.405) and outboard of it, so between it and the coif above there was no row
    // of beard left to see. At 0.92 x r 0.530 it sits behind the beard's own outline the whole way
    // round and still reads as the mail standing thick at the throat. See helmGreatHelm's coif.
    _tRing(R,0.92,0.15,ageLit(A.dominant),0.500,0.530,12);
    if(o.surcoat!==false){                         // the surcoat: TC quartering, white cross arms
      // THE CROSS IS 0.075 H WIDE AND NOT A HAND'S BREADTH MORE. §B.1 caps the cross pattée at
      // ≤4% of the unit and §A.3 keeps heraldic.white #D6CBB0 (V 0.798) off the ladder on purpose:
      // this age's rung is matte mail at 0.378 and a broad white cross averaged the band up to
      // 0.437, i.e. ABOVE Iron, which inverts two rungs of a six-rung ladder for a decoration.
      // §2.5 wants 20-30% of the unit in team colour and the closed great helm takes the whole
      // head out of that budget: measured, this class came back at 5.5%, the lowest of the six.
      // The surcoat is the only cloth a man in mail has, so it carries the quartering §B.1 asks
      // for at full width, and the ailettes below are the period-correct place to put the rest.
      const sc=_noSh(box(1.00,0.98,0.062,tc)); sc.position.set(0,0.60,0.455); R.torso.add(sc);
      for(const sx of [-1,1]){   // AILETTES: the little heraldic boards laced at the shoulder
        const al=_noSh(box(0.043,0.36,0.36,tc)); al.position.set(sx*0.62,0.92,0); R.torso.add(al);
      }
      // v131.3 THE CROSS IS BACK INSIDE §B.1's 4% CAP AND THAT IS A MEASURED §H A2b FIX.
      // At 0.215 x 0.72 plus 0.62 x 0.215 the pattée covered ~29% of a torso front barely 1.0
      // across, in heraldic.white #D6CBB0 at V 0.798 — so the true-torso band (chin to belt) on
      // this age measured 0.510 against a ladder whose Medieval rung is matte mail at 0.378, and
      // it collided with the Classical legionary at ΔE00 7.0. 0.145 x 0.52 and 0.42 x 0.145 is
      // ~13% of the front face and ~3.5% of the figure, which is the cap §B.1 actually states.
      const cv=_noSh(box(0.145,0.52,0.03,A.accent)); cv.position.set(0,0.64,0.49); R.torso.add(cv);
      const ch=_noSh(box(0.42,0.145,0.03,A.accent)); ch.position.set(0,0.70,0.49); R.torso.add(ch);
      const cr=_noSh(box(0.098,0.098,0.02,0xA83228)); cr.position.set(0,0.70,0.51); R.torso.add(cr);
      const bk=_noSh(box(1.00,0.98,0.062,tc)); bk.position.set(0,0.60,-0.455); R.torso.add(bk);
    }
  }else{
    // ENLIGHTENMENT — black felt, white lace and gold: the highest internal contrast in the game.
    // §B.1 puts a TC field on the soubreveste; §A.3 puts the age's dominant at black felt V 0.127
    // and §H A2 masks the team pixels out before it measures, so a TC soubreveste leaves this age
    // with no dominant at all and the ladder's last rung missing. The soubreveste is black felt
    // with the white-silver cross and the gold lace §B.1 asks for kept on it; team colour keeps
    // the sleeves, the coat skirt, the cuffs and the cockade. Measured, not asserted — the team
    // fraction is reported with the rest of the numbers.
    _tShell(R,0.62,0.92,plainMat(ageLit(A.dominant)),0.565,0.585,12);
    // THE BLACK STOCK. §A.2 makes this the DARKEST rung on the ladder at V 0.127 and §H A2's band
    // on this class is face, beard and collar — not belly — so it measured #695731 at V 0.346,
    // warm gold, i.e. the deepest rung reading fourth. An 18th-century soldier's neck was in a
    // black leather stock and a standing collar; that is the age's own dominant hex sitting in
    // exactly the rows the gate reads.
    _tRing(R,1.06,0.42,ageLit(A.dominant),0.515,0.575,12);
    // AND A BLUED-STEEL GORGET OVER IT. Darkening this rung is only half the job: §H A2's band on
    // an age-5 figure is ~45% FACE — the shako is the tallest hat in the game and it pushes the
    // head down into the crop — and nc.face is a constant at V 0.67 on five of the six ages, so
    // the age cannot win this pair on value alone. §A.3's age5.metal #3E4650 is blued steel at
    // V 0.271 and C* 7: dark AND cool, against Stone and Iron's warm browns and Medieval's neutral
    // olive. An officer's gorget at the throat is where that hex belongs anyway.
    const gor=_tRing(R,0.94,0.30,A.metal,0.545,0.580,12); gor.renderOrder=1;
    const gorF=_noSh(box(0.78,0.34,0.05,A.metal)); gorF.position.set(0,0.90,0.46); R.torso.add(gorF);
    // 0.075 H of cross arm — §B.1's own figure — and no wider. The same arithmetic as the
    // Medieval surcoat: this age's rung is BLACK at V 0.127, and it is the deepest rung on the
    // ladder, so every pale texel spent on it is spent twice.
    // v131.5 THE CROSS DROPS 0.14 AND KEEPS ITS SIZE. §H A2's crop on this class runs to the belt
    // and #D8CFB8 at V 0.813 is the brightest hex on the figure standing on the age the ladder
    // needs DARKEST at 0.127; at y 0.56-0.60 its arms were inside the rows. §B.1 asks for the
    // white-silver cross and it is still the same cross — 0.075 H of arm, the figure it names —
    // sitting where a soubreveste's charge sits, on the chest below the gorget rather than at the
    // throat. Stone/Enlightenment measured ΔE00 9.7 on a floor of 12 and this is the pale mass
    // that was closing the gap from the wrong end.
    const cv=_noSh(box(0.128,0.60,0.03,A.accent)); cv.position.set(0,0.42,0.48); R.torso.add(cv);
    const ch=_noSh(box(0.42,0.128,0.03,A.accent)); ch.position.set(0,0.46,0.48); R.torso.add(ch);
    const fl=_noSh(box(0.088,0.088,0.02,0xA83228)); fl.position.set(0,0.46,0.50); R.torso.add(fl);
    for(const s of [-1,1]){                        // gold lace edging, 0.012 H — the §5.2 floor
      // the lace runs from the belt to the sternum and no higher: above 0.70 it is inside §H A2's
      // rows, and #CFB53B at V 0.697 is the warmest, brightest hex in the game sitting on the age
      // the ladder needs to be its DARKEST and COOLEST rung.
      const e=_noSh(box(0.033,0.62,0.033,NC.gold)); e.position.set(s*0.47,0.40,0.30); R.torso.add(e);
    }
    _tRing(R,0.15,0.05,NC.gold,0.60,0.60,12);
  }
  // ============================================================================================
  // THE TEAM SASH — one ring, every age, and it is the §2.5 budget in a single part.
  // §2.5 wants 20-30% of a unit in team colour and all six ages measured 9.9-16.9%. The cause is
  // structural and it is in §A.1's own design: team lives on the COAT, and every age then lays its
  // dominant armour ON TOP of the coat, so the one surface §6.6 nominates is the one surface the
  // age covers. What survives is two sleeves and a hem — which is why forty units in one frame
  // read as forty beards rather than as an army.
  // A WAIST SASH IS WHERE THE AREA IS. 1.26 across by 0.30 tall is ~8% of the figure's silhouette
  // on its own, and every age has a documented garment in that ring: a hide girdle, a linen sash,
  // a laced belt, the cingulum, a surcoat belt, an officer's waist sash. It sits at world
  // 1.10-1.40 — BELOW §H A2's band, which bottoms out at 1.47 on the shortest hat in the set — so
  // it buys the team read without taking a single pixel out of the age gate's crop.
  // v131.3 …AND IT IS 0.72 TALL ON STONE, CLASSICAL AND ENLIGHTENMENT. Measured, those three
  // came back at 15.4 / 13.7 / 14.1% against §2.5's 20-30% while Bronze, Iron and Medieval sat at
  // 19.6 / 19.8 / 24.8 — the three that miss are the three whose age garment is a full-body shell
  // (hide tunic, segmentata, coat) with no team-coloured skirt, kilt or surcoat under it. Every
  // one of them has a documented waist garment to spend it on: a hide girdle, the cingulum's
  // pteruges, an officer's silk waist sash. It stays BELOW §H A2's band, which bottoms out at
  // world 1.47 on the shortest hat in the set, so the age gate never sees a pixel of it.
  // v131.4 …AND NOW ON FIVE OF SIX. Bronze lost its team brow band and Iron its team helmet cord
  // (both moved off the crown for §H A1 at team 1 — see helmTuskCone / helmNegauBell), which is
  // 2-3 points of §2.5's budget off two ages that were already at 19.6 and 19.8%. §B.1 gives both
  // a team waist sash in its own body row. Medieval is the exception: its surcoat quartering
  // already carries the highest team fraction in the set.
  const _wide=(a!==4);
  const sash=_tRing(R,_wide?0.02:0.12,_wide?0.72:0.46,tc,_wide?0.610:0.600,_wide?0.680:0.640,12);
  sash.renderOrder=1;
  // ============================================================================================
  // THE PLASTRON — the surface the beard's triangle is CUT OUT OF, and it exists because §6.3c's
  // acceptance test is about an EDGE and not about a shape.
  // "At 40px greyscale it must read as a TRIANGLE." The lathe profile above tapers correctly, and
  // the test still failed on every age, because a correct outline against a surface of its own
  // value is not an outline at all: measured through the composer, the beard renders at V 0.12-0.44
  // and the garment immediately behind it at 0.11-0.67, and on the Enlightenment musketeer a
  // near-black beard hung in front of near-black felt at ΔV 0.01. Stone's beard read as "a broad
  // flat horizontal shelf" for the same reason from the other side.
  // SO THE FIX IS BEHIND THE BEARD, NOT ON IT. Each age puts a small panel at the sternum in a hex
  // from its OWN §A.3 palette chosen to sit clear of that age's beard tone, sized so that only a
  // rim of it shows — 0.16 either side of the cone and 0.16 below the tip. Big enough to be an
  // edge at 40px (a figure is 40px over ~4 world units, so 0.16 is ~1.6px after the 1px blur);
  // small enough that it moves §H A2's crop mean by ~0.04 rather than owning it the way the beard
  // itself did. The hexes: Otzi's light hide stripe, a dark bronze-age harness, lit iron scale,
  // the legionary's crimson focale, the surcoat's heraldic white, the musketeer's buff cravat.
  // Stone takes the DARK panel and not the light one: its beard already reads as a triangle
  // against age0.dominant at ΔV 0.18 (looked at, at 40px), and §H A2 needs this rung DOWN, not up
  // — Stone and Enlightenment measured 0.263 and 0.306 on a ladder that designs them 0.374 and
  // 0.127 apart. The other five take the contrast their own beard cannot get from the garment.
  // >>> v131.4 EVERY PANEL IS NOW CHOSEN AGAINST ITS OWN AGE'S BEARD, AND THE TEST IS RUN. <<<
  // §6.3c's acceptance failed on six of six for two rounds running and the reason is in the pairs:
  // Stone put a near-black beard on a #3A2E24 panel (ΔV 0.07 as authored), Bronze a flaxen beard
  // on dark bronze that measured 0.041 through the composer, and Classical a silvered-ash beard on
  // polished steel at 0.004 — a beard authored blind against the hex table rather than against the
  // thing it hangs in front of. `node tools/agecheck.js line` now prints |ΔV(beard, 3px ring)| per
  // age with the 0.25 floor on it, so this cannot be asserted again without being measured.
  //   0 Stone   near-black walnut beard  →  the LIGHT Otzi stripe behind it (V 0.581)
  //   1 Bronze  flaxen honey beard       →  tusk ivory (0.804): the pale rung is pale behind it too
  //   2 Iron    dark auburn beard        →  lit iron scale (0.562)
  //   3 Classical DARK WALNUT beard      →  bleached marble (0.789). The critic's own call, and
  //             right: this age's armour is the brightest in the game, so the beard is the dark one.
  //   4 Medieval dark grey-brown beard   →  heraldic white surcoat (0.798)
  //   5 Enlight. near-black beard        →  the buff linen cravat (0.813) — the age's own stock
  const plHex=[A.light,A.accent,A.light,A.accent,A.accent,A.accent][a];
  // Bronze gets a bigger one, and it needs it: its beard is the lightest tone on the ladder and it
  // hangs in front of cream linen, so at 40px there was no edge at all where the other ages had
  // one, and Bronze has §H A2 margin to spend — its failing pairs are elsewhere. Classical was
  // given the same and it cost 0.034 of the age's rung, which took 3-4 from 12.4 to 11.1: that
  // margin is not there, so it keeps the small panel and a thinner edge.
  // AND IT HAS TO BE WIDER THAN THE BEARD OR THE RING NEVER SEES IT. The beard is 1.19 across at
  // the cheeks and 0.43 at the tip; a 0.66 panel centred on the sternum is NARROWER than the mass
  // it is supposed to be the background for over the beard's whole upper half, so a 3px dilation
  // ring round the beard was measuring the torso and not the panel. 1.02 x 0.30 sits at world
  // 1.48-1.78 against a beard tip at 1.53 — it frames the tip and both lower flanks, which is the
  // part of the triangle §6.3c's 40px test is actually about, and it stays under §H A2's crop on
  // five of the six ages (the band bottoms out at 0.42 H, ~1.64 world on the shortest hat).
  const plW=a===1?1.06:1.02, plH=a===1?0.36:0.30;
  const plast=_noSh(box(plW,plH,0.05,plHex===undefined?A.light:plHex));
  plast.position.set(0,0.58,0.47); R.torso.add(plast);
  const buckle=_noSh(box(0.20,0.20,0.06,a===0?A.accent:a===1?A.metalLit:a===2?A.metal:NC.gold));
  buckle.position.set(0,0.12,0.52); R.torso.add(buckle);
}
// THE SHOULDER PIECE, per age — see the note above on why this is not a gold box six times.
function ageShoulders(R,u,tc){
  const a=unitAge(u), A=AGEPAL[a];
  for(const sx of [-0.56,0.56]){
    if(a===0){                                     // hide pad and a bone toggle: the age has no metal
      const pd=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.19,6,5),plainMat(A.light)));  // 6x5: §H A10, and a 0.19 pad is 2px at 40
      pd.position.set(sx*0.95,1.00,0); pd.scale.set(1.25,0.80,1.05); R.torso.add(pd);
      const bn=_noSh(box(0.06,0.16,0.06,A.accent)); bn.position.set(sx*0.95,1.10,0.16); R.torso.add(bn);
    }else if(a===1){                               // STACKED boxy guards, two per side, stepped out
      // the LOWER course is the linen pteryge the bronze guard is laced over — §H A2 reads this
      // exact row and two bronze boxes per shoulder held the pale rung 0.24 below its own ladder.
      // >>> v131.7 …AND THE SPEARFIGHTER GETS THE SINGLE-PIECE GUARD, WHICH IS THE HALF OF §B.2's
      //     BRONZE SEPARATOR THAT HAD NEVER BEEN BUILT AT ALL. <<<
      // §B.2 separates the two Bronze foot units by TWO things: "a plain leather neck flap and NO
      // cheek pieces", and "SINGLE-PIECE shoulder guards box(0.085,0.038,0.080) (NOT STACKED)".
      // The cheek pieces were built and do work — probed, shortsword carries two 0.33x0.62 boxes
      // out to x ±0.71 and spearfighter carries none. They are simply too small to matter at the
      // resolution the gate judges: 0.17 of protrusion past a 0.54 skull is 1.7px on a 40px
      // figure, and A4 still scored the pair at 0.926 head-on, the highest non-identical outline in
      // the game. The shoulder guard is the other separator §B names and it was never written,
      // because ageShoulders keys on the AGE and has no class branch in it — every Bronze unit got
      // the swordsman's stack.
      // Single-piece means ONE box and a bigger one, not the top of the stack: §B's numbers are
      // 0.085 x 0.038 x 0.080 against the stacked pair's 0.075 x 0.045 x 0.075, i.e. wider, flatter
      // and seated lower. It is 0.33 across on 0.15 of height where the stack is 0.29 on 0.31.
      // >>> AND IT IS WORTH KNOWING WHAT THIS DOES NOT BUY, BECAUSE THE NUMBER IS IN. <<<
      // Built, it moved §H A4's head-on IoU for the pair from 0.926 to 0.916 and the gameplay
      // angle not at all. It cannot do more, and the reason is measurable rather than arguable:
      // EVERY box ageShoulders builds, on every age, sits inboard of the arm. The stack's outer
      // face is 0.731, the single guard's is 0.735, age 3's humeralia reach 0.828 — and the upper
      // arm's own shoulder ball is at 0.83 with the sleeve at 0.88. A shoulder piece on this rig is
      // a colour and a close-up detail; it is not in the outline at all, and any future round that
      // proposes to fix a silhouette pair by changing one is proposing to change nothing.
      // §B's other Bronze separator, the cheek pieces, IS in the outline (±0.71 against a 0.54
      // skull) and it is what holds this pair at 0.818 in the view a player actually uses.
      if(u.cls==="spearfighter"){
        const g=_noSh(box(0.327,0.146,0.308,A.metalLit));
        g.position.set(sx*1.02,0.965,0); R.torso.add(g);
      }else for(let i=0;i<2;i++){
        const g=_noSh(box(0.293,0.176,0.293,i?A.metalLit:ageLit(A.dominant)));
        g.position.set(sx*(1.0+i*0.043),0.95+i*0.135,0); R.torso.add(g);
      }
    }else if(a===2){                               // scale caps: the same courses as the corslet
      // BIGGER, AND STANDING PROUD OF THE NECK. §H A2's 28-58% crop on this class is mostly FACE
      // — warm carved wood at a constant value — and the age's whole signal is a TEMPERATURE FLIP
      // to cool grey. Measured, Iron came back #857767 (warm) against Stone's #7F633E: ΔE00 10.8
      // on a floor of 12, i.e. the one pair §A.2 says is separated by CHROMA had no chroma left.
      // The scale cape is the biggest cool surface this class owns and §B.1 puts it here anyway.
      const g=_noSh(box(0.40,0.20,0.50,ageLit(A.dominant))); g.position.set(sx*1.02,1.06,0); R.torso.add(g);
      const g2=_noSh(box(0.34,0.15,0.42,ageLit(A.light))); g2.position.set(sx*1.05,0.88,0); R.torso.add(g2);
      const g3=_noSh(box(0.34,0.60,0.38,ageLit(A.dominant))); g3.position.set(sx*0.84,1.38,0); R.torso.add(g3);
    }else if(a===3){                               // three layered guards per side, brass buckle
      for(let i=0;i<3;i++){
        const g=_noSh(box(0.38-i*0.05,0.10,0.50-i*0.06,ageLit(A.dominant)));
        g.position.set(sx*(1.02+i*0.06),1.12-i*0.088,0); R.torso.add(g);
      }
      // …and the humeralia stand UP beside the neck. Same measurement as Iron's cape above: this
      // age's A2 crop measured #9E8A6A, warm, against a Bronze cone at #AF986D — ΔE00 5.3, two warm
      // creams, the worst pair in the gate — because a crop that is 40% nc.face measures nc.face.
      // §A.2 names this rung "polished steel… the bright, high-key, polished rung" at C* 4.8, and
      // the only way a cool rung comes out of a warm crop is more cool surface IN the crop.
      const g3=_noSh(box(0.34,0.62,0.38,ageLit(A.dominant))); g3.position.set(sx*0.84,1.42,0); R.torso.add(g3);
      const bk=_noSh(box(0.09,0.09,0.09,A.metal)); bk.position.set(sx*1.10,1.16,0.16); R.torso.add(bk);
    }else if(a===4){                               // pauldrons: matte, and they do not gleam
      const g=_noSh(box(0.32,0.15,0.44,ageLit(A.crown))); g.position.set(sx,1.02,0); R.torso.add(g);
      const g2=_noSh(box(0.28,0.12,0.38,A.light)); g2.position.set(sx*1.04,0.88,0); R.torso.add(g2);
    }else{                                         // blued steel pauldron with gold etching
      // BIGGER, AND THE ETCH IS A LINE. §H A2 reads the shoulder line, and on this age the pair of
      // gold bars was the warmest thing in a crop that already carries a pale face — the darkest
      // rung on the ladder measured V 0.343, fourth. Blued steel is the age's own dominant family.
      // …AND THE ETCH DROPPED TO THE PAULDRON'S LOWER EDGE. §H A2's band on this class starts at
      // the shoulder line and #CFB53B is V 0.697 — the warmest, brightest hex in the game — on the
      // one age the ladder needs at 0.127. Histogrammed it was 10% of the crop. It is still gold
      // lace on a blued pauldron; it is just below the rows the gate reads.
      const g=_noSh(box(0.40,0.26,0.52,A.metal)); g.position.set(sx,1.00,0); R.torso.add(g);
      const e=_noSh(box(0.42,0.035,0.54,NC.gold)); e.position.set(sx,0.875,0); R.torso.add(e);
    }
  }
}
function kitStoneAge(R,u,tc,o){ // STONE: stitched hide, greenstone, the bear-hide dome
  // >>> v131.7 `strap` WAS DOING TWO JOBS AND THAT IS WHY §H A4 FAILED THIS AGE. <<<
  // ONE options object was forwarded to BOTH ageTorso — where `o.strap` builds §B.2's diagonal
  // CHEST strap, the spearman's separator — AND helmHideDome, where `o.strap!==false` builds the
  // bear-hide EAR FLAPS. So `kitStoneAge(R,u,tc,{flat:true,strap:true})`, which reads as "flat cap
  // plus the diagonal", also handed the spearman the clubman's ear flaps. Probed pre-merge, the
  // two heads came out with byte-identical part lists and byte-identical AABBs (tools/_sepprobe.js),
  // and §B.2's own line for this class is "**no chin strap** — deliberately a flat cylinder against
  // clubman's dome". A4 scored the pair at IoU 0.872 head-on with the separator "built".
  // Two keys now: `strap` is the torso's and `flaps` is the head's, and the head no longer reads a
  // key it does not own. The dome keeps its flaps by default so nothing else on the age moves.
  o=o||{};
  const A=AGEPAL[0];
  ageTorso(R,u,tc,o);
  const clothF=_noSh(box(0.36,0.46,0.07,tc)); clothF.position.set(0,0.0,0.3); R.torso.add(clothF);
  const clothB=_noSh(box(0.36,0.42,0.07,tc)); clothB.position.set(0,0.02,-0.3); R.torso.add(clothB);
  for(let i=0;i<3;i++){const bone=_noSh(box(0.07,0.16,0.05,A.accent));
    bone.position.set(-0.16+i*0.16,1.02,0.42); R.torso.add(bone);}
  helmHideDome(R,tc,A,{flat:o.flat,rw:o.rw,hh:o.hh,strap:o.flaps!==false});
  const tailH=_noSh(box(0.13,0.42,0.1,A.dark));
  tailH.position.set(0,NC_HATY-0.06,-NC_HEADR*1.03); tailH.rotation.x=0.5; R.head.add(tailH);
}
function kitDendra(R,u,tc,o){ // BRONZE: linen corselet under bronze, the boar's-tusk CONE
  ageTorso(R,u,tc,o||{});
  helmTuskCone(R,tc,AGEPAL[1],o);
}
function kitLamellar(R,u,tc,o){ // IRON: laced scale courses, the Negau BELL with its everted rim
  ageTorso(R,u,tc,o||{});
  helmNegauBell(R,tc,AGEPAL[2],o);
}
function kitSkinsArcher(R,u,tc,fancy){ // the bow line's age body: kilt, wrap, torc, age headgear
  const a=unitAge(u), A=AGEPAL[a];
  ageTorso(R,u,tc,{});
  // the team kilt — hemmed at the hip, not the knee. Same §6.2 story as the musketeer's cassock:
  // a skirt that reaches world 0.70 leaves the trouser band 0.25 tall against §5.2's 0.075 H floor
  // and the archer downsamples to four masses instead of five.
  const kilt=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.61,0.30,10),texturedMat("cloth",tc));
  kilt.scale.z=0.8; kilt.position.y=0.10; kilt.castShadow=false; R.torso.add(kilt);
  const belt=_tRing(R,0.24,0.14,A.leather,0.55,0.55,10);
  const toggle=_noSh(box(0.1,0.18,0.06,A.accent)); toggle.position.set(0,0.24,0.45); R.torso.add(toggle);
  const torc=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.2,0.045,4,8,Math.PI),plainMat(A.metal)));
  torc.rotation.x=Math.PI/2+0.3; torc.position.set(0,1.02,0.3); R.torso.add(torc);
  const band=_noSh(cyl(0.19,0.19,0.09,A.metal,7)); band.position.y=-0.26; R.armR.add(band);
  if(fancy){ // the Improved Archer earns his bronze — the TALL POINTED CONE, the Assyrian signature
    const band2=_noSh(cyl(0.19,0.19,0.09,A.metal,7)); band2.position.y=-0.26; R.armL.add(band2);
    // §B.3: smooth cone(0.185,0.30,12) in dark bronze, TC plume at the tip. The sharpest point on
    // any head in the game — a triangle, not a dome — and it is what splits the Iron bow tier from
    // Bronze's leather cap instantly. Built off the tusk cone's solid with the courses left off.
    const cone1=_lm([[0.60,0],[0.47,0.42],[0.31,0.86],[0.15,1.20],[0,1.40]],12,A.crown);
    cone1.position.y=NC_HATY-0.06; R.head.add(cone1);
    const rim=_noSh(cyl(0.615,0.635,0.12,tc,12)); rim.position.y=NC_HATY+0.0164; R.head.add(rim);
    const plu=_noSh(cone(0.078,0.43,tc,5)); plu.position.y=NC_HATY+1.55; R.head.add(plu);
    const flap=_noSh(box(0.58,0.30,0.078,A.leather));
    flap.position.set(0,NC_HATY-0.20,-0.48); flap.rotation.x=-0.35; R.head.add(flap);
  }else{ // BRONZE: the close-fitting stitched leather cap with a white linen headband over it
    helmHideDome(R,tc,{crown:A.leather,dark:0x5A4630,leather:A.leather,accent:A.accent},
      {rw:0.70,hh:0.62,strap:false});   // rw 0.62 left the pinched brow ring inside a 0.5515 skull
    const hb=_noSh(cyl(0.635,0.645,0.117,A.dominant,12)); hb.position.y=NC_HATY+0.10; R.head.add(hb);
    const flap=_noSh(box(0.58,0.235,0.078,A.leather));
    flap.position.set(0,NC_HATY-0.22,-0.46); flap.rotation.x=-0.3; R.head.add(flap);
  }
}
function weaponGrip(fa,rotX,z,out){ // hand-anchored weapon group: pieces stack along +Y, grip at y=0
  // +PI flips the stack axis so +Y points down-forward — the classic carry — instead of up-backward
  // v130.6 `out` — CANT THE STACK OUTBOARD. Standing the shafts up (v130.4/.5) fixed the angle and
  // left the position: the fist hangs at x=+0.68 against a head half-width of 0.55 and a beard
  // half-width of 0.63, so a 3-metre shaft cleared the figure's outline by five centimetres and
  // crossed it on any camera off the axis — a THIRD silhouette event on a §6.3 budget of two.
  // A lean, not a slide: the grip stays IN the hand (a weapon floating beside the fist is worse
  // than one crossing the chest) and the head of the shaft walks out. rotation.z is applied first
  // under Euler XYZ and then flipped by the +PI on x, so a POSITIVE `out` throws the top away from
  // the body — which is also how a real shouldered pike rides, butt in, head out.
  // NEGATED so a caller can say "0.12 outboard" without knowing that the +PI has already flipped
  // the sign under it — the last two passes on these weapons each lost a render to that.
  const g=new THREE.Group(); g.position.set(0,-0.52,z===undefined?0.15:z);
  g.rotation.x=rotX+Math.PI; g.rotation.z=-(out||0); fa.add(g); return g;
}
// ==================== v128.6: THE RIGID-CLUSTER MERGE ====================
// Units were 86% of the scene's draw calls — measured at 22.8-33.4 per unit, because every boot,
// buckle and eyeball was its own mesh with its own material. Trees have been welded into single
// vertex-coloured geometries since v114 (`_mergeColored`, 02-world.js); characters never were.
//
// A unit ANIMATES, so it cannot become one mesh — but almost none of it moves. The clusters below
// are exactly the nodes `animateUnit` writes a transform to, and everything hanging off one of
// them is rigid with respect to it in every animation state. NOTE: this is ELEVEN clusters, not
// the seven an earlier handoff promised — `R.shinL/shinR` (knees) and `R.faL/faR` (elbows) are
// rotated independently of the thigh and upper arm on every frame, so a leg is two clusters and
// an arm is two. Eleven is the floor without moving to skinning.
//
// Merging geometry alone would NOT have been enough: a merged cluster still costs one draw per
// material, and `mat()` in 01-engine caches nothing, so a broadsword's 51 meshes carry 26
// materials and would have landed at 41 draws. UATLAS collapses those into one — see the long
// comment there for why an atlas and not vertex colours.
const _MERGE_NODES=["legL","shinL","legR","shinR","torso","head","armL","faL","armR","faR",
  // …and the parts of the beast and siege rigs that are driven separately
  // v131.28 "xbowG" IS LOAD-BEARING AND NOT COSMETIC. Anything not named here is WELDED into its
  // parent cluster by mergeUnitBody, so an unregistered weapon group stops existing at merge time
  // and the rotation above would drive nothing at all.
  "musketG","bowG","xbowG","goods","horseG","horseNeck","arm","barrel","gunSG","log"];
function _mergeableMat(m){
  // Only plain toon materials fold into the atlas. This automatically leaves out the priest's
  // transparent MeshBasicMaterial aura, any ink hull's ShaderMaterial and the name-tag sprite,
  // without naming any of them — a filter that stays correct when someone adds another.
  return !!m&&m.isMeshToonMaterial===true&&!m.transparent&&!m.flatShading&&m.side===THREE.FrontSide;
}
function _mergeGeo(parts){
  let n=0; const bufs=[];
  for(const p of parts){
    const g=p.geo.index?p.geo.toNonIndexed():p.geo.clone();
    // applyMatrix4 carries the NORMALS through the normal matrix, so spheres and cones keep the
    // smooth shading their geometry gave them — recomputing normals here would flat-shade every
    // facet, which is the mistake _mergeColored's comment warns about.
    g.applyMatrix4(p.m4);
    n+=g.attributes.position.count;
    bufs.push({g,slot:p.slot,col:p.col});
  }
  const pos=new Float32Array(n*3), nor=new Float32Array(n*3),
        uv=new Float32Array(n*2), col=new Float32Array(n*3);
  let o=0;
  for(const b of bufs){
    const a=b.g.attributes, k=a.position.count;
    pos.set(a.position.array,o*3);
    if(a.normal)nor.set(a.normal.array,o*3);
    const s=b.slot, su=a.uv&&a.uv.array;
    for(let i=0;i<k;i++){
      let U=su?su[i*2]:0.5, V=su?su[i*2+1]:0.5;
      // r128's SphereGeometry emits UVs out to +-8.3% at the poles — ~1.3 texels on a 16x16 skin,
      // which without this would sample a NEIGHBOURING skin in the atlas. Every unit texture is
      // ClampToEdge today, so clamping here reproduces the exact pixel it samples now.
      U=U<0?0:U>1?1:U; V=V<0?0:V>1?1:V;
      uv[(o+i)*2]=s.u0+U*s.us;
      uv[(o+i)*2+1]=s.v0+V*s.vs;
      col[(o+i)*3]=b.col.r; col[(o+i)*3+1]=b.col.g; col[(o+i)*3+2]=b.col.b;
    }
    o+=k;
    b.g.dispose();
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute("position",new THREE.BufferAttribute(pos,3));
  out.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  out.setAttribute("uv",new THREE.BufferAttribute(uv,2));
  out.setAttribute("color",new THREE.BufferAttribute(col,3));
  out.computeBoundingSphere();
  return out;
}
function _mergeCluster(node,stop){
  const parts=[];
  (function walk(o,m4){
    for(const c of o.children){
      if(stop.has(c))continue;                     // a different cluster owns this subtree
      c.updateMatrix();                            // .matrix is stale until a render pass
      const cm=new THREE.Matrix4().multiplyMatrices(m4,c.matrix);
      if(c.isMesh&&c.geometry&&_mergeableMat(c.material)&&c.visible!==false){
        const t=c.material.map;
        parts.push({obj:c,geo:c.geometry,m4:cm,col:c.material.color,
          slot:t?UATLAS.slot(t):UATLAS.whiteSlot(),shadow:!!c.castShadow});
      }
      if(c.children.length)walk(c,cm);
    }
  })(node,new THREE.Matrix4());
  if(parts.length<2)return 0;                      // nothing to gain from welding one mesh
  const mesh=new THREE.Mesh(_mergeGeo(parts),UATLAS.material());
  // only the torso casts a shadow today (04-units torsoM); inheriting the flag from the sources
  // keeps that true automatically instead of hard-coding which cluster it is
  mesh.castShadow=parts.some(p=>p.shadow);
  // v130.4 …AND THE UNIT CATCHES SHADOW TOO. Casting alone is half a shadow: a soldier under the
  // town-centre eave, or inside a wood, was lit exactly as brightly as one standing in open sun
  // while the ground it stood on went 54% darker — the figure read as a sticker pasted over the
  // scene instead of a thing standing in it (§3.8: everything on the ground receives). The round
  // that added castShadow set this line to false out of caution and that caution was misplaced:
  // r128 hands `receiveShadow` to the shader as a plain uniform bool (`receiveShadow ? getShadow(…)`
  // in lights_pars_begin), NOT a program define, so every unit still shares the one UATLAS program
  // and the atlas material is never re-linked. Measured: no change in draw calls, no new programs.
  mesh.receiveShadow=true;
  node.add(mesh);
  for(const p of parts){
    if(p.obj.parent)p.obj.parent.remove(p.obj);
    p.geo.dispose();
    // …and dispose the material IF it was minted for this one mesh. box()/cyl()/cone() route
    // through the uncached mat(), so ~10 per broadsword and ~20 per age-5 villager were being
    // orphaned on every rebuild — a leak the v122 geometry fix never covered.
    if(!isSharedMat(p.obj.material))p.obj.material.dispose();
  }
  return parts.length;
}
function mergeUnitBody(u){
  if(!u||!u.body||u._modelBody||typeof UATLAS==="undefined")return 0;
  const R=u.rig||{}, roots=[u.body];
  const add=o=>{if(o&&roots.indexOf(o)<0)roots.push(o);};
  for(const k of _MERGE_NODES)add(R[k]);
  if(R.horseLegs)for(const l of R.horseLegs){add(l);add(l&&l.userData&&l.userData.knee);}
  if(R.wheels)for(const w of R.wheels)add(w);
  const stop=new Set(roots);
  // R.logs toggles its children's visibility INDIVIDUALLY as cargo loads (updateCargoVisual), so
  // its contents must stay separate meshes. Barring it as a stop node without adding it as a root
  // leaves the whole subtree alone.
  // v131.5 …AND "SEPARATE" MEANS ONE PER LOG, NOT THREE. The pile is what §H A10 was measuring on
  // the oxcart: 24 of that class's 39 meshes were in here, three per log (barrel + two sawn caps)
  // where the toggle only ever addresses the log. Each log is a Group now (see the oxcart rig) and
  // each group is its own merge root, so the caps weld into the barrel and the visibility contract
  // is untouched — updateCargoVisual still walks R.logs.children and sets .visible on each.
  if(R.logs){stop.add(R.logs); for(const lg of R.logs.children)add(lg);}
  let merged=0;
  for(const node of roots)merged+=_mergeCluster(node,stop);
  // and the residue: a cluster of one mesh never merges (`parts.length<2`) and the cargo logs are
  // barred from merging outright, so setting the flag only on the welded mesh above would leave a
  // handful of parts per unit still refusing the sun's shadow — the exact patchwork §3.8 is about.
  // Unlit materials (the team ring, the priest's aura, name sprites) ignore the flag entirely, so
  // this needs no filter beyond isMesh.
  u.body.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});
  // …EXCEPT THE LEGS, and that exception is §6.2 winning an argument with §3.8 on the one surface
  // where §6.2 is an automatic fail. The torso is the body's only shadow caster and it is a
  // 1.04-wide barrel standing directly over two 0.33-wide legs, so with the sun at 49.4° its own
  // shadow lands on the trouser band and nowhere else: measured on the isolated shot the whole
  // left leg and two thirds of the right came out (103,109,97) — green, because in full shade the
  // hemisphere's GROUND colour is most of the light left — against (204,200,176) two pixels away.
  // That is the white band of the barcode, self-shadowed into mud, and it is what the round-3
  // critic measured as "one brown puddle" at the bottom of every figure.
  // §3.8 is about units receiving the WORLD's shadow — eaves, walls, wood — and they still do:
  // this turns off four cluster roots, not the flag. A cel figure carries its own form on the
  // ramp, which is exactly what the 4-gon legs above are for; a shadow map drawing a second,
  // unquantised terminator across the same 0.10 H is the thing §7.1 calls two drawings at once.
  // DIRECT children only, never traverse: u.body's own cluster is the pelvis, the coat skirt and
  // the two contact discs — everything below the belt — while R.torso and R.head hang off it and
  // must keep receiving. (The discs are a PAINTED contact shadow; letting the shadow map darken
  // them again is drawing the same thing twice, which is the other half of §7.1.)
  for(const n of [u.body,R.legL,R.shinL,R.legR,R.shinR])
    if(n)for(const c of n.children)if(c.isMesh)c.receiveShadow=false;
  u._merged=merged;
  return merged;
}
function buildBodyFor(u){
  _buildBodyRaw(u);
  // below the model-registry early return by construction: _buildBodyRaw sets _modelBody itself,
  // so a glTF-backed body — whose geometry is SHARED with MODELS[cls] — is never touched.
  if(!u._modelBody)mergeUnitBody(u);
}
function _buildBodyRaw(u){
  // v122 THE LEAK THAT CRASHED THE PHONE. This removed the old body's children and never DISPOSED
  // them. Three.js does not free GPU buffers on remove(), so every class change, every arm-up and
  // every respawn-as-a-different-unit orphaned ~25-40 BufferGeometries on the GPU. Across 100 bots
  // dying and re-arming through six ages, a 30-45 minute match leaked tens of thousands — which is
  // exactly when John's iPhone went white and reloaded to the main menu (iOS killing the tab under
  // memory pressure). 03-buildings has always disposed its geometry on restyle; units never did.
  //
  // MATERIALS are deliberately left alone: they come from the _skinCache and are shared by every
  // unit that wears them, so disposing one would blank half the army.
  // MODEL-BACKED bodies are also skipped: SkeletonUtils.clone() SHARES geometry with the loaded
  // glTF, so disposing a clone's buffers would destroy MODELS[cls] for everyone.
  if(!u._modelBody){
    for(const c of u.body.children)c.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  }
  u._modelBody=false;
  while(u.body.children.length)u.body.remove(u.body.children[0]);
  u.body.scale.setScalar(1); // giants (vikingboss 1.45x) must not leak their size into a rebuilt class
  u.mixer=null; u.actions=null; u.curAction=null; u.rig=null;

  // external glTF model takes over if one is registered + loaded for this class
  if(tryAttachModel(u)){
    refreshBar(u);
    return;
  }

  const d=CLS[u.cls], tc=TEAMCOL[u.team];
  const R=u.rig={};
  // >>> §H A4 / §E: `trader` AND `tradecart` WERE THE SAME MODEL — ΔE00 0.0, IoU 1.000. <<<
  // Not a contrast problem, a MISSING MODEL. Both classes are `rig:"cart"` in 00-data.js and the
  // cart rig has no class branch anywhere in it, so the Trader — a unit the player BUYS for 25
  // food and 100 gold — rendered as the mule-and-wagon the AI spawns for free. A4 scored the pair
  // at IoU 1.000 in both views, which is the only 1.000 in the game and the only way a silhouette
  // gate can say "these are literally the same object".
  // §E has specified the real one since the ages document was written and it had never been
  // built: "a walking merchant nutcracker… strongbox on the back… the only unit with a load above
  // the shoulders behind the head." A walking humanoid is the NUTCRACKER rig, not this one, so the
  // fix is a class test in front of the rig dispatch and a flair block down with the villager's.
  // The class row in 00-data.js still says rig:"cart" and that is deliberate — 05-combat, 07-ai
  // and 10-net all read `bot.role==="cart"` and `CLS[].rig==="cart"` for trade routing, plunder
  // and the host-migration scan, and none of that is about geometry. Changing the data row to
  // separate the model would have moved the sim; a test in the builder does not.
  if(d.rig==="cart"&&u.cls!=="trader"){ // v113 THE MARKET MULE: a real mule in harness, hauling a merchant's wagon
    // Was a grey box on four sticks — John's placeholder call. Rebuilt on the DESTRIER anatomy
    // (barrel + chest + rump, neck-and-head on a pivot, jointed legs with knees and hooves) so it
    // reads as an animal, then muled: shorter, stockier, long ears, dun coat, mealy muzzle.
    u.rigBaseY=0;
    const MG=new THREE.Group(); MG.scale.setScalar(0.62); MG.position.set(0,0,1.45); u.body.add(MG); R.horseG=MG;
    const coat=[0x8d8578,0x9a8f7c,0x7e766a,0xa39682][u.id%4], dark=0x5d564c, mealy=0xd6cdba;
    const hideM=texturedMat("hide",coat), darkM=plainMat(dark);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.94,0.86,2.7,9),hideM);
    barrel.rotation.x=Math.PI/2; barrel.scale.x=0.8; barrel.position.y=2.45; barrel.castShadow=true; MG.add(barrel);
    const chest=new THREE.Mesh(new THREE.SphereGeometry(0.96,8,7),hideM);
    chest.scale.set(0.84,1.0,0.95); chest.position.set(0,2.5,1.2); chest.castShadow=false; MG.add(chest);
    const rump=new THREE.Mesh(new THREE.SphereGeometry(0.96,8,7),hideM); // the mule's famously round quarters
    rump.scale.set(0.84,1.04,1.05); rump.position.set(0,2.52,-1.2); rump.castShadow=false; MG.add(rump);
    const belly=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.72,7,6),plainMat(mealy)));
    belly.scale.set(0.72,0.5,1.5); belly.position.set(0,1.86,-0.1); MG.add(belly); // mealy underside
    const NG=new THREE.Group(); NG.position.set(0,2.86,1.1); MG.add(NG); R.horseNeck=NG;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.6,1.55,8),hideM);
    neck.position.set(0,0.48,0.5); neck.rotation.x=0.62; NG.add(neck);
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.58,0.92),hideM); head.position.set(0,1.24,1.02); head.rotation.x=0.3; NG.add(head);
    const muzzle=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.38,0.4,0.5),plainMat(mealy))); muzzle.position.set(0,1.02,1.5); NG.add(muzzle);
    const nose=_noSh(box(0.3,0.12,0.1,dark)); nose.position.set(0,0.94,1.72); NG.add(nose);
    for(const ex of [-0.15,0.15]){
      const eye=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),plainMat(0x14100c)));
      eye.position.set(ex*1.55,1.36,1.28); NG.add(eye);
      const ear=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.13,0.86,5),hideM)); // THE EARS: a mule's signature
      ear.position.set(ex,2.1,0.68); ear.rotation.set(-0.18,0,ex>0?0.16:-0.16); NG.add(ear);
      const inner=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.07,0.6,4),plainMat(0x40382f)));
      inner.position.set(ex*1.02,2.06,0.76); inner.rotation.copy(ear.rotation); NG.add(inner);
    }
    const bridle=_noSh(box(0.54,0.09,0.1,0x4a3320)); bridle.position.set(0,1.2,1.28); NG.add(bridle);
    const brow=_noSh(box(0.14,0.34,0.4,0x3a2f22)); brow.position.set(0,1.66,0.92); brow.rotation.x=0.3; NG.add(brow); // clipped mane tuft
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.16,1.15,5),plainMat(0x3a3128));
    tail.position.set(0,2.4,-2.1); tail.rotation.x=2.85; tail.castShadow=false; MG.add(tail);
    R.horseLegs=[]; // jointed, but they TROT in diagonal pairs — a draught animal never gallops
    for(const [lx,lz,front] of [[-0.46,1.0,1],[0.46,1.0,1],[-0.46,-1.05,0],[0.46,-1.05,0]]){
      const hip=new THREE.Group(); hip.position.set(lx,2.34,lz); MG.add(hip);
      const thigh=new THREE.Mesh(new THREE.BoxGeometry(0.38,1.1,0.46),hideM); thigh.position.y=-0.46; thigh.castShadow=false; hip.add(thigh);
      const knee=new THREE.Group(); knee.position.y=-1.0; hip.add(knee);
      const cap=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.19,6,5),plainMat(0x6a6154))); knee.add(cap);
      const shank=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.95,0.26),plainMat(0x554d43)); shank.position.y=-0.48; shank.castShadow=false; knee.add(shank);
      const fetlock=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.12,5,4),plainMat(0x453e35))); fetlock.position.y=-0.92; knee.add(fetlock);
      const hoof=_noSh(box(0.3,0.26,0.38,0x2b2118)); hoof.position.set(0,-1.02,0.04); knee.add(hoof);
      hip.userData.knee=knee; hip.userData.front=front; hip.userData.trot=1;
      R.horseLegs.push(hip);
    }
    // ---- harness: breast-collar, traces and hames, the whole reason it pulls ----
    const collar=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.58,0.13,5,10),texturedMat("hide",0x5a3f28)));
    collar.position.set(0,2.62,1.42); collar.rotation.x=0.42; MG.add(collar);
    for(const s of [-1,1]){
      const trace=_noSh(box(0.09,0.09,2.5,0x4a3320)); trace.position.set(s*0.72,2.5,-0.3); MG.add(trace);
      const hame=_noSh(box(0.1,0.6,0.1,0x8a7a4a)); hame.position.set(s*0.5,2.95,1.3); hame.rotation.z=s*0.3; MG.add(hame);
    }
    const pad=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.1,0.18,0.9),texturedMat("cloth",tc))); pad.position.set(0,3.16,0.1); MG.add(pad); // team saddle-pad
    // ---- THE WAGON: shafts, plank bed, staked sides, a canvas tilt and the merchant's cargo ----
    const woodM=texturedMat("wood",0x8a6a3f), woodD=texturedMat("wood",0x6b4a2b);
    for(const s of [-1,1]){
      const shaft=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.11,2.5),woodM); shaft.position.set(s*0.46,1.12,0.75); shaft.castShadow=false; u.body.add(shaft);
    }
    const bed=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.26,2.3),woodM); bed.position.set(0,1.02,-0.85); bed.castShadow=true; u.body.add(bed);
    for(let i=0;i<4;i++){const plank=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.38,0.06,2.25),woodD)); plank.position.set(-0.66+i*0.44,1.17,-0.85); u.body.add(plank);}
    for(const s of [-1,1]){ // side boards + corner stakes
      const side=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.52,2.3),woodD)); side.position.set(s*0.88,1.4,-0.85); u.body.add(side);
      for(const sz of [0.2,-1.9]){const stake=_noSh(box(0.11,0.86,0.11,0x5a4632)); stake.position.set(s*0.88,1.6,sz); u.body.add(stake);}
    }
    const tailgate=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.8,0.52,0.1),woodD)); tailgate.position.set(0,1.4,-1.95); u.body.add(tailgate);
    for(let i=0;i<4;i++){ // the canvas tilt: four hoops under a stretched cover
      const hoop=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.86,0.045,4,9,Math.PI),plainMat(0x6b5a3f)));
      hoop.position.set(0,1.5,0.05-i*0.62); hoop.rotation.y=Math.PI/2; u.body.add(hoop);
    }
    // §E: "max channel 201, never white". 0xe4dcc4 is 228 in red — over the 216 the buffer prints
    // and 27 over §E's own cap, on the single largest curved light surface on any moving object,
    // which is exactly the shape bloom finds first. The pale canvas arch is still the cart's read.
    const tilt=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,2.1,9,1,true,0,Math.PI),texturedMat("cloth",0xC9BCA4));
    tilt.rotation.z=Math.PI/2; tilt.position.set(0,1.5,-0.85); tilt.castShadow=true; u.body.add(tilt);
    const stripe=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.92,0.92,0.22,9,1,true,0,Math.PI),texturedMat("cloth",tc)));
    stripe.rotation.z=Math.PI/2; stripe.position.set(0,1.5,-1.82); u.body.add(stripe); // team band on the tail of the tilt
    const goods=new THREE.Group(); // v99: the cargo shows only when the cart is LOADED
    for(const [gx,gz] of [[-0.42,-0.4],[0.42,-0.4],[0,-1.15]]){ // amphorae + a spice sack
      const jar=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.22,0.5,7),plainMat(0xb07a46)));
      jar.position.set(gx,1.45,gz); goods.add(jar);
      const neckJ=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.16,6),plainMat(0x9a6a3a)));
      neckJ.position.set(gx,1.76,gz); goods.add(neckJ);
    }
    const chest2=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.72,0.4,0.6),woodD)); chest2.position.set(0,1.38,-1.55); goods.add(chest2);
    const lid=_noSh(box(0.76,0.14,0.64,0xe0a92e)); lid.position.set(0,1.62,-1.55); goods.add(lid); // the gold showing over the rim
    const sack=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.3,6,5),texturedMat("cloth",0xc9bd8a)));
    sack.scale.set(1,0.8,1.1); sack.position.set(-0.35,1.5,-1.2); goods.add(sack);
    u.body.add(goods); R.goods=goods; goods.visible=false;
    const pole=_noSh(cyl(0.045,0.045,1.5,0x5a4632,5)); pole.position.set(0,2.0,-1.98); u.body.add(pole);
    const banner=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.62,0.42,0.04),texturedMat("cloth",tc))); banner.position.set(0.31,2.5,-1.98); u.body.add(banner);
    const lantern=_noSh(box(0.16,0.22,0.16,0xe8c878)); lantern.position.set(0.72,1.86,0.18); u.body.add(lantern); // a trader's lamp on the near stake
    R.wheels=[];
    for(const [wx,wz,wr] of [[-1.0,-1.5,0.56],[1.0,-1.5,0.56],[-0.86,0.35,0.38],[0.86,0.35,0.38]]){
      const W=wheelGroup(wr,0.14,0x8A6B45,8); W.position.set(wx,wr,wz); // §E: eight spokes, iron tyres
      u.body.add(W); R.wheels.push(W);
    }
    refreshBar(u);
    return;
  }
  if(d.rig==="oxcart"){ // v113 THE OX CART, rebuilt: a real yoked ox dragging a timber wain
    // v99's version was a stack of boxes. John's call: 2.5× the size and give it some pizazz.
    // Everything hangs off ONE scaled group so the size is a single number to tune (OXSCALE),
    // and the ox itself now shares the destrier's anatomy — barrel, jointed legs, hoofed feet —
    // with the mass pushed forward into shoulders and a zebu hump.
    u.rigBaseY=0;
    const OX=new THREE.Group(); OX.scale.setScalar(OXSCALE); u.body.add(OX); // OXSCALE is module-level
    const hide=0x6b4a33, dark=0x54382a, muzz=0x9a7a5f, horn=0xd2c9b2;
    const hideM=texturedMat("hide",hide), darkM=plainMat(dark);
    // ---- the beast ----
    const OG=new THREE.Group(); OG.position.set(0,0,0.62); OX.add(OG); R.horseG=OG;
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.56,1.7,9),hideM);
    barrel.rotation.x=Math.PI/2; barrel.scale.x=0.9; barrel.position.y=1.24; barrel.castShadow=true; OG.add(barrel);
    const fore=new THREE.Mesh(new THREE.SphereGeometry(0.66,7,6),hideM); // massive draught shoulders
    fore.scale.set(0.92,1.0,0.9); fore.position.set(0,1.3,0.78); fore.castShadow=false; OG.add(fore);
    const hindq=new THREE.Mesh(new THREE.SphereGeometry(0.58,7,6),hideM);
    hindq.scale.set(0.9,1.0,0.98); hindq.position.set(0,1.24,-0.82); hindq.castShadow=false; OG.add(hindq);
    const humpM=new THREE.Mesh(new THREE.SphereGeometry(0.42,6,5),texturedMat("hide",dark)); // the zebu hump
    humpM.scale.set(0.72,0.86,1.05); humpM.position.set(0,1.86,0.6); humpM.castShadow=false; OG.add(humpM);
    const dewlap=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.26,0.5,0.72),texturedMat("hide",dark)));
    dewlap.position.set(0,0.92,1.06); dewlap.rotation.x=0.22; OG.add(dewlap); // the loose throat fold
    // The head hangs FORWARD and LOW off the withers — an ox carries its skull below the shoulder
    // line, which is what separates its silhouette from a horse's.
    const NG=new THREE.Group(); NG.position.set(0,1.42,1.06); OG.add(NG); R.horseNeck=NG;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.56,0.85,8),hideM);
    neck.position.set(0,0.02,0.34); neck.rotation.x=1.24; NG.add(neck); // short, thick, almost horizontal
    const skull=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.46,0.78),hideM); skull.position.set(0,-0.14,0.92); skull.rotation.x=0.1; NG.add(skull);
    const jaw=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.4,0.24,0.66),hideM)); jaw.position.set(0,-0.38,0.98); NG.add(jaw);
    const snout=_noSh(box(0.4,0.36,0.34,muzz)); snout.position.set(0,-0.26,1.34); NG.add(snout);
    const nostril=_noSh(box(0.3,0.08,0.07,0x3a2b20)); nostril.position.set(0,-0.2,1.5); NG.add(nostril);
    const blaze=_noSh(box(0.15,0.36,0.07,0xcfc6ae)); blaze.position.set(0,0.0,1.28); NG.add(blaze); // white face blaze
    for(const s of [-1,1]){
      const eye=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),plainMat(0x14100c))); eye.position.set(s*0.24,-0.04,1.16); NG.add(eye);
      const ear=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.13,0.32,5),hideM));
      ear.position.set(s*0.34,0.02,0.7); ear.rotation.z=s*1.2; NG.add(ear);
      // HORNS: a stout base sweeping OUT off the poll, then a short tip hooking UP. Bone, not
      // chalk — the first pass sat too high, too big and too white and read as tusks.
      const hbase=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.1,0.34,6),plainMat(horn)));
      hbase.position.set(s*0.3,0.12,0.78); hbase.rotation.z=s*1.24; NG.add(hbase);
      const htip=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.055,0.3,6),plainMat(0x6b5f4c)));
      htip.position.set(s*0.5,0.26,0.76); htip.rotation.z=s*0.5; NG.add(htip);
    }
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.09,0.9,5),darkM);
    tail.position.set(0,1.2,-1.42); tail.rotation.x=2.9; tail.castShadow=false; OG.add(tail);
    const tuft=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.13,5,4),plainMat(0x2b2118))); tuft.position.set(0,0.74,-1.62); OG.add(tuft);
    R.horseLegs=[]; // jointed like the destrier, but flagged TROT — an ox plods, it never gallops
    for(const [lx,lz,front] of [[-0.42,0.72,1],[0.42,0.72,1],[-0.4,-0.78,0],[0.4,-0.78,0]]){
      const hip=new THREE.Group(); hip.position.set(lx,1.2,lz); OG.add(hip);
      const thigh=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.6,0.4),hideM); thigh.position.y=-0.26; thigh.castShadow=false; hip.add(thigh);
      const knee=new THREE.Group(); knee.position.y=-0.55; hip.add(knee);
      const cap=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5),plainMat(0x5f4230))); knee.add(cap);
      const shank=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.5,0.24),plainMat(0x4a3426)); shank.position.y=-0.26; shank.castShadow=false; knee.add(shank);
      const hoof=_noSh(box(0.28,0.2,0.32,0x241c14)); hoof.position.set(0,-0.56,0.03); knee.add(hoof);
      const cleft=_noSh(box(0.05,0.21,0.35,0x120e0a)); cleft.position.set(0,-0.56,0.04); knee.add(cleft); // CLOVEN — an ox is not a horse
      hip.userData.knee=knee; hip.userData.front=front; hip.userData.trot=1;
      R.horseLegs.push(hip);
    }
    // ---- the YOKE: a carved beam across the withers, bows under the neck, chained to the pole ----
    const woodM=texturedMat("wood",0x8a6a3f), woodD=texturedMat("wood",0x6b4a2b);
    const yoke=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.18,0.24),woodD); yoke.position.set(0,2.06,1.42); yoke.castShadow=false; OX.add(yoke);
    for(const s of [-1,1]){
      const bow=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.3,0.055,4,8,Math.PI),plainMat(0x5a4632)));
      bow.position.set(s*0.34,2.0,1.42); bow.rotation.set(Math.PI/2,0,Math.PI); OX.add(bow);
      const strap=_noSh(box(0.1,0.24,0.1,0x4a3320)); strap.position.set(s*0.6,1.94,1.42); OX.add(strap);
    }
    const pole=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,2.9),woodM); pole.position.set(0,1.1,0.5); pole.castShadow=false; OX.add(pole);
    for(const s of [-1,1]){ // draught chains from the yoke down to the pole head — short, paired,
      // and dark, instead of the single pale tube that read as a stray pipe over the ox's back
      const chain=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.62),plainMat(0x4a4a52)));
      chain.position.set(s*0.2,1.66,1.14); chain.rotation.x=-0.62; OX.add(chain);
    }
    // ---- THE WAIN: a plank bed on a heavy frame, stake rails, rope lashings, iron-tyred wheels ----
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.2,2.5),woodD); frame.position.set(0,0.92,-1.15); frame.castShadow=true; OX.add(frame);
    for(let i=0;i<5;i++){const plank=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.34,0.08,2.45),woodM)); plank.position.set(-0.76+i*0.38,1.05,-1.15); OX.add(plank);}
    for(const s of [-1,1]){
      const rail=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.14,2.45),woodD)); rail.position.set(s*0.95,1.62,-1.15); OX.add(rail);
      for(const sz of [-0.15,-1.15,-2.15]){ // upright stakes holding the load in
        const stake=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.11,0.72,0.11),woodD)); stake.position.set(s*0.95,1.4,sz); OX.add(stake);
        const iron=_noSh(box(0.13,0.08,0.13,0x4a4a52)); iron.position.set(s*0.95,1.08,sz); OX.add(iron); // stake shoe
      }
    }
    const headboard=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.9,0.6,0.1),woodD)); headboard.position.set(0,1.38,0.05); OX.add(headboard);
    const tailboard=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.9,0.5,0.1),woodD)); tailboard.position.set(0,1.33,-2.38); OX.add(tailboard);
    for(const rz of [-0.6,-1.8]){ // rope lashings cinched flat ACROSS the load and hauled down to
      // the rails. (A half-torus here arched fore-and-aft instead — a pale pipe over the whole wain.)
      const rope=_noSh(new THREE.Mesh(new THREE.BoxGeometry(2.0,0.07,0.09),plainMat(0xb8a888)));
      rope.position.set(0,2.12,rz); OX.add(rope);
      for(const s of [-1,1]){
        const drop=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.07,0.62,0.09),plainMat(0xb8a888)));
        drop.position.set(s*1.0,1.82,rz); OX.add(drop);
      }
    }
    // §E — THE TRADE LINE HAS ONE LOOK ACROSS ALL SIX AGES, which is an owner ruling and not an
    // omission: these never restyle on age-up, so _restyleOneBuilding's hazards do not apply and
    // their materials can be minted once at boot. IRON STRAPPING AT EVERY CORNER is what says
    // "heavy timber hauler" at 40px, and it costs eight boxes on a cluster that already merges.
    for(const cx2 of [-1,1])for(const cz2 of [0.02,-2.32]){
      const strapC=_noSh(box(0.16,0.30,0.16,0x4A4640)); strapC.position.set(cx2*0.95,1.05,cz2); OX.add(strapC);
    }
    const axeH=_noSh(cyl(0.045,0.045,0.9,0x8a6a3f,5)); axeH.position.set(-1.02,1.3,-1.9); axeH.rotation.x=0.35; OX.add(axeH); // the woodsman's axe rides the rail
    const axeB=_noSh(box(0.1,0.26,0.3,0x9aa2ad)); axeB.position.set(-1.02,1.72,-2.0); OX.add(axeB);
    const pole2=_noSh(cyl(0.05,0.05,1.5,0x5a4632,5)); pole2.position.set(0.72,2.1,-2.42); OX.add(pole2);
    const banner2=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.66,0.44,0.05),texturedMat("cloth",tc))); banner2.position.set(0.39,2.62,-2.42); OX.add(banner2);
    const logs=new THREE.Group(); // the LOAD: eight logs stacked in a proper pyramid as the haul grows
    // >>> v131.5 EACH LOG IS A GROUP, AND THAT IS §H A10's WHOLE 39. <<<
    // The census reads 39 meshes on this class against a ceiling of 12, and the breakdown says
    // exactly where they are: `logs:24`, everything else one mesh per animated cluster. R.logs is
    // a merge STOP node (updateCargoVisual toggles its children one at a time as the haul grows,
    // so the pile cannot be one solid), and _mergeCluster never descends into a stop — so each of
    // the eight logs shipped as three separate meshes, a barrel and two sawn end caps, none of
    // which move relative to each other in any animation state. Wrapping each log in its own
    // Group makes that group a merge ROOT (mergeUnitBody adds R.logs' children), the three parts
    // weld into one, and the cargo toggle still sets .visible on the group exactly as before.
    // 24 -> 8. The remaining 23 on this class are 15 animated clusters + 8 independently-toggled
    // cargo groups and there is no twelfth-cluster trick that gets a yoked ox, a four-wheeled
    // wain and a variable load under 12 — see the note in mergeUnitBody().
    for(let li=0;li<8;li++){
      const row=li<3?0:li<6?1:2, inRow=li<3?li:li<6?li-3:li-6, wide=row<2?3:2;
      const LG=new THREE.Group();
      const lg=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.15,2.2,7),texturedMat("wood",0x7a5a34));
      // §G.5 — THIS WAS A LIVE DESYNC AND IT SAT HERE THROUGH THREE ROUNDS OF REVIEW.
      // Math.random() in unit appearance makes the host and every guest render the same cart
      // differently, and unlike a wrong colour a desynced one cannot be spotted in a screenshot —
      // it is only ever visible in the source. `(u.id*7+li*13)%9` gives the same eight-log jumble
      // from the same cart id on every peer, and the same spread of angles it had before.
      lg.rotation.z=Math.PI/2; lg.rotation.y=(((u.id*7+li*13)%9)-4)*0.0125; lg.castShadow=true;
      lg.position.set(0,1.28+row*0.32,-1.15+(inRow-(wide-1)/2)*0.42);
      for(const be of [-1,1]){ // pale sawn ends — the cylinder's OWN axis is local Y, so the caps
        // ride y=±half-length; putting them on local x parked them above the log instead.
        const bark=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.158,0.158,0.1,7),plainMat(0xc2b191)));
        bark.position.y=be*1.06; lg.add(bark);
      }
      LG.add(lg); logs.add(LG);
    }
    OX.add(logs); R.logs=logs; logs.visible=false;
    R.wheels=[];
    for(const [wx,wz] of [[-1.12,-1.95],[1.12,-1.95],[-1.02,-0.25],[1.02,-0.25]]){
      const back=wz<-1, r=back?0.72:0.5;
      const W=wheelGroup(r,0.2,0x6E5230,0); W.position.set(wx,r,wz);   // §E: solid disc, three cleats
      W.userData.rr=2.75/(r*OXSCALE); // wheelGroup sizes the roll rate off the LOCAL radius — correct for the group scale
      OX.add(W); R.wheels.push(W);
    }
    refreshBar(u);
    return;
  }
  if(d.rig==="wolf"){ // WILD WOLF: a lean gray hunter — no humanoid
    u.rigBaseY=0;
    const fur=0x8a8f96, dark=0x6d737c, belly=0xb8bcc2;
    const torso=box(0.62,0.6,1.55,fur); torso.position.set(0,0.95,0); torso.castShadow=true; u.body.add(torso);
    const chest=box(0.7,0.66,0.6,dark); chest.position.set(0,1.0,0.55); u.body.add(chest); // heavy shoulders + ruff
    const under=box(0.5,0.2,1.2,belly); under.position.set(0,0.68,0); under.castShadow=false; u.body.add(under);
    const HD=new THREE.Group(); HD.position.set(0,1.3,0.95); u.body.add(HD); R.head=HD;
    const skull=box(0.46,0.42,0.5,fur); skull.castShadow=false; HD.add(skull);
    const snout=box(0.24,0.22,0.42,dark); snout.position.set(0,-0.06,0.4); snout.castShadow=false; HD.add(snout);
    const nose=box(0.12,0.1,0.08,0x2b2118); nose.position.set(0,-0.02,0.62); nose.castShadow=false; HD.add(nose);
    for(const s of [-1,1]){
      const ear=cone(0.1,0.26,dark,4); ear.position.set(s*0.15,0.32,-0.05); ear.castShadow=false; HD.add(ear);
      const eye=box(0.07,0.06,0.03,0xd8b02e); eye.position.set(s*0.13,0.08,0.26); eye.castShadow=false; HD.add(eye); // amber eyes
    }
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.11,0.85,5),plainMat(dark));
    tail.position.set(0,1.15,-0.95); tail.rotation.x=-2.4; tail.castShadow=false; u.body.add(tail);
    R.horseLegs=[]; // reuse the cart-mule trot: diagonal pairs
    for(const [lx,lz] of [[-0.22,0.55],[0.22,0.55],[-0.22,-0.55],[0.22,-0.55]]){
      const leg=limb(0.15,0.75,0.15,dark,lx,0.95,lz); u.body.add(leg); R.horseLegs.push(leg);
    }
    refreshBar(u); return;
  }
  if(d.rig==="ram"){ // THE BATTERING RAM: an A-framed, hide-roofed engine, log slung on chains
    u.rigBaseY=0;
    const SG=new THREE.Group(); SG.scale.setScalar(2.15); u.body.add(SG);
    const skidL=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,3.6),texturedMat("wood",0x6b4a2b)); skidL.position.set(-1.05,0.45,0); skidL.castShadow=true; SG.add(skidL);
    const skidR=skidL.clone(); skidR.position.x=1.05; SG.add(skidR);
    for(const bz of [-1.5,0,1.5]){const cross=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.22,0.26),texturedMat("wood",0x8a6a3f)); cross.position.set(0,0.5,bz); cross.castShadow=false; SG.add(cross);}
    for(const az of [-1.35,-0.45,0.45,1.35])for(const sx of [-1,1]){ // the A-frame pairs
      const legA=new THREE.Mesh(new THREE.BoxGeometry(0.2,2.6,0.24),texturedMat("wood",0x8a6a3f));
      legA.position.set(sx*0.62,1.6,az); legA.rotation.z=sx*0.44; legA.castShadow=false; SG.add(legA);
    }
    const ridge=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.24,3.5),texturedMat("wood",0x5a4632)); ridge.position.set(0,2.75,0); ridge.castShadow=false; SG.add(ridge);
    for(const sx of [-1,1]){ // fresh hides stretched over the frame
      const hide=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.1,3.7),texturedMat("hide",0x8a5a3a));
      hide.position.set(sx*0.58,2.32,0); hide.rotation.z=-sx*0.62; hide.castShadow=true; SG.add(hide);
      const wall=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.85,3.5),texturedMat("hide",0x7a4c30));
      wall.position.set(sx*1.18,1.05,0); wall.castShadow=false; SG.add(wall); // hide walls shield the crew
      for(const hz of [-1.1,0.4]){const strap=new THREE.Mesh(new THREE.BoxGeometry(1.55,0.12,0.14),plainMat(0x4a3320));
        strap.position.set(sx*0.58,2.36,hz); strap.rotation.z=-sx*0.62; strap.castShadow=false; SG.add(strap);}
    }
    const trimH=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.14,3.6),plainMat(tc)); trimH.position.set(0,2.82,0); trimH.castShadow=false; SG.add(trimH);
    R.log=new THREE.Group(); R.log.position.set(0,1.55,0); SG.add(R.log);
    const logM=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,4.6,9),texturedMat("wood",0x6b4a2b));
    logM.rotation.x=Math.PI/2; logM.position.z=-0.1; logM.castShadow=true; R.log.add(logM);
    const ramHead=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.36,0.7,9),texturedMat("metal",0x7d848d));
    ramHead.rotation.x=Math.PI/2; ramHead.position.z=2.35; ramHead.castShadow=false; R.log.add(ramHead);
    for(const bz of [-1.6,-0.4,0.9]){const bandL=new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.46,0.14,9),plainMat(0x4a4e56));
      bandL.rotation.x=Math.PI/2; bandL.position.z=bz; bandL.castShadow=false; R.log.add(bandL);}
    for(const cz of [-1.4,1.2]){const chain=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.15,5),plainMat(0x3a3a42));
      chain.position.set(0,1.1,cz); chain.castShadow=false; SG.add(chain);} // the suspension
    R.wheels=[];
    for(const [wx,wz] of [[-1.25,1.3],[1.25,1.3],[-1.25,-1.3],[1.25,-1.3]]){
      const W=wheelGroup(0.55,0.15,0x5a4632,6); W.position.set(wx,0.55,wz); SG.add(W); R.wheels.push(W);
    }
    refreshBar(u); return;
  }
  if(d.rig==="catapult"||d.rig==="treb"){
    u.rigBaseY=0;
    const tall=d.rig==="treb";
    const SG=new THREE.Group(); SG.scale.setScalar(tall?2.6:2.6); u.body.add(SG);
    if(!tall){ // THE ONAGER: torsion bundle, kicking arm, padded stop
      const skid1=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.34,2.9),texturedMat("wood",0x6b4a2b)); skid1.position.set(-0.75,0.5,0); skid1.castShadow=true; SG.add(skid1);
      const skid2=skid1.clone(); skid2.position.x=0.75; SG.add(skid2);
      for(const bz of [-1.15,0,1.15]){const cross=new THREE.Mesh(new THREE.BoxGeometry(1.85,0.26,0.3),texturedMat("wood",0x8a6a3f)); cross.position.set(0,0.55,bz); cross.castShadow=false; SG.add(cross);}
      const bundle=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,1.7,8),texturedMat("cloth",0x9a8a6a));
      bundle.rotation.z=Math.PI/2; bundle.position.set(0,1.35,0.45); bundle.castShadow=false; SG.add(bundle); // the twisted sinew, raised
      for(const px of [-0.75,0.75]){
        const upA=new THREE.Mesh(new THREE.BoxGeometry(0.22,2.4,0.26),texturedMat("wood",0x7a5a34));
        upA.position.set(px,1.55,-0.32); upA.rotation.x=0.1; upA.castShadow=false; SG.add(upA);
        const capU=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.24,0.34),texturedMat("wood",0x5a4632));
        capU.position.set(px,2.72,-0.44); capU.castShadow=false; SG.add(capU); // the bar sits in these
      }
      const stop=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,1.8,7),texturedMat("hide",0x8a5a3a));
      stop.rotation.z=Math.PI/2; stop.position.set(0,2.72,-0.44); stop.castShadow=false; SG.add(stop); // BOLTED to the uprights
      R.arm=new THREE.Group(); R.arm.position.set(0,1.35,0.45); SG.add(R.arm);
      u.armRest=-0.45;
      const armM=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.26,2.2),texturedMat("wood",0x8a6a3f)); armM.position.z=-0.95; armM.castShadow=true; R.arm.add(armM);
      const spoonCup=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.2,0.26,8),texturedMat("wood",0x6b4a2b));
      spoonCup.position.set(0,0.1,-1.98); spoonCup.castShadow=false; R.arm.add(spoonCup);
      const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(0.19),plainMat(0x8d949c)); stone.position.set(0,0.26,-1.98); stone.castShadow=false; R.arm.add(stone);
      R.arm.rotation.x=u.armRest;
    }else{ // THE WARWOLF: twin A-frames, long beam, hanging counterweight, sling
      u.armRest=-0.62; // cocked, with the sling swinging clear of the turf
      const skid1=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,4.2),texturedMat("wood",0x6b4a2b)); skid1.position.set(-1.05,0.55,0); skid1.castShadow=true; SG.add(skid1);
      const skid2=skid1.clone(); skid2.position.x=1.05; SG.add(skid2);
      for(const bz of [-1.7,0,1.7]){const cross=new THREE.Mesh(new THREE.BoxGeometry(2.5,0.3,0.34),texturedMat("wood",0x8a6a3f)); cross.position.set(0,0.6,bz); cross.castShadow=false; SG.add(cross);}
      for(const sx of [-1.05,1.05])for(const lz of [-1,1]){ // the twin A-frames
        const legT=new THREE.Mesh(new THREE.BoxGeometry(0.26,3.4,0.3),texturedMat("wood",0x7a5a34));
        legT.position.set(sx,2.1,lz*0.85); legT.rotation.x=lz*0.42; legT.castShadow=false; SG.add(legT);
      }
      const axleT=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,2.5,7),plainMat(0x4a3826));
      axleT.rotation.z=Math.PI/2; axleT.position.y=3.55; axleT.castShadow=false; SG.add(axleT);
      for(const sx of [-1.05,1.05]){const brace=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,2.3),texturedMat("wood",0x8a6a3f));
        brace.position.set(sx,1.9,0); brace.castShadow=false; SG.add(brace);}
      R.arm=new THREE.Group(); R.arm.position.set(0,3.55,0); SG.add(R.arm);
      const beam=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.3,5.4),texturedMat("wood",0x8a6a3f)); beam.position.z=-1.5; beam.castShadow=true; R.arm.add(beam);
      const cwArm=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.36,1.4),texturedMat("wood",0x7a5a34)); cwArm.position.z=1.5; cwArm.castShadow=false; R.arm.add(cwArm);
      const weight=new THREE.Mesh(new THREE.BoxGeometry(1.15,1.15,1.15),texturedMat("metal",0x4a4e56));
      weight.position.set(0,-0.75,1.9); weight.castShadow=true; R.arm.add(weight); // the hanging box
      for(const wb of [-0.35,0.35]){const bandW=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.14,0.16),plainMat(0x2e2e32));
        bandW.position.set(0,-0.75+wb,1.9); bandW.castShadow=false; R.arm.add(bandW);}
      for(const rx of [-0.07,0.07]){const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.3,4),plainMat(0x9a8a6a));
        rope.position.set(rx,-0.32,-4.35); rope.rotation.x=0.35; rope.castShadow=false; R.arm.add(rope);} // slung from the tip
      const pouch=new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5),texturedMat("hide",0x6b4a2b));
      pouch.scale.y=0.7; pouch.position.set(0,-0.85,-4.55); pouch.castShadow=false; R.arm.add(pouch);
      for(const bz of [-2.6,-1.1]){const wrap=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.36,0.16),plainMat(0x2e2e32));
        wrap.position.set(0,0,bz); wrap.castShadow=false; R.arm.add(wrap);} // iron beam bands
      R.arm.rotation.x=u.armRest;
      // --- pizzazz: bracing, winch, pennant, ammo pile ---
      for(const sx of [-1.05,1.05])for(const dg of [-1,1]){
        const brace=new THREE.Mesh(new THREE.BoxGeometry(0.14,2.1,0.16),texturedMat("wood",0x8a6a3f));
        brace.position.set(sx,1.7,0); brace.rotation.x=dg*0.72; brace.castShadow=false; SG.add(brace); // the X-bracing
      }
      for(const sx of [-1.18,1.18]){const capA=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.14,7),plainMat(0x4a4e56));
        capA.rotation.z=Math.PI/2; capA.position.set(sx,3.55,0); capA.castShadow=false; SG.add(capA);} // iron axle caps
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.1,5),texturedMat("wood",0x6b4a2b));
      pole.position.set(0,4.3,0.85); pole.castShadow=false; SG.add(pole);
      const pennant=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.34,0.05),plainMat(tc));
      pennant.position.set(0.35,4.7,0.85); pennant.castShadow=false; SG.add(pennant); // colors at the apex
      const drum=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,1.4,7),texturedMat("wood",0x6b4a2b));
      drum.rotation.z=Math.PI/2; drum.position.set(0,0.95,1.75); drum.castShadow=false; SG.add(drum); // the winch
      for(const hx of [-0.75,0.75]){const crank=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.55,0.09),plainMat(0x4a3826));
        crank.position.set(hx,1.2,1.75); crank.rotation.z=0.5; crank.castShadow=false; SG.add(crank);}
      for(let i=0;i<3;i++){const ammo=new THREE.Mesh(new THREE.DodecahedronGeometry(0.26),plainMat(i%2?0x8d949c:0x7b828b));
        ammo.position.set(-0.5+i*0.5,0.95,-1.6+(i%2)*0.3); ammo.castShadow=false; SG.add(ammo);} // stones waiting
    }
    R.wheels=[];
    for(const [wx,wz] of [[-1.15,1.35],[1.15,1.35],[-1.15,-1.35],[1.15,-1.35]]){
      const W=wheelGroup(0.52,0.14,0x5a4632,6); W.position.set(wx,0.52,wz); SG.add(W); R.wheels.push(W);
    }
    refreshBar(u); return;
  }
  if(d.rig==="cannon"){ // JAIVANA and her long-barrelled sister
    u.rigBaseY=0;
    const culv=u.cls==="culverin";
    const SG=new THREE.Group(); SG.scale.setScalar(culv?2.45:2.65); R.gunSG=SG; u.body.add(SG);
    for(const sx of [-0.42,0.42]){ // the carriage cheeks
      const cheek=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.85,2.1),texturedMat("wood",0x5a4632));
      cheek.position.set(sx,0.85,-0.35); cheek.castShadow=true; SG.add(cheek);
      const sun=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.05,9),plainMat(0xd9a92e));
      sun.rotation.z=Math.PI/2; sun.position.set(sx*1.6,1.0,-0.7); sun.castShadow=false; SG.add(sun); // gilt roundels
    }
    const trail=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.22,1.1),texturedMat("wood",0x6b4a2b)); trail.position.set(0,0.5,-1.45); trail.castShadow=false; SG.add(trail);
    const axleC=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,2.1,7),plainMat(0x4a3826));
    axleC.rotation.z=Math.PI/2; axleC.position.set(0,0.85,0.15); axleC.castShadow=false; SG.add(axleC);
    R.barrel=new THREE.Group(); R.barrel.position.set(0,1.3,0); R.barrel.rotation.x=-0.06; SG.add(R.barrel);
    const bl=culv?3.9:2.9, br=culv?0.17:0.3;
    const barrelM=new THREE.Mesh(new THREE.CylinderGeometry(br*0.82,br,bl,10),
      culv?texturedMat("metal",0xc0c8d2):texturedMat("metal",0x4a4034));
    barrelM.rotation.x=Math.PI/2+0.02; barrelM.position.z=bl*0.14; barrelM.castShadow=true; R.barrel.add(barrelM); // seated over the axle
    const muzzleR=new THREE.Mesh(new THREE.CylinderGeometry(br*1.05,br*0.95,0.18,10),plainMat(culv?0xc2cad4:0xd9a92e));
    muzzleR.rotation.x=Math.PI/2; muzzleR.position.z=bl*0.14+bl/2-0.08; muzzleR.castShadow=false; R.barrel.add(muzzleR);
    for(let i=0;i<4;i++){ // reinforcing rings down the chase — gilt on Jaivana, steel on the culverin
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(br*1.03,br*1.03,0.09,10),plainMat(culv?0x9aa2ad:0xd9a92e));
      ring.rotation.x=Math.PI/2; ring.position.z=bl*0.14-bl*0.38+i*bl*0.24; ring.castShadow=false; R.barrel.add(ring);
    }
    const cascabel=new THREE.Mesh(new THREE.SphereGeometry(br*0.9,7,6),plainMat(culv?0xb9c0c9:0xd9a92e));
    cascabel.position.z=bl*0.14-bl/2-0.05; cascabel.castShadow=false; R.barrel.add(cascabel); // the knob
    const wedge=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.22,0.4),texturedMat("wood",0x8a6a3f)); wedge.position.set(0,1.05,-0.9); wedge.castShadow=false; SG.add(wedge);
    for(const dz of [-0.15,0.25]){ // the dolphins: lifting handles cast into the barrel
      const dol=new THREE.Mesh(new THREE.TorusGeometry(br*0.55,0.045,4,8,Math.PI),plainMat(culv?0x9aa2ad:0xd9a92e));
      dol.position.set(0,br*0.95,dz); dol.rotation.y=Math.PI/2; dol.castShadow=false; R.barrel.add(dol);
    }
    const touch=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.09,0.14),plainMat(culv?0xb9c0c9:0xd9a92e));
    touch.position.set(0,br*0.95,bl*0.14-bl/2+0.35); touch.castShadow=false; R.barrel.add(touch); // the touch-hole
    if(culv){const sight=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.14,0.05),plainMat(0xc2cad4));
      sight.position.set(0,br*1.05,bl*0.14+bl/2-0.3); sight.castShadow=false; R.barrel.add(sight);} // the sniper's blade
    for(const sx of [-0.42,0.42])for(const bz of [0.35,-1.0]){ // iron straps on the cheeks
      const strapC=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.7,0.1),plainMat(0x3a3a42));
      strapC.position.set(sx,0.85,bz); strapC.castShadow=false; SG.add(strapC);
    }
    const ringB=new THREE.Mesh(new THREE.TorusGeometry(0.12,0.035,4,8),plainMat(0x3a3a42));
    ringB.position.set(0,0.6,-1.98); ringB.rotation.x=Math.PI/2; ringB.castShadow=false; SG.add(ringB); // towing ring
    if(culv){ // the culverin's sight blade and engraved chase
      const sight=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.12,0.04),plainMat(0x4a4e56));
      sight.position.set(0,br+0.14,bl*0.14+bl/2-0.3); sight.castShadow=false; R.barrel.add(sight);
      for(let i=0;i<3;i++){const etch=new THREE.Mesh(new THREE.CylinderGeometry(br*1.01,br*1.01,0.03,10),plainMat(0x7d858f));
        etch.rotation.x=Math.PI/2; etch.position.z=bl*0.14+bl*0.12+i*0.28; etch.castShadow=false; R.barrel.add(etch);}
    }
    R.wheels=[];
    for(const wx of [-0.62,0.62]){
      const W=wheelGroup(0.85,0.16,0x5a4632,8); W.position.set(wx,0.85,0.15); SG.add(W); R.wheels.push(W);
    }
    refreshBar(u); return;
  }
  const mounted=!!d.mounted;
  const lift=mounted?(u.cls==="chariot"?1.42:1.85):0; // riders sit the 80% horse
  // v130.3 …AND THEN THE FOOT TROOPS GAVE THEM BACK. A hip at 1.2 put 31% of the figure below the
  // belt, so the shako had to carry a 3.90 column and the head-and-hat mass came out at 0.41 of the
  // silhouette — under §6.1a's 0.46 floor with the big head already restored. The fix is NOT a
  // taller hat (that is where the last three passes went): §6.1a says a nutcracker is stumpy and
  // its height comes out of the hat, so the legs come down to 0.25 H and total height barely moves
  // (3.89 → 3.81, which is why the §5.4 bar and tag constants and §5.6's unit-to-building ratios
  // all still hold). Riders keep the long leg: theirs hangs against a horse's barrel into stirrups
  // set at a fixed height, and nobody reads a seated silhouette for legginess.
  u.rigBaseY=(mounted?0.95:NC_HIPY)+lift;

  if(mounted){ // A REAL HORSE: doubled in size, proper anatomy, barded by its age
    const cls=u.cls;
    const bard=cls==="cataphract"?"scale":cls==="knight"?"plate":"none";
    const coat=[0x8a5a30,0x6d4620,0x54401f,0x9a7a4a][u.id%4], dark=0x5f3d1f;
    const hideM=texturedMat("hide",coat), darkM=plainMat(dark);
    const HG=new THREE.Group(); HG.position.z=(cls==="chariot"?2.55:0);
    HG.scale.setScalar(0.8); u.body.add(HG); R.horseG=HG; // the destrier, four-fifths of its former glory
    // body: chest, barrel, hindquarters — no more hot dog
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.98,0.86,3.4,9),hideM);
    barrel.rotation.x=Math.PI/2; barrel.scale.x=0.82; barrel.position.y=2.5; barrel.castShadow=true; HG.add(barrel);
    const chest=new THREE.Mesh(new THREE.SphereGeometry(1.02,8,7),hideM);
    chest.scale.set(0.85,1.05,1.05); chest.position.set(0,2.55,1.6); chest.castShadow=false; HG.add(chest);
    const rump=new THREE.Mesh(new THREE.SphereGeometry(0.98,8,7),hideM);
    rump.scale.set(0.82,1.02,1.15); rump.position.set(0,2.6,-1.5); rump.castShadow=false; HG.add(rump);
    const wither=new THREE.Mesh(new THREE.SphereGeometry(0.7,7,6),hideM);
    wither.scale.set(0.75,0.7,1); wither.position.set(0,3.15,0.9); wither.castShadow=false; HG.add(wither);
    // the whole neck-and-head rides one pivot so it can bob with the stride
    const NG=new THREE.Group(); NG.position.set(0,3.0,1.5); HG.add(NG); R.horseNeck=NG;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.62,1.9,8),hideM);
    neck.position.set(0,0.6,0.65); neck.rotation.x=0.72; NG.add(neck);
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.6,1.0),hideM); head.position.set(0,1.5,1.3); head.rotation.x=0.35; NG.add(head);
    const muzzle=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.4,0.55),hideM); muzzle.position.set(0,1.25,1.85); NG.add(muzzle);
    const nose=_noSh(box(0.3,0.12,0.1,dark)); nose.position.set(0,1.14,2.1); NG.add(nose);
    for(const ex of [-0.15,0.15]){ // eyes and ears bring it alive
      const eye=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),plainMat(0x14100c)));
      eye.position.set(ex*1.6,1.62,1.55); NG.add(eye);
      const ear=_noSh(cone(0.09,0.32,dark,4)); ear.position.set(ex,2.0,1.05); ear.rotation.x=-0.15; NG.add(ear);
    }
    for(let i=0;i<4;i++){ // mane running down the crest
      const mn=_noSh(box(0.14,0.5,0.34,0x3a2814));
      mn.position.set(0,1.85-i*0.42,1.0-i*0.3); mn.rotation.x=0.72; NG.add(mn);
    }
    const forelock=_noSh(box(0.22,0.3,0.12,0x3a2814)); forelock.position.set(0,1.86,1.22); NG.add(forelock);
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.04,1.4,5),plainMat(0x3a2814));
    tail.position.set(0,2.55,-2.55); tail.rotation.x=2.95; tail.castShadow=false; HG.add(tail); // rooted at the croup
    // legs with hooves, doubled
    R.horseLegs=[];
    for(const [lx,lz,front] of [[-0.5,1.3,1],[0.5,1.3,1],[-0.5,-1.3,0],[0.5,-1.3,0]]){
      const hip=new THREE.Group(); hip.position.set(lx,2.4,lz); HG.add(hip);
      const thigh=new THREE.Mesh(new THREE.BoxGeometry(0.4,1.2,0.5),hideM);
      thigh.position.y=-0.5; thigh.castShadow=false; hip.add(thigh);
      const knee=new THREE.Group(); knee.position.y=-1.1; hip.add(knee); // the carpus / hock
      const cap=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.2,6,5),plainMat(0x6d4a24))); knee.add(cap);
      const cannon=new THREE.Mesh(new THREE.BoxGeometry(0.24,1.05,0.28),plainMat(0x5a3c1e));
      cannon.position.y=-0.52; cannon.castShadow=false; knee.add(cannon);
      const fetlock=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.13,5,4),plainMat(0x4a3018))); fetlock.position.y=-1.0; knee.add(fetlock);
      const hoof=_noSh(box(0.32,0.26,0.42,0x2b2118)); hoof.position.set(0,-1.12,0.05); knee.add(hoof);
      hip.userData.knee=knee; hip.userData.front=front;
      R.horseLegs.push(hip);
    }
    // tack and barding by class
    if(cls!=="chariot"){ // saddle for every true rider
      const pad=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.35,0.16,1.5),texturedMat("cloth",tc))); pad.position.set(0,3.42,0); HG.add(pad);
      const seat=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.05,0.18,1.1),texturedMat("hide",0x4a3320))); seat.position.set(0,3.55,0); HG.add(seat);
      const cantle=_noSh(box(0.9,0.3,0.16,0x4a3320)); cantle.position.set(0,3.7,-0.55); HG.add(cantle);
      if(cls!=="scout"){ // stirrups arrive with the heavy cavalry age
        for(const sx of [-0.72,0.72]){
          const strap=_noSh(box(0.09,0.95,0.14,0x4a3320)); strap.position.set(sx,3.0,0.15); HG.add(strap);
          const ring=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.14,0.045,4,8),plainMat(0x9aa2ad)));
          ring.position.set(sx,2.5,0.15); HG.add(ring);
        }
      }
      const rein=_noSh(cyl(0.03,0.03,1.9,0x4a3320,4)); rein.position.set(0,3.9,1.5); rein.rotation.x=0.9; HG.add(rein);
    }
    if(cls==="chariot"){ // plumed draft horse in cloth trappings
      for(let i=0;i<3;i++){const pl=_noSh(cone(0.09,0.7-i*0.12,i===1?0xcfc6ae:tc,5));
        pl.position.set((i-1)*0.14,5.35,2.5); HG.add(pl);} // the headdress
      const collar=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.62,0.12,5,9),texturedMat("cloth",tc)));
      collar.position.set(0,2.9,1.95); collar.rotation.x=0.5; HG.add(collar);
      const blanket=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,2.2),texturedMat("cloth",tc)));
      blanket.position.set(0,3.35,-0.2); HG.add(blanket);
    }
    if(cls==="heavycav"){ // leather breast-collar hung with bronze phalerae
      const strap=_noSh(box(1.5,0.2,0.14,0x4a3320)); strap.position.set(0,2.75,2.3); HG.add(strap);
      for(const px of [-0.4,0,0.4]){const disc=_noSh(cyl(0.14,0.14,0.06,0xb08a3f,7));
        disc.rotation.x=Math.PI/2; disc.position.set(px,2.6,2.42); HG.add(disc);}
      const cham=_noSh(box(0.4,0.5,0.16,0xb08a3f)); cham.position.set(0,4.55,3.15); cham.rotation.x=0.35; HG.add(cham);
    }
    if(bard==="scale"){ // the cataphract's steed wears a full scale trapper
      const trap=new THREE.Mesh(new THREE.CylinderGeometry(1.12,1.2,3.2,10,1,true),texturedMat("metal",0x8d949c));
      trap.rotation.x=Math.PI/2; trap.scale.x=0.85; trap.position.y=2.6; trap.castShadow=false; HG.add(trap); // full wrap, both flanks
      for(let i=0;i<4;i++){const row=_noSh(box(1.9,0.14,0.05,0x687079)); row.position.set(0,2.05+i*0.35,1.72-i*0.02); row.rotation.x=0.1; HG.add(row);}
      const crinet=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.68,1.8,7),texturedMat("metal",0x8d949c));
      crinet.position.set(0,3.62,2.18); crinet.rotation.x=0.72; crinet.castShadow=false; HG.add(crinet);
      const chamS=_noSh(box(0.5,0.66,0.2,0x7d858f)); chamS.position.set(0,4.5,3.1); chamS.rotation.x=0.35; HG.add(chamS);
    }
    if(bard==="plate"){ // the knight's destrier in polished plate and caparison
      const capar=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.5,3.6),texturedMat("cloth",tc));
      capar.position.y=2.15; capar.castShadow=false; HG.add(capar); // flowing caparison skirt
      // v131.4 #B9C0C9 COMES DOWN, AND THE PATTERN IS WHY. §H A8 fails on any surface over 216 in
      // ALL THREE channels across more than 200px², and the census flagged a contiguous 411px
      // region on this class at #F8F8F0. The base hex is luma 0.749 — under the 0.806 ceiling and
      // therefore "safe" by eyedropper — but texturedMat("metal") paints `_shade(hex, +0.14)`
      // gleam streaks over it and this is the biggest LIT surface on any unit in the game: a
      // 1.06-radius hemisphere pointing at the sun. Base x streak x the LIT cell x the grade is
      // what the buffer prints, not the base. Every hex in this file was swept for the ceiling and
      // this one passed the sweep and failed the render, which is §G.6 on a fourth surface.
      const peytral=new THREE.Mesh(new THREE.SphereGeometry(1.06,8,6,0,Math.PI*2,0,Math.PI*0.5),texturedMat("metal",0xa2a9b2));
      peytral.position.set(0,2.6,1.7); peytral.rotation.x=Math.PI/2; peytral.castShadow=false; HG.add(peytral);
      const croup=_noSh(new THREE.Mesh(new THREE.SphereGeometry(1.0,8,6,0,Math.PI*2,0,Math.PI*0.45),texturedMat("metal",0xa2a9b2)));
      croup.position.set(0,3.0,-1.5); HG.add(croup);
      for(let i=0;i<3;i++){const cr=_noSh(box(0.62,0.22,0.4,0xa4acb6)); cr.position.set(0,3.75-i*0.3,2.0+i*0.22); cr.rotation.x=0.72; HG.add(cr);} // crinet segments
      const chamP=_noSh(box(0.5,0.7,0.22,0xb2b9c4)); chamP.position.set(0,4.5,3.1); chamP.rotation.x=0.35; HG.add(chamP);
      const spike=_noSh(cone(0.08,0.35,0xd9a92e,5)); spike.position.set(0,4.95,3.0); HG.add(spike);
      const plumeH=_noSh(cone(0.1,0.55,tc,5)); plumeH.position.set(0,5.3,2.5); HG.add(plumeH);
    }
    if(cls==="chariot"){ // THE CAR: platform, curved rail, spoked wheels, draw-pole
      const CAR=new THREE.Group(); CAR.scale.setScalar(0.85); u.body.add(CAR);
      const floor=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.22,1.7),texturedMat("wood",0x8a6a3f));
      floor.position.set(0,1.45,-0.1); floor.castShadow=true; CAR.add(floor);
      const front=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,1.1,9,1,true,Math.PI*1.15,Math.PI*0.7),texturedMat("wood",0xa8703d));
      front.position.set(0,2.0,0.05); front.rotation.y=Math.PI/2; front.castShadow=false; CAR.add(front); // the guard rail curves BEHIND the crew
      const railT=_noSh(new THREE.Mesh(new THREE.TorusGeometry(1.02,0.06,5,10,Math.PI*0.7),plainMat(0xd9a92e)));
      railT.rotation.x=Math.PI/2; railT.rotation.z=Math.PI*0.65; railT.position.set(0,2.55,0.05); CAR.add(railT);
      for(const sx of [-1.15,1.15]){
        const W=wheelGroup(1.05,0.16,0x8a6a3f,6); W.position.set(sx,1.05,-0.35); CAR.add(W); (R.wheels=R.wheels||[]).push(W);
      }
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,3.4,6),texturedMat("wood",0x8a6a3f));
      pole.position.set(0,1.7,1.5); pole.rotation.x=Math.PI/2-0.12; CAR.add(pole);
      const yoke=_noSh(box(1.5,0.12,0.12,0x8a6a3f)); yoke.position.set(0,2.5,3.05); CAR.add(yoke);
      const quiverC=_noSh(cyl(0.16,0.16,0.8,0x7a4c26,6)); quiverC.position.set(0.95,2.0,-0.15); quiverC.rotation.z=0.2; CAR.add(quiverC);
    }
  }

  // legs — dressed for their age: Stone-age bare skin, Enlightenment stockings
  // skinT still varies per unit — it is the hands, and the stone age's bare forearms — but the FACE
  // no longer does: AD §2.6 fixes it at nc.face. The old pairing minted up to twenty 64x64 head
  // cells (four skins × five hairs) out of an atlas already at 103 of ~130, for a difference nobody
  // can see past about ten metres. One cell now; HAIR_TONES has no reader left.
  const skinT=SKIN_TONES[u.id%SKIN_TONES.length];
  const skinM=plainMat(skinT), bootM=plainMat(0x3a2c1e);
  // villagers dress for their team's CURRENT age, like the town they serve
  const vAge=u.cls==="villager"?Math.max(0,Math.min(5,(typeof teamAge!=="undefined"&&teamAge[u.team])||0)):-1;
  let bare={clubman:1,spearman:1,slinger:1}[u.cls]; const stockings=u.cls==="musketeer";
  const greaves=u.cls==="hoplite", plateBoots={pikeman:1,halberdier:1}[u.cls];
  let chiton=u.cls==="comparcher"; // bare legs and sandals under the wool chiton
  if(vAge===0)bare=true;              // Stone: bare legs, wrapped feet
  if(vAge===1||vAge===3)chiton=true;  // Bronze tunic / Classical chiton: bare legs, sandals
  // v130 U1 THE TEAM COLOUR WAS INVERTED. `u.team===BLUE?0x8e2a2a:0x27406e` put a BLUE unit in
  // dark RED trousers and a red unit in navy — read it twice, it really is the wrong way round.
  // It is moot now: AD §6.2 wants the trouser band at value 0.89, i.e. the light band between the
  // coat and the boots, so every foot soldier wears nc.trouser and team colour lives on the coat
  // (§6.6), where swapping the hue leaves the value ladder untouched.
  // v130 U1 — AND THE STONE AGE STOPS BEING NAKED. `bare` meant literal skinM on the torso, both
  // legs and both shins, so a stone-age villager (the unit on screen for the first five minutes of
  // every match) was ONE tone from scalp to sole: the 0.72-everywhere failure of AD §6.2 in its
  // purest form. It is now dressed the way its age can dress — dark hide over the chest and shins,
  // an undyed linen wrap between them — which is three bands instead of none, costs no geometry,
  // and is more AoE-correct than nudity was.
  let trouser=bare?texturedMat("cloth",0xd8cdb4):texturedMat("cloth",NC.trouser);
  if(vAge===1||vAge===3)trouser=skinM;                     // Bronze/Classical: bare legs under the tunic
  if(vAge===2)trouser=texturedMat("cloth",0x3f4a30);       // Iron: wool leggings
  if(vAge===4)trouser=texturedMat("cloth",0x5a5148);       // Medieval: grey hose
  if(vAge===5)trouser=texturedMat("cloth",0x2b3242);       // Enlightenment: navy knee breeches
  // BOOTS, AD §6.1 priority 5. The bottom of the barcode has to be as dark as the top or the
  // figure has no plinth and floats on the grass. 0x141414 was near-black and crushed against the
  // ramp's bottom band; nc.black is the game-wide dark and it still takes a shadow step.
  // v130.1 the hide leg-wrap came down to nc.black's neighbourhood. §6.2 puts the BOTTOM of the
  // barcode at 0.14 — a dark plinth is what stops a figure floating on the grass — and 0x4a3524
  // measured 0.22 against trousers at 0.83, which is a delta the ladder passes on paper and loses
  // the moment the sun hits it. The stone age still gets wrapped hide, just properly smoked.
  let bootLeg=bare?texturedMat("hide",0x33261A)   // hide leg-wraps: the age's own version of a boot
    :chiton?skinM
    :stockings?plainMat(NC.black)                 // the musketeer's stockings were WHITE below WHITE trousers
    :greaves?texturedMat("metal",0x5d4720)        // bronze greaves, patinated down to the plinth
    :plateBoots?texturedMat("metal",0x40454c)     // high plate boots, darkened into the plinth
    :plainMat(NC.black);
  if(vAge===2)bootLeg=plainMat(0x2c2118);        // Iron: sturdy dark boots
  if(vAge===4)bootLeg=plainMat(0x3a2c1e);        // Medieval: leather boots
  if(vAge===5)bootLeg=plainMat(0xd2cdbe);        // Enlightenment: white stockings
  const booted=!bare&&!chiton&&vAge<0;           // a soldier, not a villager: gets the real boot
  // the stumpy leg (§6.1a). Thigh and shin are the two constants, so the boot cylinder, the foot
  // and the hip all move together — the previous pass changed the hip alone and left the feet
  // hanging through the ground.
  const legU=mounted?0.62:NC_LEGU, legD=mounted?0.55:NC_LEGL;
  const legL=limb2(0.21,0.17,0.14,legU,legD,trouser,-0.26,u.rigBaseY,mounted?0.15:0);
  const legR=limb2(0.21,0.17,0.14,legU,legD,trouser, 0.26,u.rigBaseY,mounted?0.15:0);
  // v130.6 THE WHITE BAND WAS NEVER MISSING — IT WAS ON THE WRONG SIDE OF THE LEG.
  // Round 3 measured the trouser band at 0.44 against §6.2's 0.89 and every fix so far has argued
  // about the HEX. The hex is innocent. A 7-gon leg shows the front camera four facets: at ±25.7°
  // and ±77.1° off the view ray, and with §3.1's sun at (120,168,80) their dotNL comes out
  // +0.56 / +0.09 / +0.61 / −0.45 — i.e. the LEFT half of every leg is in the ramp's shadow and
  // deep-shadow cells while only the right half is lit. Eyedroppered on the isolated shot the
  // shin's dominant value is (99,104,87) — green, because at that depth the hemisphere's GROUND
  // colour is most of the light left — and a per-row median over two such cylinders returns the
  // dark half, every time. nc.trouser through the mid cell measures (201,196,169) = 0.76; the
  // band was reading 0.40 because 0.76 was never more than a rim on it.
  // A 4-gon turned 45° puts ONE facet dead ahead across the whole width (dotNL 0.361, the mid
  // cell) and stands the other two edge-on, so the leg is one value from side to side — the same
  // "rotate a facet onto the front ray" cure the head and the beard already run on, and §6.3 asks
  // for faceted legs in as many words. Radii are up by 1/cos45° so the SILHOUETTE is unchanged:
  // across the flats 1.414 × 0.235 = 0.332 for the trouser and 0.368 for the boot, which keeps
  // §5.3's "boots wider than the shins" and lands the boot on its 0.09 H to two decimals.
  // Cheaper as well — 8 side triangles where a 7-gon spent 14.
  // …and DE-INDEXED, or the fix does nothing. r128 lathes a cylinder with SMOOTH normals round the
  // revolution — every side vertex gets (sinθ, slope, cosθ) — so a 4-gon's front quad interpolates
  // from a −45° normal to a +45° one across its own width and the ramp draws all three cells on
  // it: measured, the "flat" leg came out (165,164,145) / (204,200,176) / (250,242,214) in three
  // vertical stripes, which is the seven-sided problem with fewer stripes. Flat normals via
  // GEOMETRY and never material.flatShading — _mergeableMat bars a flat-shaded material from the
  // weld (04-units.js:275) and a leg that will not merge is a draw call on every soldier.
  const _fourGon=(rT,rB,h)=>{const g=new THREE.CylinderGeometry(rT,rB,h,4).toNonIndexed();
    g.rotateY(Math.PI/4); g.computeVertexNormals(); return g;};
  for(const LG of [legL,legR]){
    LG.upper.children.forEach(m=>{if(m.geometry&&m.geometry.type==="CylinderGeometry"){
      m.geometry.dispose(); m.geometry=_fourGon(0.235,0.20,legU);
    }});
    LG.lower.children.forEach(m=>{if(m.geometry&&m.geometry.type==="CylinderGeometry"){ // boots, stockings, bare skin
      m.material=bootLeg;
      // the boot must be WIDER than the calf or it is a painted sock. Rebuilt per unit, never
      // cached — the v122 disposer frees anything with a .geometry hanging off u.body.
      m.geometry.dispose(); m.geometry=_fourGon(booted?0.26:0.20,booted?0.25:0.185,legD);
    }});
    if(!bare&&!chiton){
      // 0x8d949c was a 0.46 band across the top of the pike line's plinth — bright polished steel
      // exactly where §6.2 puts the bottom 0.14, and it split the boot into two masses on the
      // 40-row ladder. A knee cop is the piece of a harness that gets scuffed; burnished.
      const cuff=new THREE.Mesh(new THREE.CylinderGeometry(booted?0.24:0.19,booted?0.235:0.19,booted?0.15:0.1,8),
        plainMat(greaves?0x9a7532:plateBoots?0x3E444D:booted?NC.blackD:0xd9a92e)); // the folded boot top / knee cop / greave rim
      cuff.position.y=stockings?-0.02:-0.06; cuff.castShadow=false; LG.lower.add(cuff);
    }
  }
  R.legL=legL.upper; R.shinL=legL.lower;
  R.legR=legR.upper; R.shinR=legR.lower;
  for(const S of [R.shinL,R.shinR]){ // feet follow the knee: boots, sandals, or bare
    const vShoe=vAge===5?plainMat(0x1d1a17):bootM; // Enlightenment: black leather shoes
    // 0.28 x 0.18 x 0.48 was a bare box narrower than the shin above it. AD §6.3 wants
    // 0.09 H wide x 0.12 H tall with the toe thrown 0.06 H forward — a squared toe-cap is what
    // makes the base read as a plinth rather than as two ankles.
    const f=new THREE.Mesh(new THREE.BoxGeometry(booted?0.35:0.28,booted?0.24:0.18,booted?0.5:0.48),
      bare?texturedMat("hide",0x33261A):(greaves||chiton)?skinM:plateBoots?plainMat(0x40454c):booted?plainMat(NC.black):vShoe);
    if(booted){const toe=new THREE.Mesh(new THREE.BoxGeometry(0.33,0.16,0.16),plainMat(NC.blackD));
      toe.position.set(0,-0.04,0.28); toe.castShadow=false; f.add(toe);} // the squared toe-cap
    if(greaves||chiton){const strap=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.06,0.1),plainMat(0x5a3c22));
      strap.position.set(0,0.06,0.08); strap.castShadow=false; f.add(strap);} // sandal lacing
    if(vAge===0){const wrap=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.1,0.32),texturedMat("hide",0x4A3524));
      wrap.position.set(0,0.05,0); wrap.castShadow=false; f.add(wrap);} // hide foot wrappings
    if(vAge===5){const buck=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.1,0.04),plainMat(0xd9a92e));
      buck.position.set(0,0.06,0.25); buck.castShadow=false; f.add(buck);} // brass shoe buckle
    // hung off the shin's own length, not off 0.55: a rider's -0.49/-0.51 to the millimetre, and a
    // foot soldier's sole still 0.03 under the turf now that the shin is shorter
    f.position.set(0,booted?-(legD-0.06):-(legD-0.04),0.08); f.castShadow=false; S.add(f);
  }
  // ---- THE CONTACT SHADOW (AD §1.4, §3.8, §8.9) ----
  // Fifty units stand in 02-town and the grass under every boot is byte-identical to the grass ten
  // units away. The sun DOES cast — but §3.1 pins its azimuth 33.7° off +x, so at the default
  // camera yaw every unit's shadow falls behind its own boots and what reaches the frame is a
  // ~10x6px sliver nobody can see. Casting cannot ground a 53px figure standing on a lawn; only a
  // darkening at the contact can, which is the same observation §10.21 makes when it forbids
  // lifting the ink hull off the ground: "the dark 1px seam where a unit meets terrain is doing
  // real grounding work". This is that seam, given a radius.
  // TWO OPAQUE DISCS, NOT ONE FADED ONE, and that is a draw-call decision rather than a taste one.
  // An alpha-faded blob is the obvious build and it is unaffordable: _mergeableMat bars anything
  // transparent from the weld (04-units.js:275), so a faded disc is +1 call on every one of up to
  // 136 bodies. Opaque discs join the pelvis cluster and cost nothing — 16 triangles against
  // §9.2's 134-tris-per-call exchange rate — and a hard two-step falloff is what cel shading does
  // with a soft edge anyway. They also cost no atlas cell: _mergeCluster routes an unmapped
  // plainMat through UATLAS.whiteSlot(), so the hexes are free of §10.6's ~130-cell ceiling.
  // Height, not size, is the number that took the tuning. y=0.075 clears the 4° forward lean
  // animateUnit applies while walking (0.62 x sin 4° = 0.043 of dip at the leading rim) without
  // floating far enough off flat ground to read as a plate. The cost is the corpse case: a felled
  // villager rotates u.body -90° and stands its own discs on edge. Deliberate — fifty living
  // figures that touch the ground beats a tidier dead one.
  // v130.6 A SHADOW ON GRASS IS GRASS, NOT INK. 0x332E26 / 0x1E1A16 are the warm neutrals §2.7
  // keeps for OUTLINES, and dropped on a lawn they measured H36 / S0.21 / L0.19 against turf at
  // H82 / S0.40 / L0.44 — no hue relationship at all, so fifty units stood in fifty brown puddles
  // and, with the brown boots above them, the base of every figure was one blob. §2.2 names the
  // colour a shadow on grass takes: grass.shadow, the ramp's bottom band. These are 02-world's own
  // CORE/MID pool hexes (paintContactShadows, 02-world.js:2087) rather than new ones, so a unit
  // now stands in the same pool the world already paints under every shrub and tree on the map.
  // Eleven sides for the reason that file gives at :2101 — at this radius in the near field an
  // octagon is a legible octagon — and six extra triangles is not a draw call (§9.2).
  if(!mounted){
    const aoR=new THREE.Mesh(new THREE.CircleGeometry(0.62,11),plainMat(0x577132));
    aoR.rotation.x=-Math.PI/2; aoR.position.set(0,0.075,0.05); aoR.castShadow=false; u.body.add(aoR);
    const aoC=new THREE.Mesh(new THREE.CircleGeometry(0.38,11),plainMat(0x3F5A22));
    aoC.rotation.x=-Math.PI/2; aoC.position.set(0,0.088,0.05); aoC.castShadow=false; u.body.add(aoC);
  }
  // the pelvis is trouser cloth too, and on the classes with no coat skirt over it (the musketeer,
  // the whole bow line) it is the TOP of the white band — so it gets the legs' treatment: a facet
  // turned onto the view ray and flat normals, or its smooth 8-gon renders the deep-shadow cell
  // right across the join and reads as a dark bar between the trousers and the coat.
  const pelvisGeo=new THREE.CylinderGeometry(0.35,0.32,0.26,8).toNonIndexed();
  pelvisGeo.rotateY(-Math.PI/8); pelvisGeo.computeVertexNormals(); // MINUS: r128 lathes an 8-gon
  // with its FACE CENTRES at 22.5°, so +π/8 walks them to 45° and leaves the view ray on an edge —
  // which is how the first cut of this shipped a grey-green block at the crotch of every musketeer.
  const pelvis=new THREE.Mesh(pelvisGeo,trouser);
  pelvis.scale.z=0.72; pelvis.position.y=u.rigBaseY-0.08; pelvis.castShadow=false; u.body.add(pelvis);
  u.body.add(R.legL,R.legR);

  // torso: broad shoulders tapering to the waist, belted, with a real neck
  R.torso=new THREE.Group(); R.torso.position.y=u.rigBaseY;
  // v130.3 THE VILLAGER'S JACKET IS TEAM CLOTH AT EVERY AGE (AD §6.5), not just the one where the
  // hide happened to be dyed. It used to be a per-age wardrobe hex — sand, green, off-white,
  // grey-brown, linen — which is why the crowd frame (the owner's priority shot, and a field of
  // nothing but villagers) read as a street of Victorian workmen: a brown coat with a brown apron
  // over it, no team, no livery, nothing a nutcracker owns. §6.5 gives the villager the same
  // jacket the soldier has at 0.75 saturation, so a working town never out-shouts the army
  // standing in it, and §6.6 puts it on the largest cloth area. The six ages stay distinguishable
  // where §5.7 says they should be — in SHAPE: cap tell, tool, cloak/hood/himation/apron/waistcoat,
  // trousers. (The hide weave stays on the stone age: it is the age's material, not its colour.)
  const tunic=u.cls==="villager"?texturedMat(vAge===0?"hide":"cloth",teamJerkin(u.team))
    :bare?skinM                                         // Stone: bare-chested
    :{archer:1,imparcher:1}[u.cls]?texturedMat("hide",0x8a6a48) // skins and wool
    :u.cls==="comparcher"?skinM                         // chiton bares the arms
    :u.cls==="crossbowman"?texturedMat("cloth",0x3f6b35)// lincoln green
    :u.cls==="skirmisher"?texturedMat("hide",0x6a5638)  // ranger buckskin
    :{cataphract:1,elitescout:1}[u.cls]?texturedMat("metal",0x8d949c) // mail head to toe
    :u.cls==="vanguard"?plainMat(AGEPAL[4].dominant)    // Medieval: MATTE mail sleeves (§A.3)
    :u.cls==="musketeer"?texturedMat("uniform",tc)      // Enlightenment: team cassock
    // v130 U1: THE COAT IS THE TEAM BAND (AD §6.6). It used to be CLS[].col — a per-class grey,
    // tan or khaki — so the largest cloth area on the unit carried no team read at all and the
    // only team colour on a foot soldier was a plume you cannot see at 40px. Team colour on the
    // largest cloth area is the AoE placement, and it works here because swapping the hue leaves
    // every band's VALUE untouched: the barcode is carried by hat/beard/trouser/boot, not the coat.
    :texturedMat("uniform",tc);
  // NUTCRACKER column: a proud straight cylinder of painted wood. The chest takes a hide on the
  // bare ages, because a skin-tone cylinder between a skin-tone head and skin-tone legs is not a
  // silhouette, it is a smudge.
  // v130.1 …AND SO ARE THE ARMS. The note here used to say the arms keep `tunic` because "a
  // stone-age unit's bare forearms are the read", and at 4× on the crowd shot that is exactly what
  // they were: two pale vertical bars hanging either side of the torso at the SAME value as the
  // trousers below them, which breaks the rigid column §6.1 priority 4 is built on — the eye reads
  // three light stripes rather than one dark figure. Sleeves in bark-brown hide, hands still bare
  // (the endCap below keeps skinM), so the skin read survives where it is actually legible.
  // v130.3 …and the VILLAGER wears its jacket down the whole arm instead. Bark-brown hide from the
  // elbow down was the last brown left on the unit that fills the crowd frame, and two brown
  // forearms either side of a dyed jerkin read as bare arms — a workman's, not a toy soldier's.
  // Only the genuinely bare-chested soldier classes keep the hide sleeve.
  // v131 THE STONE AGE'S SLEEVES ARE THE STONE AGE'S HIDE. 0x5A422C was a bark-brown picked to
  // read as "not skin" and nothing else, and on the clubman, the spearman and the slinger it is
  // the LARGEST non-team surface on the body — i.e. exactly what §A.1 calls the dominant and what
  // §H A2 measures. Measured, it dragged the Stone rung to V 0.226 against the ladder's 0.374.
  // age0.dominant is the same material doing the same job at the value the ladder asks for.
  const armM=(bare&&u.cls!=="villager")?texturedMat("hide",AGEPAL[0].dominant):tunic;
  // v130.2 THE STONE AGE HAD NO TEAM COLOUR ON ITS BIGGEST SURFACE. `bare` covers the clubman, the
  // spearman, the slinger AND the age-0 villager — i.e. every unit on screen for the first five
  // minutes of a match — and all four wore a plain brown hide torso. Measured over a body mask on
  // the crowd shot the team read came to 8% against §2.5's 20–30% budget, carried entirely by a
  // chest band a sixth of the torso high and a sliver at the belt. Fifty of these on a field and
  // the army reads brown-and-white, not Blue: the one job team colour has, not done.
  // §6.6 already says where it goes — the coat, because swapping the hue there leaves every band's
  // VALUE untouched and the §6.2 barcode is carried by hat/beard/trouser/boot. So the hide torso is
  // DYED. Soldiers take the team hex straight; a villager takes it at §6.5's 0.75 saturation so a
  // working town never out-shouts the army standing in it. Six new 16×16 atlas cells all told —
  // three teams × two saturations — against an atlas with about twenty-five spare (§10.6).
  // THE COAT, as one material, so everything that is coat can ask for it: torso, sleeves, skirt and
  // the plain shoulder caps. For every dressed class that is already `tunic`; only the hide ages had
  // to be told what their coat was.
  const coatM=bare?texturedMat("hide",u.cls==="villager"?teamJerkin(u.team):tc):tunic;
  const torsoM=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.52,1.05,10),coatM);
  torsoM.scale.z=0.8; torsoM.position.y=0.56; torsoM.castShadow=true; R.torso.add(torsoM);
  // THE COAT SKIRT, and the free merge slot it uses. The pelvis was the ONLY mergeable mesh under
  // u.body, and _mergeCluster bails at parts.length < 2 — so it shipped unmerged, with its own
  // material, as the eleventh mesh of an eleven-mesh body. Hanging a second mesh here makes that
  // cluster merge: the mesh count is unchanged and the body drops from two materials to one.
  // Restricted to classes whose torso has no skirt of its own (the musketeer's cassock, the
  // hoplite's pteruges, the vanguard's surcoat, the archers' kilt) so nothing z-fights.
  // v130.2: the stone-age three join the list. They had nothing under the belt at all, so their
  // pelvis cluster was the single-mesh case this slot exists to fix AND the coat stopped dead at
  // the waist — which is a third of the §2.5 team budget left on the floor. (The age-0 VILLAGER
  // stays out: its loincloth and hide rags already occupy that ring and a skirt would swallow them.)
  // v130.5 THE SKIRT ATE THE TROUSER BAND. It hung to y=0.74 with a bottom radius of 0.72 — a
  // quarter of a unit outboard of a thigh that is only 0.47 wide at the hip — so from any camera
  // above the horizon its rim closed over the white leg and what survived was a 0.29 sliver, dead
  // on §5.2's 0.075 H feature floor and under it the moment the sun moved. Downsampled, the whole
  // bottom half of the figure came out one mid-grey: §6.2 measures coat→trouser at 0.44 and the
  // critic read 0.15, which is F3, which is an automatic fail. The trousers are not missing, they
  // are COVERED — the fix is a hem, not a hue. Lifting it to 0.88 puts the coat's bottom edge just
  // under the belt (1.175) where a tunic's hem belongs and opens the white band to 0.43 = 0.112 H,
  // which survives the 40px downsample with room to spare. The overlap with the torso's own bottom
  // (0.985) is 0.175, deliberately generous: `cs` hangs off u.body while the walk clip bobs
  // R.torso, and a tighter fit would crack open a gap at the waist on alternate frames.
  if({shortsword:1,broadsword:1,legionaire:1,spearfighter:1,impspear:1,pikeman:1,
      halberdier:1,crossbowman:1,skirmisher:1,clubman:1,spearman:1,slinger:1}[u.cls]){
    const cs=new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.72,0.28,10),coatM);
    cs.scale.z=0.8; cs.position.y=u.rigBaseY+0.07; cs.castShadow=false; u.body.add(cs);
  }
  // EPAULETTES, AD §6.1 priority 6 — and the second of the figure's two permitted silhouette
  // events. This list used to exclude the entire sword, pike and bow lines, i.e. every unit you
  // actually see on a battlefield, on the grounds that they have "armour shoulders"; most of them
  // have nothing there at all. Kept out only where a class genuinely stacks plates on the same
  // spot and the boxes would z-fight them: the legionaire's layered segmentata, the vanguard's
  // mail caps, the halberdier's pauldrons. Everyone else gets gold.
  const armorShoulders={legionaire:1,vanguard:1,halberdier:1,pikeman:1,hoplite:1}[u.cls];
  const soldierly=(CLS[u.cls].tier>=1||u.isKing)&&!armorShoulders&&u.cls!=="villager";
  // v131 THE EPAULETTES STOPPED BEING GOLD ON ALL SIX AGES, AND THE REASON IS WHERE §H A2 LOOKS.
  // A2 crops 28–58% of the figure's height, and on a §6.1a figure — hat plus head is 0.46–0.54 H —
  // that band is the SHOULDER LINE and the collar, not the belly. A gold box on both shoulders of
  // every age was therefore a constant sitting in the middle of the one region the gate measures,
  // pulling all six means together no matter what the torso did. §B gives each age its own
  // shoulder piece by name (stacked bronze guards, three layered steel plates, matte pauldrons,
  // blued steel with gold etching) and ageShoulders builds them out of AGEPAL. The nutcracker's
  // gold survives as trim on the ages that HAVE gold; age 0 gets a hide pad and a bone toggle,
  // because §A.3's hardest rule is that nothing on a Stone Age unit is metal.
  // The KING keeps his gold: §C makes gold the one thing constant across all six of his ages, and
  // he is the unit that constant exists for.
  const ageShoulder=soldierly&&!u.isKing&&CLS[u.cls].rig!=="cart"&&CLS[u.cls].rig!=="oxcart"
    &&CLS[u.cls].line!=="wilds"&&CLS[u.cls].line!=="trade";
  if(ageShoulder)ageShoulders(R,u,tc);
  for(const sx of [-0.56,0.56]){ // epaulettes for soldiers, plain shoulders for villagers
    if(ageShoulder){ /* built above, per age */ }
    else if(soldierly){
      // seated outboard of the torso's 0.52 so the shoulder line overhangs: shoulderWidth 1.42
      // against headWidth 0.78 is 1.82, clear of the ≥1.6 the anvil silhouette needs (AD 5.3b)
      const ep=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.13,0.42),plainMat(NC.gold));
      ep.position.set(sx,1.02,0); ep.castShadow=false; R.torso.add(ep);
      const fr=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.16,0.34),plainMat(NC.goldD));
      fr.position.set(sx*1.04,0.88,0); fr.castShadow=false; R.torso.add(fr);
    }else{
      const sh=new THREE.Mesh(new THREE.SphereGeometry(0.16,7,6),coatM); // a shoulder is coat, not sleeve-hide
      sh.position.set(sx*0.93,0.97,0); sh.scale.set(1.05,0.78,0.92); sh.castShadow=false; R.torso.add(sh); // (the plain shoulder stays on the torso, not out at the epaulette line)
    }
  }
  if(u.cls==="villager"){ // six ages of working clothes — the town's wardrobe on its people
    if(vAge===0){ // STONE: fur cape over the shoulder, bone charms, team loincloth
      // v130.1 THE TEAM COLOUR BUDGET. §2.5 wants 20–30% of a unit's visible surface carrying team
      // colour; measured on the crowd shot, the age-0 villager had about 5% — a chest triangle and
      // a belt band — against a torso, arms, cap and legs that were all the same brown hide. Fifty
      // of these on a field and you cannot tell whose army you are looking at, which is the one
      // job team colour has. A dyed cloth wrapped round the chest lands the band at ~24% without
      // touching the value ladder: the wrap sits between the hide shoulders and the hide belt, so
      // hat/beard/coat/trouser/boot keep exactly the values §6.2 assigns them and only the HUE of
      // the middle band moves — which is the whole reason §6.6 puts team colour on the coat.
      // v130.2: the wrap is no longer WHERE the team colour lives — the jerkin under it is (see the
      // torso above) — so it flips to dark hide and drops to the waist. Two things fall out of that.
      // The coat band stops being a stripe and becomes a mass, which is the whole §2.5 fix; and the
      // sash gives the stone-age silhouette the belt §2.6 assumes every figure has, at a value that
      // ties it to the sleeves rather than adding a fourth hue. 0x5A422C is the arms' own hex, so it
      // costs nothing in the atlas.
      const wrap0=new THREE.Mesh(new THREE.CylinderGeometry(0.535,0.545,0.14,10),texturedMat("hide",0x5A422C));
      wrap0.scale.z=0.81; wrap0.position.y=0.30; wrap0.castShadow=false; R.torso.add(wrap0);
      const pelt=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.1,0.62),texturedMat("hide",0x6b4a2b));
      pelt.position.set(-0.28,0.85,0); pelt.rotation.z=0.3; pelt.castShadow=false; R.torso.add(pelt);
      // v130.5 the charms drop to the sternum. Everything a villager wears on its upper chest is
      // now under the beard's footprint (world 1.73-2.16) and printing through the one white mass
      // §6.1 ranks second in the figure — three pale dots on the beard, in this case. Below it.
      for(let i=0;i<3;i++){const bone=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.16,0.05),plainMat(0xd2cdbe));
        bone.position.set(-0.16+i*0.16,0.72,0.42); bone.castShadow=false; R.torso.add(bone);}
      const clothF=_noSh(box(0.36,0.46,0.07,tc)); clothF.position.set(0,0.0,0.3); R.torso.add(clothF);
      const clothB=_noSh(box(0.36,0.42,0.07,tc)); clothB.position.set(0,0.02,-0.3); R.torso.add(clothB);
      for(let i=0;i<3;i++){ // jagged hide loincloth strips
        const rag=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.28,0.05),texturedMat("hide",0x8a6a48));
        rag.position.set(-0.24+i*0.24,0.02,0.36); rag.rotation.z=(i%2?0.18:-0.15); rag.castShadow=false; R.torso.add(rag);
      }
    }else if(vAge===1){ // BRONZE: belted cream tunic, short cloak, bronze accents
      const hem=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.56,0.3,10),texturedMat("cloth",0xd0c4a6));
      hem.scale.z=0.8; hem.position.y=0.02; hem.castShadow=false; R.torso.add(hem); // knee-length skirt of the tunic
      const beltB=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.11,10),plainMat(0xc9a44a));
      beltB.scale.z=0.8; beltB.position.y=0.3; beltB.castShadow=false; R.torso.add(beltB); // bronze belt
      const cloak=_noSh(box(0.72,0.85,0.08,0x8ba05e)); cloak.position.set(0,0.55,-0.44); R.torso.add(cloak); // green short cloak
      for(const sx of [-1,1]){const edge=_noSh(box(0.14,0.7,0.1,0x8ba05e)); edge.position.set(sx*0.4,0.62,-0.24); edge.rotation.y=sx*0.5; R.torso.add(edge);} // it wraps the shoulders
      const pin=_noSh(box(0.12,0.12,0.05,0xc9a44a)); pin.position.set(0.24,0.95,0.42); R.torso.add(pin); // bronze cloak pin
    }else if(vAge===2){ // IRON: layered wool over leggings, deep hood on the back, iron buckle
      const layer=new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.6,0.42,10),texturedMat("cloth",0x5a4a36));
      layer.scale.z=0.8; layer.position.y=-0.02; layer.castShadow=false; R.torso.add(layer); // heavy under-layer
      const beltI=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.12,10),plainMat(0x3a2c1e));
      beltI.scale.z=0.8; beltI.position.y=0.3; beltI.castShadow=false; R.torso.add(beltI);
      const buckI=_noSh(box(0.16,0.12,0.05,0x6a7280)); buckI.position.set(0,0.3,0.44); R.torso.add(buckI); // iron buckle
      const hoodB=_noSh(box(0.62,0.66,0.16,0x7a3428)); hoodB.position.set(0,0.72,-0.46); hoodB.rotation.x=0.15; R.torso.add(hoodB); // rust-red hood, thrown back
    }else if(vAge===3){ // CLASSICAL: chiton folds + himation draped over one shoulder
      // 0xcfc6ae IS LUMA 0.886 AND IT WAS THE LAST BLOOM SOURCE ON THIS FIGURE.
      // The pilos was fixed by dropping age3.marble; the census then put 284 clipped px — over §H
      // A8's 200px floor — on the hem of THIS skirt instead, at (255,255,241) with a visible glow
      // off the silhouette. The composer's ceiling is 0.86/1.046/1.02 = 0.806 of authored luma and
      // this was 0.886. VA.accent is §A.3's own age3.marble, "priest's kilt, pilos, exomis" — the
      // hex this garment should always have been using. Same texturedMat call, same (kind,hex)
      // mint count, so the seeded window's Math.random tally does not move (§G.4).
      const foldH=new THREE.Mesh(new THREE.CylinderGeometry(0.51,0.57,0.26,10),texturedMat("cloth",AGEPAL[3].accent));
      foldH.scale.z=0.8; foldH.position.y=0.0; foldH.castShadow=false; R.torso.add(foldH); // chiton skirt
      const cord=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.07,10),plainMat(0x8a6a48));
      cord.scale.z=0.8; cord.position.y=0.3; cord.castShadow=false; R.torso.add(cord); // waist cord
      const hima=_noSh(box(0.36,0.9,0.09,0xb8603a)); hima.rotation.z=-0.5; hima.position.set(-0.1,0.56,0.38); R.torso.add(hima); // terracotta himation, opposite shoulder (0.38: under the beard's front face)
      const himaB=_noSh(box(0.4,0.8,0.09,0xb8603a)); himaB.rotation.z=0.45; himaB.position.set(0.08,0.5,-0.43); R.torso.add(himaB);
    }else if(vAge===4){ // MEDIEVAL: leather work apron, pouch belt, wool everything
      const apron=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.56,0.88,0.08),texturedMat("hide",0x6b4a2b)));
      apron.position.set(0,0.4,0.43); R.torso.add(apron); // the leather apron
      const bib=_noSh(box(0.34,0.3,0.08,0x5a3c22)); bib.position.set(0,0.68,0.44); R.torso.add(bib); // on the apron's chest, clear of the beard above it
      const beltM=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.12,10),plainMat(0x3a2c1e));
      beltM.scale.z=0.8; beltM.position.y=0.24; beltM.castShadow=false; R.torso.add(beltM);
      const pouch=_noSh(box(0.2,0.24,0.14,0x7a5230)); pouch.position.set(0.4,0.14,0.3); R.torso.add(pouch); // belt pouch
    }else{ // ENLIGHTENMENT: waistcoat over linen, brass buttons, neckerchief
      const vest=_noSh(box(0.6,0.94,0.09,0x5a4632)); vest.position.set(0,0.5,0.42); R.torso.add(vest); // the waistcoat front
      for(const sx of [-0.19,0.19]){const stripe=_noSh(box(0.07,0.94,0.02,0x8a7248)); stripe.position.set(sx,0.5,0.475); R.torso.add(stripe);} // earth-tone stripes
      const placket=_noSh(box(0.12,0.94,0.02,0xd8cdb4)); placket.position.set(0,0.5,0.475); R.torso.add(placket); // linen shows down the middle
      const vestB=_noSh(box(0.62,0.94,0.08,0x4e3d2a)); vestB.position.set(0,0.5,-0.43); R.torso.add(vestB);
      for(const ss of [-1,1]){const side=_noSh(box(0.1,0.9,0.5,0x53412c)); side.position.set(ss*0.44,0.48,0); R.torso.add(side);} // it wraps the ribs
      for(let i=0;i<3;i++){const btn=_noSh(box(0.06,0.06,0.03,0xd9a92e)); btn.position.set(0.08,0.78-i*0.24,0.49); R.torso.add(btn);} // brass buttons on the placket
      const kerchief=_noSh(box(0.3,0.2,0.1,tc)); kerchief.position.set(0,1.0,0.34); R.torso.add(kerchief); // team neckerchief
      const beltE=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.1,10),plainMat(0x1d1a17));
      beltE.scale.z=0.8; beltE.position.y=0.22; beltE.castShadow=false; R.torso.add(beltE);
    }
  }else if(bare){ // a knotted hide waistband holds the loincloth
    const wb=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.14,10),texturedMat("hide",0x6b4a2b));
    wb.scale.z=0.8; wb.position.y=0.26; wb.castShadow=false; R.torso.add(wb);
  }else{ // the belt is the coat's bottom edge — raised to the waist so the coat is a band, not a sack
    const belt=new THREE.Mesh(new THREE.CylinderGeometry(0.545,0.545,0.19,10),plainMat(NC.black));
    belt.scale.z=0.8; belt.position.y=0.32; belt.castShadow=false; R.torso.add(belt);
    const buckle=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.15,0.05),plainMat(NC.goldH));
    buckle.position.set(0,0.32,0.45); buckle.castShadow=false; R.torso.add(buckle);
  }
  if(!{clubman:1,shortsword:1,broadsword:1,legionaire:1,vanguard:1,musketeer:1,
       spearman:1,spearfighter:1,impspear:1,hoplite:1,pikeman:1,halberdier:1,
       slinger:1,archer:1,imparcher:1,comparcher:1,crossbowman:1,skirmisher:1}[u.cls]){
    const sash=box(0.34,0.68,0.06,tc); sash.rotation.z=0.5; sash.position.set(0,0.56,0.4);
    sash.castShadow=false; R.torso.add(sash); // baldric across the chest
  } // (the melee line wears its team colors bespoke: loincloth, plumes, cross, cassock)
  // v130 U1 — THE DOUBLE MOUTH IS GONE. There used to be two: one painted into the 64x64 head
  // texture with upper teeth, and a second built here in geometry with lower teeth 0.05 away from
  // it. The seam between them never lined up, so instead of a snapped jaw you got a smear — and
  // the jaw box, the red mouth-inside and the lower teeth all sat on R.torso at z=0.42, i.e. on
  // the CHEST, below the head's own silhouette. Texture wins (AD §6.4): one mouth, painted, with
  // the #FFFFFF tooth band under a #1A1210 band, which is the light-over-dark pair that reads as a
  // bared jaw at 40px. A hinged jaw is explicitly out of scope — it is a twelfth cluster (§10.11).
  R.head=new THREE.Group(); R.head.position.y=1.06; // the chin now clears the torso's top edge
  // THE TURNED HEAD (AD §6.3a). It was a 5-gon prism, and the owner's word for it was "boxy".
  // A real Erzgebirge head is turned on a LATHE — a cylinder with a squared jaw, not a cube with a
  // face painted on one facet — and that roundness is visible in all three reference figures. So:
  // sixteen sides, a domed crown, and a chin squared back on afterwards. Inside a merged cluster
  // this costs ZERO draw calls (§G.1); it costs triangles, and §6.3a says in as many words to
  // spend them.
  // THE SILHOUETTE DOES NOT MOVE. A 5-gon's width is 1.902 R and a 16-gon's is 2 R, so lathing at
  // NC_HEADR would have widened every skull by 5% and pushed the corners through thirty hand-fitted
  // helmets. The lathe is built at NC_HEADRC (see the constant) and comes out 1.103 across, which
  // is what it has always been.
  // FACET FORWARD, NOT VERTEX FORWARD. r128 puts a lathe vertex on +Z, so an EVEN segment count
  // splits the face down the middle and — with the flat normals this build depends on — hangs the
  // ramp's terminator in the seam. That is the v130.4 beard defect (0.71 one side of the seam,
  // 0.98 the other) one part over. Half a segment of rotation puts a facet on the ray instead.
  const hp=(r,y)=>new THREE.Vector2(NC_HEADRC*r,NC_HEADH*y);
  const headGeo=new THREE.LatheGeometry([
    hp(0,0), hp(0.62,0),        // the chin pole and its underside
    hp(0.955,0.09),             // the jaw shelf — everything below the cheek line gets squared
    hp(1,0.20), hp(1,0.82),     // cheeks, dead vertical: the face needs a facet, not a curve
    hp(0.90,0.925), hp(0.55,0.99), hp(0,1)],NC_HEADSEG).toNonIndexed();  // …and a DOMED crown
  headGeo.rotateY(Math.PI/NC_HEADSEG);
  // THE FACE IS PAINTED ON THE HEAD ACROSS ~120° OF FRONTAL ARC (§6.3a), and that number is the
  // whole point of rounding the head. A face plate spans 45° of an 8-gon and a unit turned 25°
  // loses it; the 72° window this replaces was better and still went blank in a three-quarter
  // fight, which is most of the crowd in any frame worth looking at. Five facets of sixteen —
  // 112.5° — carry the paint; the cheeks, the back and the dome sample the texture's top band at
  // a u taken from their OWN angle, so the wood grain carries round the skull instead of smearing
  // one texel across it.
  // UVs ARE TAKEN BEFORE THE JAW IS SQUARED, deliberately. Squaring moves x and z non-uniformly;
  // reading the angle afterwards would stretch the mouth toward the corners of the chin.
  {const P=headGeo.attributes.position, N=P.count, uv=new Float32Array(N*2), F=Math.PI/3;
   for(let t=0;t<N;t+=3){
     const cx=(P.getX(t)+P.getX(t+1)+P.getX(t+2))/3, cz=(P.getZ(t)+P.getZ(t+1)+P.getZ(t+2))/3;
     const cy=(P.getY(t)+P.getY(t+1)+P.getY(t+2))/3;
     const front=Math.abs(Math.atan2(cx,cz))<=F&&cy<NC_HEADH*0.86;
     for(let k=0;k<3;k++){const i=t+k, a=Math.atan2(P.getX(i),P.getZ(i));
       uv[i*2]  =front?0.5+0.47*(Math.max(-F,Math.min(F,a))/F):0.5+0.47*(a/Math.PI);
       uv[i*2+1]=front?Math.max(0,Math.min(1,P.getY(i)/NC_HEADH)):0.945;
     }
   }
   headGeo.setAttribute("uv",new THREE.BufferAttribute(uv,2));}
  // SQUARE THE JAW (§6.3a: "Round the cranium, square the chin — that contrast is the shape").
  // Blended toward the square whose CORNERS sit on the circle, never the one whose flats do: the
  // first leaves the widest point exactly where it was and pulls the flats in, the second would
  // push the corners 39% past the silhouette and undo the whole reason NC_HEADRC exists. The
  // result is a flat-fronted chin under a round skull, which is what a lathe plus a chisel makes.
  {const P=headGeo.attributes.position, yJ=NC_HEADH*0.24, ramp=NC_HEADH*0.20;
   for(let i=0;i<P.count;i++){
     const y=P.getY(i); if(y>=yJ)continue;
     const x=P.getX(i), z=P.getZ(i), r=Math.hypot(x,z); if(r<1e-4)continue;
     const t=Math.min(1,(yJ-y)/ramp)*0.55;
     const k=(1-t)+t*(r/(Math.SQRT2*Math.max(Math.abs(x),Math.abs(z))));
     P.setX(i,x*k); P.setZ(i,z*k);
   }}
  // FACETED NORMALS VIA GEOMETRY, and never material.flatShading — _mergeableMat bars a
  // flat-shaded material from the weld, so that one flag costs a draw call on all 136 bodies
  // (§G.1). De-indexed above, so this gives one normal per triangle: sixteen facets that each
  // catch the sun on their own, which is what "rounder means MORE facets" means.
  headGeo.computeVertexNormals();
  const headM=new THREE.Mesh(headGeo,ncHeadMat());
  headM.castShadow=false; R.head.add(headM);
  // THE BEARD IS AN UPSIDE-DOWN EVERGREEN (AD §6.3c), AND THE PREVIOUS RULE GUARANTEED A BIB.
  // §6.3 asked for `bottomW = 1.15 x topW` — widest at its lowest edge — while complaining in the
  // same paragraph that the shipped beard "renders as a bib". It does; that is what that number
  // makes. Every beard in docs/ref/nutcracker-reference.png is broadest at the cheekbones and
  // narrows to a rounded point. The taper is inverted here and the acceptance test in §6.3c can
  // now fail: `node tools/calib.js beard <class>` measures the widest row, the lowest row and the
  // bottom-fifth taper off the composited silhouette rather than off this comment.
  //
  // ONE LATHE, NOT THREE STACKED CYLINDERS. "Fluffy is a geometry requirement" means the outline
  // needs LOBES, and three frusta bolted together give lobes plus three exposed horizontal
  // annuli — and an exposed horizontal plane is the ramp's TOP cell, i.e. the second-value defect
  // v130.4 and v130.5 both chased. A lathe profile carries the lobes as step-outs in the radius
  // and closes over the top INSIDE the skull, so there is no horizontal plane to catch anywhere.
  //
  // THE Z PROFILE IS LOAD-BEARING AND IT IS WHY THE TEETH SURVIVE. A beard that hangs straight
  // down either buries the mouth or floats off the chest; there is no single z that does both,
  // because the head's front retreats going down (the jaw) while the torso's front does not.
  // A SHEAR does it — z' = z + 0.58·(−y) — so the mass is tucked behind the face at the mouth
  // (front 0.44 against the skull's 0.485 at the tooth band, so the §6.4 pair stays visible in
  // the gap between moustache and beard exactly as it does in the reference) and juts 0.23 past
  // the coat at the tip. It also rakes the front face up 30°, which lands it in the ramp's LIT
  // cell — harmless now, and it would not have been while this surface was the brightest thing
  // on the figure.
  // §2.6a / §G.5 — (u.id, AGE), NEVER Math.random(). Two classes of override ride on top of it,
  // and both are still pure functions of state the sim already agrees on:
  //   §C — the King's beard is auburn #7A4526 (the reference king's tone) at ages 0-3 and IRON
  //        GREY #6E665C at 4-5. He visibly ages across the game; it is the cheapest characterful
  //        thing in the whole document and it costs one ternary.
  //   §D — the neutrals are named tones: golden-blonde on both vikings (the reference art's Norse
  //        figure), dark walnut on the barbarian.
  // v131.2 THE AGE TERM IS NEW AND IT IS THE POINT. `u.id % 5` with no age in it put the SAME
  // five warm browns in the middle of §H A2's crop on all six ages, where the beard is 22-52% of
  // the measured pixels — the gate came back at ΔE00 3.1 worst pair and 0.001 adjacent ΔV on
  // Medieval/Enlightenment because it was largely measuring one constant six times. See the table
  // in 00-data.js for the ladder and for why ages 1 and 3 are the same value on purpose.
  const _kingBeard=(CLS[u.cls].rig==="king"), _bOv=CLS[u.cls].beardTone;
  const _bAge=unitAge(u), _bSlot=_bAge*BEARD_PER_AGE+(u.id%BEARD_PER_AGE);
  // §2.6b: one in five is an elder. Pure function of u.id — never Math.random(), or peers desync.
  // The king is excluded because he already ages on his own clock, and a class with an explicit
  // beardTone (the neutrals, §D) keeps the tone its §D entry names.
  const _elder=!_kingBeard&&_bOv===undefined&&(u.id%5)===2;
  const bTone=_kingBeard?(_bAge>=4?0x6E665C:0x7A4526)
    :_bOv!==undefined?_bOv:(_elder?ELDER_TONES[_bAge]:BEARD_TONES[_bSlot]);
  const bT=NC_HEADRC*1.081;                                  // topW 1.192 = 1.081 x headWidth (§6.3c: 1.05-1.15)
  const bp=(r,y)=>new THREE.Vector2(bT*r,y);
  // THE PROFILE RUNS BOTTOM-TO-TOP, AND THAT IS NOT A STYLE CHOICE. r128's LatheGeometry winds
  // its faces from the order it is handed, so a profile written the way you'd describe a beard —
  // cheeks first, tip last — comes out INSIDE-OUT. With side:FrontSide the near wall is culled and
  // you see the far one, which is 0.4 further back: the whole mass renders BEHIND the chest armour
  // while still filling exactly the right silhouette. It cost an hour, because every isolated shot
  // of the beard on its own looked perfect — the far wall has the same outline as the near one.
  // v131.2 THE TIP LANDS ON THE STERNUM, NOT ON THE BELT, AND THAT IS A MEASURED NUMBER.
  // The chin pole sits at world 2.01 and the belt at 1.25 (rigBaseY + 0.30). The old profile ran
  // to y=-0.75, i.e. world 1.26 — ON the belt, to within a centimetre. Rendered, the mass covered
  // the entire coat front: §2.5 wants 20-30% of a unit in team colour and all six ages came back
  // at 9.9-17.4%, with the surviving blue two sleeves and a hem, so forty units in one frame read
  // as forty beards instead of as an army. It also owned §H A2's crop (52% of it on Stone).
  // THE 0.30-0.40 H IN §6.3c CANNOT BE HAD ON THIS RIG AND THE BELT CLEARANCE IS THE ONE THAT
  // RENDERS. H is ~3.85 world units here, so 0.30 H is 1.16 below a chin that has only 0.76 above
  // the belt to give: §6.3c asks in the same table for length 0.30-0.40 H *and* "clear of the
  // belt", and on a §6.1a head — deliberately oversized, and it is not going back — those two are
  // not simultaneously satisfiable. Clear-of-the-belt wins because it is the one the render and
  // the team-colour budget can both see. 0.48 below the chin = 0.125 H, tip at world 1.53, 0.28
  // clear of the belt. Do not lengthen it back without re-measuring the team fraction.
  const beardGeo=new THREE.LatheGeometry([
    bp(0,-0.48), bp(0.21,-0.443),         // the ROUNDED tip, never a flat cut
    bp(0.36,-0.385),                      // bottomW 0.36 x topW (§6.3c: 0.35-0.45)
    bp(0.46,-0.282),
    bp(0.68,-0.077), bp(0.64,-0.048),     // lobe 2 — the radius steps back OUT going up
    bp(0.92,0.113), bp(0.88,0.143),       // lobe 1: the outline scallops instead of running straight
    bp(1.00,0.26),                        // THE CHEEK LINE — widest row, and it frames the face
    bp(0.86,0.30), bp(0,0.34)],8).toNonIndexed();   // closes over INSIDE the skull: no top plane
  // v131.4 THE LATHE IS 8 SEGMENTS AND NOT 10 — §H A10. §6.3c's "fluffy" is LOBES IN THE PROFILE,
  // which is where all ten of the radius steps above still are; the revolution count only decides
  // how round the mass is in plan, and at 40px, on a mass 1.19 across, 8 and 10 are the same
  // silhouette. It is 36 triangles per body across 136 bodies.
  beardGeo.rotateY(Math.PI/10);                              // facet forward — see the head, above
  // THE DEPTH DOES NOT TAPER WITH THE WIDTH, AND THAT IS THE WHOLE FIGHT.
  // The first cut scaled z by a flat 0.56 and sheared the mass forward, which is the obvious
  // build and it renders as a beard SLICED BY THE ARMOUR: measured, the broadsword's lamellar
  // plates stand at z=0.556 and the beard's mid-section landed at 0.520-0.556, so the plates came
  // through it in stripes. The cause is that a lathe's depth shrinks with its radius, and §6.3c
  // wants the radius to shrink hard — so exactly where the beard needs to be furthest forward
  // (on the chest) it was thinnest. Decouple them: the ring's WIDTH follows the profile, its
  // DEPTH grows going down. Measured against the two things that bound it, this leaves the
  // tooth band clear by 0.049 and the chest plates covered by 0.13.
  {const P=beardGeo.attributes.position;
   for(let i=0;i<P.count;i++){
     const y=P.getY(i);
     const s=0.72+0.33*Math.min(1,Math.max(0,(0.26-y)/0.68));   // 0.72 at the cheeks → 1.05 at the tip
     P.setZ(i,P.getZ(i)*s-0.58*y);                              // …and the forward rake
   }}
  beardGeo.computeVertexNormals();                           // faceted, in GEOMETRY (§G.1)
  const beard=new THREE.Mesh(beardGeo,plainMat(bTone));
  beard.position.set(0,0,0.19); beard.castShadow=false;     // §6.3c: parented to the HEAD, forward of the torso
  R.head.add(beard);
  // THE MOUSTACHE — separate, one step darker (§2.6a), and sitting ON the beard's widest part.
  // §6.3c: "Without it the cone starts from nowhere." It is the only part of the face still in
  // geometry, and it earns that because it is the feature a nutcracker is recognised by after the
  // hat: carried round the corner it puts a dark, face-shaped mark on the cheek that a
  // three-quarter viewer is actually looking at, where paint alone rakes away.
  // v130.5's constraint still binds and is why the bar is 0.66 and not 0.98 wide: at half-width
  // 0.33 the corners stay inside the skull's plan outline, so this is a bump on the cheek in
  // profile and NOT a third silhouette event on a figure §6.3 budgets at two.
  const mTone=_kingBeard?(_bAge>=4?0x4F4942:0x58321C)
    :_bOv!==undefined?MOUSTACHE_TONES[BEARD_TONES.indexOf(_bOv)>=0?BEARD_TONES.indexOf(_bOv):0]
    :(_elder?ELDER_MOUSTACHE[_bAge]:MOUSTACHE_TONES[_bSlot]);
  // A HELMET THAT COVERS THE FACE MUST COVER THE FACE GEOMETRY TOO. The Medieval great helm
  // encases the skull from 0.06 H above the chin upward, and the moustache bar stands at z=0.47
  // with 0.26 of depth — front face 0.60, outside the helm's own surface — so the fully-enclosed
  // vanguard rendered a moustache and two curled tips ON THE OUTSIDE of a closed bucket, which is
  // what "the only unit in the game with no face" looked like when it was actually looked at.
  // Cheeks, brows, eyes and teeth are PAINT on the skull and are hidden by the helm solid; only
  // these three boxes were geometry, so only these three need suppressing.
  // R.face collects them so a closing helmet can take them off again — the helmets are built
  // AFTER this, in the class-flair block, so a flag set here could not know. Removing from
  // R.head before mergeUnitBody() runs means the merge never sees them and nothing is orphaned.
  R.face=[];
  const tash=_noSh(box(0.66,0.11,0.26,mTone));
  tash.position.set(0,0.415,0.47); R.head.add(tash); R.face.push(tash);  // proud of the skull's 0.541 front facet
  for(const sx of [-1,1]){                                    // the curled tips, straight off the reference
    const cu=_noSh(box(0.13,0.13,0.20,mTone));
    cu.position.set(sx*0.36,0.445,0.45); cu.rotation.z=sx*0.5; R.head.add(cu); R.face.push(cu);
  }
  // every legacy hat in the file is hand-fitted to the old egg — this re-seats the lot (see above)
  R.hat=headHatCarrier(R);
  // ---- v128.3: THE HEAD OUTLINE IS OFF BY DEFAULT, and this is why ----
  // Inking ONLY the head was a draw-call decision (one extra call against the ~33 a body costs)
  // and it was the wrong call artistically. A cel outline is a STYLE: apply it to one part of one
  // object and it does not read as a line, it reads as a defect — John's desktop playtest called
  // it exactly that, "odd", and noticed immediately that nothing else on the map had it.
  // Outlining the whole character is what would fix the inconsistency, and that is ~33 extra draw
  // calls per unit against a host already measured at 10–19 fps with ~1,800. Not affordable.
  // So: off, unless asked for with ?ink=heads. The machinery stays because the BAKED-hull route
  // (merging an inside-out shell into the geometry itself, the way the trees would need) makes
  // full-character outlines free of draw calls — that is the version worth building.
  try{
    if(/[?&]ink=heads/.test((typeof location!=="undefined"&&location.search)||""))inkOutline(headM,2.0);
  }catch(_){}
  R.torso.add(R.head);
  const armL=limb2(0.16,0.13,0.10,0.5,0.52,bare?coatM:armM,-0.68,0.96,0,armM);
  const armR=limb2(0.16,0.13,0.10,0.5,0.52,bare?coatM:armM, 0.68,0.96,0,armM);
  R.armL=armL.upper; R.faL=armL.lower;
  R.armR=armR.upper; R.faR=armR.lower;
  // THE SLEEVE BANDS — the other half of §2.5's budget, and they are on the ARM on purpose.
  // The age's dominant is armour laid ON TOP of the team coat (§A.1), so the coat — the surface
  // §6.6 nominates — is the one surface every age covers, and the melee line measured 9.9-18.5%
  // against a 20-30% budget with the survivors two sleeves and a hem. An upper-sleeve band is
  // outside the armour on every age in §B and it is the second-largest team area available after
  // the waist. It also rides the arm, so it swings — team colour that MOVES reads at distance.
  // Not on the king: his orphrey band already puts him at 17-31% and §2.5's ceiling is 35%.
  if(CLS[u.cls].rig!=="king")for(const A of [R.armL,R.armR]){
    const cuf=_noSh(cyl(0.185,0.20,0.36,tc,8)); cuf.position.y=-0.12; A.add(cuf);
  }
  endCap(R.faL,0.12,skinM,-0.54); endCap(R.faR,0.12,skinM,-0.54); // hands
  R.torso.add(R.armL,R.armR);
  u.body.add(R.torso);

  const noShadow=m=>{m.castShadow=false;return m;};
  const rig=CLS[u.cls].rig, tier=CLS[u.cls].tier||0;
  // class flair — hats on the head, WEAPONS IN HANDS so they swing
  if(rig==="villager"){
    // ---- the hat tells the century, but EVERY century now wears one ----
    // v130.1 THE PRIORITY SHOT CONTAINED ZERO NUTCRACKERS. 04-crowd is a field of villagers — the
    // unit that fills the screen for the first five minutes of every match and the frame the owner
    // puts beside Valheim — and at 4× magnification every head covering in it read as HAIR: a
    // rounded brown shag with a forehead fringe, tapering INWARD at the crown, no brim, no band.
    // Measured, the age-0 cap sat at 0.45 screen value where §6.2 wants the top mass at 0.14, and
    // §F4 auto-fails a unit with no visible hat mass above the head. kitShako had been written and
    // proved (it is what makes the legionaire read); it was simply never called for the class that
    // fills the frame — the hat carrier only re-seated the thirty legacy blocks, it did not replace
    // them. All six now sit on it.
    // WHAT DID NOT CHANGE: §6.5 gives the villager a SHORT profile — a low cap at 0.12 H, not the
    // soldier's 0.24 H shako — so a worker and a soldier are still different silhouettes at 40px.
    // What changed is the VALUE (near-black instead of tan-on-tan with the face), the BRIM notch
    // that stops hat and head merging into one blob, and a band at the §5.2 feature floor.
    // v130.3 AND THE BANDS STOPPED BEING BROWN. The crowns were already at §6.2's 0.14, but the
    // band is a third of a short cap's height and the widest part of it, so a 0.32-value tan band
    // (0x6B4A2B, 0x8A6A48) painted the whole hat mid-brown at 40px — which is how a black felt cap
    // got reported as a Victorian bowler. Dark leather where the age has no metal, brass where it
    // does. Brass is not a value problem: the soldier's shako carries a full gold band twice this
    // tall and still reads 0.14, because the crown around it is four times its area.
    // Each age still keeps exactly one geometric tell on top of the shared cap, so the wardrobe
    // fingerprint in tools/smoketest.js:427 stays six distinct signatures.
    // v130.3 THE TELLS CAME OFF THE LEGACY CARRIER. They used to hang on R.hat, which exists to
    // re-seat hats drawn for a head this file no longer builds — two coordinate systems, and the
    // note here used to warn that the y values were "NOT interchangeable". They are now: every
    // tell below is in head space, seated against the cap's own base NC_HATY, next to the
    // kitShako call that puts the cap there. That also keeps them off R.hat's 0.826 Y scale,
    // which would have squashed the Phrygian cone and sheared the tricorn's tilted brim panels.
    // They were mis-seated by about a fifth of a head as well — the felt rim, the chin cord and,
    // worst, the tricorn's three panels, which crossed the eyes like a visor.
    // v131 SIX AGES OF VILLAGER, SIX CAP FORMS — and until now it was six calls to kitShako with
    // col:NC.black, i.e. the same black felt cap from the Neolithic to the Enlightenment with one
    // geometric tell bolted on top. That is the exact defect §6.5a was written against, one class
    // down: "kitShako() may be called for age 5 ONLY. If a helmet's construction begins by calling
    // the shako function, the age has already failed." It matters more here than anywhere else,
    // because the villager is the unit that fills the crowd frame — the owner's priority shot is a
    // field of nothing but these — and a Stone Age town of men in black bowlers is what a critic
    // sees first.
    // §6.5's villager profile does NOT change: a LOW cap at 0.12–0.20 H against the soldier's
    // 0.24 H, so a worker and a soldier are still different silhouettes at 40px. What changed is
    // the form and the hex, both out of §B.7 and AGEPAL.
    const VCAP_H=0.47;                            // 0.12 H — §6.5's villager cap
    const VA=AGEPAL[vAge<0?0:vAge];
    if(vAge===1){ // Bronze: a folded linen head-cloth, TC band. Bare-headed is §0-forbidden.
      const cloth=noShadow(box(0.76,0.36,0.76,VA.dominant)); cloth.position.y=NC_HATY+0.10; R.head.add(cloth);
      const fall=noShadow(box(0.74,0.50,0.10,VA.dominant)); fall.position.set(0,NC_HATY-0.16,-0.40); R.head.add(fall);
      const bandV=noShadow(cyl(0.60,0.615,0.117,tc,12)); bandV.position.y=NC_HATY+0.0150; R.head.add(bandV);
    }else if(vAge===2){ // Iron: an undyed wool cap with the Phrygian curl, in the age's own grey
      const cap=_lm([[0.575,0],[0.55,0.22],[0.42,0.40],[0,0.48]],12,0x8A8078);
      cap.position.y=NC_HATY-0.06; R.head.add(cap);
      const phry=noShadow(cone(0.34,0.62,0x6E665C,8)); phry.rotation.x=0.35; phry.position.set(0,NC_HATY+0.36,0.08); R.head.add(phry);
      const tip=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13,6,5),plainMat(0x5A5148)));
      tip.position.set(0,NC_HATY+0.62,0.30); R.head.add(tip); // the forward curl
      const bandV=noShadow(cyl(0.585,0.60,0.10,tc,12)); bandV.position.y=NC_HATY+0.0064; R.head.add(bandV);
      // §B.7's 40px cue: THE CHECKED CLOAK ON ONE SHOULDER — the only plaid in the game, pinned
      // with a bronze fibula, and the check is real Iron Age textile rather than decoration.
      const ck=VA.check;
      for(let i=0;i<4;i++){const st=noShadow(box(0.26,0.99,0.062,ck[i]));
        st.position.set(-0.40+i*0.20,0.52,-0.44); R.torso.add(st);}
      const fib=noShadow(cyl(0.09,0.09,0.05,VA.crown,8)); fib.rotation.x=Math.PI/2; fib.position.set(-0.42,0.94,0.32); R.torso.add(fib);
    }else if(vAge===3){ // Classical: the PILOS — brimless, conical, soft felt. No brim in this age.
      const pil=_lm([[0.545,0],[0.44,0.22],[0.27,0.42],[0.11,0.54],[0,0.58]],12,VA.accent);
      pil.position.set(0,NC_HATY-0.05,0); pil.rotation.x=0.10; R.head.add(pil);
      const bandV=noShadow(cyl(0.555,0.565,0.10,tc,12)); bandV.position.y=NC_HATY+0.0064; R.head.add(bandV);
      const cordP=noShadow(cyl(0.60,0.60,0.05,VA.leather,12)); cordP.position.y=NC_HATY-0.12; R.head.add(cordP);
    }else if(vAge===4){ // Medieval: the chaperon hood with a short liripipe, thrown over a coif
      const hoodV=_lm([[0.60,0],[0.54,0.26],[0.38,0.52],[0.16,0.70],[0,0.78]],10,VA.green);
      hoodV.position.set(0,NC_HATY-0.10,0); hoodV.rotation.x=-0.16; R.head.add(hoodV);
      const lir=noShadow(cyl(0.05,0.078,0.66,VA.green,6));
      lir.position.set(0,NC_HATY-0.16,-0.52); lir.rotation.x=-0.45; R.head.add(lir);
      const coifV=noShadow(cyl(0.615,0.625,0.14,tc,12)); coifV.position.y=NC_HATY+0.03; R.head.add(coifV);
      const mantle=new THREE.Mesh(_facetGeo(new THREE.CylinderGeometry(0.56,0.8,0.4,12),12),plainMat(VA.dominant));
      mantle.scale.z=0.85; mantle.position.y=0.98; mantle.castShadow=false; R.torso.add(mantle);
    }else if(vAge===5){ // Enlightenment: a round-crowned felt hat with a real brim. THE one brim.
      kitShako(R,tc,{h:VCAP_H,col:0x4A3E30,brimCol:VA.dark,brimR:1.34,band:NC.gold,bandH:0.15,
        plate:false,plume:false,flare:0.94});
      // §B.7's 40px cue: THE APRON — a pale rectangle hung on the front, over white stockings
      const apron=noShadow(box(0.62,0.78,0.062,0xC9B48A)); apron.position.set(0,0.32,0.47); R.torso.add(apron);
      const tie=noShadow(box(0.66,0.086,0.05,0xC9B48A)); tie.position.set(0,0.70,0.47); R.torso.add(tie);
    }else{ // Stone: the hide skullcap at the villager's height, thong band, bone toggle
      helmHideDome(R,tc,VA,{rw:0.70,hh:0.50,strap:false});  // see above: the brow ring is 0.82 rw now
      const tailH=noShadow(box(0.13,0.38,0.1,VA.dark)); tailH.position.set(0,NC_HATY-0.24,-0.58); tailH.rotation.x=0.5; R.head.add(tailH);
      const boneH=noShadow(box(0.06,0.2,0.05,VA.accent)); boneH.position.set(0.42,NC_HATY-0.22,0.40); boneH.rotation.z=0.4; R.head.add(boneH);
      // the Otzi stripe: alternating dark and light hide in bands of 0.045 H, and §B.7 calls it
      // "the only striped cloth in the game". It rides OVER the team jerkin, which keeps §6.5's
      // 0.75-saturation dyed working cloth as the field.
      for(let i=0;i<2;i++)_tRing(R,0.44+i*0.40,0.156,VA.light,0.560,0.578,12);
    }
    if(vAge===1||vAge===3){ // the wrapped linen kilt / the exomis's cut-back right shoulder
      const kilt=new THREE.Mesh(_facetGeo(new THREE.CylinderGeometry(0.56,0.62,0.32,12),12),plainMat(VA.dominant));
      kilt.scale.z=0.8; kilt.position.y=0.12; kilt.castShadow=false; R.torso.add(kilt);
      if(vAge===3){const cut=noShadow(box(0.32,0.34,0.44,VA.accent)); cut.position.set(0.40,0.90,0); R.torso.add(cut);}
    }
    // ---- the tool tells the trade ----
    const TG=weaponGrip(R.faR,-0.9); // gripped in the fist like every weapon
    if(vAge!==5)TG.rotation.x-=Math.PI/4; // carried at the ready, leveled 45° off vertical (playtest-tuned; shovel rests low)
    const TS=new THREE.Group(); TG.add(TS); // spin carrier: rotates the tool about its own haft
    if(vAge!==5)TS.rotation.y=-Math.PI/2;   // playtest: 90° clockwise seen top-down
    const haftM=texturedMat("wood",0x8a6a3f);
    if(vAge===0){ // crude stone axe, lashed head
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.11,0.85,0.11),haftM)); haft.position.y=0.1; TS.add(haft);
      const stone=noShadow(box(0.34,0.2,0.13,0x8a8378)); stone.position.set(0.1,0.5,0); TS.add(stone);
      const lash=noShadow(box(0.14,0.1,0.15,0x5a3c22)); lash.position.set(0,0.5,0); TS.add(lash);
    }else if(vAge===1){ // bronze sickle
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.6,0.1),haftM)); haft.position.y=0; TS.add(haft);
      // v131.11 JOHN: "bronze age villager sickle head not connected to handle". The hook did
      // not ride the haft's tip, it ORBITED it: the torus was centred ON the tip (0.08,0.3), and
      // the centre of a ring is empty space, so every scrap of bronze stood a full radius away.
      // Nearest metal to wood 0.0860, ALL OF IT SIDEWAYS — which is why the A12 grip gate passed
      // it: gripcheck.js joins parts by box overlap (TOUCH 0.045) and the ring's box straddles
      // the haft's box. A box test cannot see round a curve.
      // (Hand check on a SMOOTH tube of the same radii gives 0.0774, at the arc's 189-deg end.
      // The mesh reads 0.0860 because radialSegments=5 makes the cross-section a pentagon whose
      // inner face sits at the apothem 0.05*cos36 = 0.0405, not at the tube 0.05 — 0.0086 of the
      // tube is not there. Measurement and arithmetic agree once that is in.)
      // THE TANG IS THE ARC'S 0-END. TorusGeometry sweeps anticlockwise from +x, so at theta=0
      // the tube runs along +Y — parallel to the haft — and its open face points straight DOWN: a
      // 0.05 disc that exactly inscribes the 0.10 square haft. The far end (189 deg) has come
      // round past horizontal and is the point. Haft 0.6 tall at y=0, so its top face is
      // 0+0.6/2 = 0.30; bury the tang half a haft-thickness (0.05) and the seat is y 0.25, with
      // the metal leaving the wood at 0.30. The tang sits at centre+(R,0,0), so the centre goes
      // to (0-0.26, 0.25). Measured after: 0.022 of bronze inside the haft solid, was 0.086
      // clear. Costs the tool 0.05 of reach: top 0.608 -> 0.558.
      const blade=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.26,0.05,5,9,Math.PI*1.05),plainMat(0xc9a44a)));
      blade.position.set(-0.26,0.25,0); TS.add(blade); // tang buried 0.05 in the haft's top face
    }else if(vAge===2){ // iron pick
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.85,0.1),haftM)); haft.position.y=0.1; TS.add(haft);
      const pickL=noShadow(cone(0.07,0.4,0x6a7280,5)); pickL.rotation.z=Math.PI/2; pickL.position.set(-0.24,0.52,0); TS.add(pickL);
      const pickR=noShadow(cone(0.07,0.4,0x6a7280,5)); pickR.rotation.z=-Math.PI/2; pickR.position.set(0.24,0.52,0); TS.add(pickR);
    }else if(vAge===3){ // the balanced sickle, steel on a turned grip
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.66,0.1),haftM)); haft.position.y=0.02; TS.add(haft);
      const grip=noShadow(cyl(0.07,0.07,0.16,0xcfc6ae,6)); grip.position.y=-0.24; TS.add(grip);
      // v131.11 JOHN: "classical age sickle not attached to handle" — the same defect and the
      // same derivation as the Bronze hook above. The ring was centred ON the haft's tip, and a
      // ring's centre is empty, so the nearest steel stood 0.1017 clear of the wood: 0.0935 on a
      // smooth tube of these radii, plus 0.0082 of 5-gon inset (apothem 0.045*cos36 = 0.0364
      // against the 0.045 tube). Sideways again, so the A12 box test called it one object.
      // Haft 0.66 tall at y=0.02, top face 0.02+0.33 = 0.35. Tang = the arc's 0-end, where the
      // tube runs along +Y and its open face points down — a 0.045 disc inside the 0.10 haft.
      // Bury it half a haft-thickness (0.05): seat at y 0.30, centre at (0-0.28, 0.30). The point
      // is the far end at 198 deg, swung back past horizontal — that is the hook. Measured after:
      // 0.025 of steel inside the haft solid. Costs 0.04 of reach: top 0.665 -> 0.625.
      const blade=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.28,0.045,5,9,Math.PI*1.1),plainMat(0xb9c0c9)));
      blade.position.set(-0.28,0.30,0); TS.add(blade); // tang buried 0.05 in the haft's top face
    }else if(vAge===4){ // the scythe: long snath, angled blade
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09,1.15,0.09),haftM)); haft.position.y=0.2; TS.add(haft);
      const peg=noShadow(box(0.2,0.07,0.07,0x6b4a2b)); peg.position.set(0.1,0.05,0); TS.add(peg); // grip peg
      // v131.11 JOHN: "medieval villager hoe head not connected to handle". The blade's CENTRE
      // was parked on the snath's top (0.26,0.78 against a top face at 0.775) and THEN raked
      // -0.5 about that centre, which swings the mounting end up and away: its inner-bottom
      // corner landed at (0.0019,0.8811), 0.106 above the wood, and the nearest surface-to-
      // surface distance was 0.0725. The A12 y-scan missed it because the blade's FAR end dips
      // to 0.617, below the snath's top, so the two stacks overlap — the daylight is at the end
      // that mounts, not along the axis (measure the joint, not the box). Seat the INNER END
      // instead and leave the rake alone. Snath 1.15 tall at y=0.2 -> top face 0.2+0.575 =
      // 0.775; bury half a haft-thickness (0.09/2 = 0.045) so the inner end face centre goes to
      // (0,0.73). That face is at centre-0.275*(cos0.5,-sin0.5) = centre-(0.2413,-0.1318), so
      // the blade centre is (0.2413, 0.73-0.1318) = (0.2413,0.5982). Separating-axis test against
      // the snath: 0.062 of overlap on x over the full 0.09 of z, where it was 0.0725 SEPARATED.
      // NOTE for the next probe: the blade is 0.11 deep against a 0.09 snath, so all four inner
      // corners still sit 0.010 OUTSIDE in z. A vertex-to-box metric reports +0.010 and reads as
      // detached; the solids interpenetrate. Costs the tool 0.17 of reach (0.943 -> 0.775, the
      // snath's own tip becoming the highest point).
      const blade=noShadow(box(0.55,0.07,0.11,0x9aa2ad)); blade.position.set(0.2413,0.5982,0); blade.rotation.z=-0.5; TS.add(blade);
    }else{ // the improved shovel: iron blade, D-grip
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09,0.8,0.09),haftM)); haft.position.y=0.06; TS.add(haft);
      const blade=noShadow(box(0.26,0.32,0.06,0x8d949c)); blade.position.y=0.6; TS.add(blade);
      const dgrip=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.1,0.035,5,8),plainMat(0x5a4632)));
      dgrip.position.y=-0.36; TS.add(dgrip);
    }
  }
  // ============================================================================================
  //  §E THE TRADER — A WALKING MERCHANT NUTCRACKER (v131.7, and it had never been built)
  // ============================================================================================
  // See the note at the head of _buildBodyRaw for what this replaces. §E's row, verbatim, is the
  // build order below: "Tall brimmed felt hat… long travelling coat with gold frogging and a
  // fur-trimmed collar. Strongbox on the back with gold corner bands… coin scale in one hand.
  // Gold chain of office." Its stated 40px read is THE STRONGBOX HUMP, and that is the part sized
  // against a gate rather than against the eye: at 40px a merchant's hat and a merchant's coat are
  // a hat and a coat, and the only thing on this figure no other unit in the game has is a load
  // carried ABOVE THE SHOULDER LINE BEHIND THE HEAD.
  //
  // EVERY PART HERE PARENTS INTO R.head, R.torso, R.faL or u.body — the clusters the nutcracker
  // rig already merges — so this is 17 meshes at ZERO new draw calls (§H A10 ceiling 12; measured
  // 11, the same as any foot unit). Nothing casts: _mergeCluster ORs the flag over the cluster, so
  // one castShadow under R.head makes a caster of all 136 bodies.
  //
  // NO NEW (kind,hex) TEXTURE PAIR IS MINTED. §G.4 / trap A9: texturedMat mints a CanvasTexture on
  // a miss and `new THREE.CanvasTexture` burns four Math.random() calls, so a first-request inside
  // 02-world's seeded window walks every resource node on the wire and forces PROTO off 26. The
  // coat re-uses the shared `coatM` the body already built; everything added here is plainMat,
  // which routes through UATLAS.whiteSlot() and costs neither a random nor an atlas cell.
  if(u.cls==="trader"){
    // ---- THE HAT: tall brimmed felt (§E), and it is built here rather than through kitShako ----
    // kitShako's own header says it "MAY BE CALLED FOR AGE 5 AND FOR NOTHING ELSE", because six
    // ages routed through it is how the set ended up as six shakos in six colours. That rule is
    // about the six-rung AGE ladder §H A1b scores; a civilian merchant is not on it. Building the
    // three parts explicitly keeps it that way and costs nine lines.
    // THE SUPERLATIVE §E CLAIMS IS HEIGHT, NOT WIDTH — "the tallest civilian hat in the game" —
    // so the crown is 0.86 against the villager caps' 0.47 and the brim stays at 1.56 across,
    // INSIDE the Enlightenment shako's 1.68. §6.5a spends the widest brim in the set on age 5 and
    // this does not take it back.
    const felt=0x4A3E30;
    // …and it is SUNK 0.15 into the skull, not perched on it. Seated level with the crown of the
    // head the two solids only touch, and the walk clip bobs R.torso under a head that does not
    // move with it — the first cut of this opened a hairline of magenta between hat and scalp on
    // alternate frames, which is the same defect every legacy hat in the file was re-seated to fix.
    const brimT=noShadow(cyl(0.78,0.78,0.075,0x3A3126,16)); brimT.position.y=NC_HATY-0.02; R.head.add(brimT);
    const crownT=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.615,0.60,0.86,12),plainMat(felt)));
    crownT.position.y=NC_HATY+0.37; R.head.add(crownT);
    // The band is 0.12 and not 0.16, and §E does not ask for a team band on this hat at all — the
    // row is crown, brim, and nothing else. It stays because §0 wants a team read on every head,
    // and it stays THIN because this class is already over §2.5's ceiling on the coat below.
    const hbandT=noShadow(cyl(0.625,0.635,0.12,tc,12)); hbandT.position.y=NC_HATY+0.05; R.head.add(hbandT);
    const buckT=noShadow(box(0.17,0.17,0.05,NC.gold)); buckT.position.set(0,NC_HATY+0.06,0.60); R.head.add(buckT);
    // ---- THE FUR-TRIMMED COLLAR (#7A5A38) and the GOLD CHAIN OF OFFICE ----
    // The collar stands PROUD of the shoulder line (0.60 against the torso's 0.52) because it is
    // the one place a merchant's silhouette is allowed to be soft, and because it is what stops
    // the strongbox behind it reading as a growth out of the neck.
    // 0.34 deep, which is what a fur collar on a travelling coat is, and it is also §2.5 doing
    // arithmetic: measured over the figure mask this class came out 34.2% team colour against a
    // 20-30% want, because §E's floor-length coat roughly doubles the TC cloth area of a foot unit.
    // A deeper collar is the one surface §E already nominates in a non-team hex that sits in the
    // middle of the blue. Re-measured after: see the note at the trader's head.
    const fur=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.53,0.34,12),plainMat(0x7A5A38)));
    fur.scale.z=0.9; fur.position.y=1.00; fur.castShadow=false; R.torso.add(fur);
    const chain=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.26,0.045,4,10,Math.PI),plainMat(NC.gold)));
    chain.rotation.x=Math.PI/2+0.28; chain.position.set(0,0.90,0.30); R.torso.add(chain);
    const seal=noShadow(box(0.16,0.16,0.06,NC.goldH)); seal.position.set(0,0.66,0.44); R.torso.add(seal);
    // ---- THE LONG TRAVELLING COAT, hemmed at 0.14 H above ground (§E) ----
    // 0.14 H is 0.54 world on this rig, so the coat runs the belt (1.27) to the ankle and the
    // trader is a COLUMN from the waist down where every other age-3 humanoid is two legs. That is
    // the separator that survives a 40px downsample, and it is also §2.5's team budget: the coat
    // is the shared `coatM` — team cloth — and this roughly doubles its area on the figure.
    // It hangs off u.body and not R.torso for the same reason the other coat skirts do: the walk
    // clip bobs R.torso, and a skirt that bobbed with it would crack open a gap at the waist.
    // >>> texturedMat("cloth") AND NOT coatM, AND THAT IS A RENDER I LOOKED AT. <<<
    // coatM is texturedMat("uniform"), whose 16px swatch has PARADE BRAID BAKED INTO IT — two gold
    // button columns spanning half the wrap, a gold frogging bar every four texels and a doubled
    // gold collar across the whole top row (01-engine.js:1218). On a 1.04 barrel that is the
    // nutcracker's chest ladder and it is exactly right. Stretched over a skirt 0.76 tall and 1.48
    // across it became four gold hoops running all the way round the coat plus a gold band at the
    // waist — from behind the trader was a wasp. The frogging on this class is GEOMETRY, four bars
    // below, where §E puts it and where it can be aimed at the front.
    const coatT=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.74,0.76,12),texturedMat("cloth",tc));
    coatT.scale.z=0.86; coatT.position.y=0.92; coatT.castShadow=false; u.body.add(coatT);
    const hemT=noShadow(cyl(0.755,0.755,0.09,0x3A3126,12)); hemT.scale.z=0.86; hemT.position.y=0.58; u.body.add(hemT);
    // the GOLD FROGGING — four frogs down the coat front, §E's #CFB53B. They sit BELOW the beard's
    // tip (world 1.53) on purpose: the beard is 1.14 across and sheared forward to z 0.62, so a
    // gold bar on the chest is a bar nobody will ever see (that is exactly how the spearman's
    // §B.2 chest strap came to be built, invisible, and passed as done — see kitStoneAge).
    // The z walks OUT as the row walks DOWN because the coat is a flared cone scaled 0.86 in z:
    // its front face is 0.49 at the top frog and 0.61 at the bottom one, so a constant z would
    // have buried the bottom two inside the cloth. Measured off the cone, not guessed.
    for(let i=0;i<4;i++){
      const frog=noShadow(box(0.34,0.055,0.05,NC.gold));
      frog.position.set(0,1.22-i*0.19,0.505+i*0.038); u.body.add(frog);
    }
    // ---- THE STRONGBOX: §E's 40px read, and the only load above the shoulders in the game ----
    // "box(0.15,0.13,0.09)" in §E's H-normalised units is 0.58 x 0.50 x 0.35 world. Seated at
    // torso-local 1.28 its underside is world 2.10 — 0.15 clear of the shoulder line at 1.95 and
    // level with the head's lower third — and at z -0.62 it stands behind the skull's -0.54 back
    // facet. From head-on the head hides it; from the three-quarter the game actually uses it is a
    // hard-edged box growing out of the figure's back where no other unit has anything at all.
    const sbox=noShadow(box(0.58,0.50,0.35,0x6E5230)); sbox.position.set(0,1.42,-0.62); R.torso.add(sbox);
    for(const sy of [1.19,1.65]){ // the gold corner bands, top and bottom
      const bandS=noShadow(box(0.62,0.07,0.39,NC.gold)); bandS.position.set(0,sy,-0.62); R.torso.add(bandS);
    }
    const hasp=noShadow(box(0.13,0.22,0.07,0x4A4640)); hasp.position.set(0,1.42,-0.81); R.torso.add(hasp);
    const strapS=noShadow(box(0.15,0.62,0.06,0x4A3A2A)); // the shoulder strap it hangs from
    strapS.rotation.z=0.30; strapS.position.set(0.20,1.14,0.44); R.torso.add(strapS);
    // ---- THE COIN SCALE, in the LEFT hand (§E: "coin scale in one hand") ----
    // Left, because the strongbox already owns the back and the right fist is where every other
    // unit in the game carries something: a merchant with nothing in his right hand and a balance
    // in his left is a shape no soldier makes.
    // NC_PIKE_CARRY and not the priest's -0.9: weaponGrip adds PI to whatever it is handed, so
    // -0.9 lays the stack out FORWARD (which is right for a staff) and NC_PIKE_CARRY stands it
    // UP (which is right for a balance a man is reading). The beam lands at world 1.95 — the
    // shoulder line — and the outboard pan at x -0.95, which is 0.21 past the coat's own 0.74 and
    // therefore the one thing on this figure that breaks the outline on the LEFT.
    const SC=weaponGrip(R.faL,NC_PIKE_CARRY,0.30);
    const stemS=noShadow(cyl(0.05,0.05,1.0,0x6E5230,6)); stemS.position.y=0.50; SC.add(stemS);
    const beamS=noShadow(box(0.62,0.055,0.055,NC.gold)); beamS.position.y=1.05; SC.add(beamS);
    for(const px of [-0.27,0.27]){
      const cord=noShadow(box(0.03,0.20,0.03,0x4A3A2A)); cord.position.set(px,0.95,0); SC.add(cord);
      const pan=noShadow(cyl(0.155,0.155,0.035,NC.goldH,10)); pan.position.set(px,0.85,0); SC.add(pan);
    }
  }
  if(rig==="sword"){ // THE MELEE LINE — six ages you can read at a glance
    if(u.cls==="clubman"){ // STONE: stitched hide, the bear-hide DOME, a REAL club
      kitStoneAge(R,u,tc);
      // ---- THE CLUB: one line from grip to head — nothing floats ----
      // >>> v131.7 IT WAS A BROWN STICK AT CHEST HEIGHT AND §B.1 ASKS FOR A GREENSTONE LUMP. <<<
      // Three things were wrong with it and all three are in §B.1's own row.
      //  1. COLOUR. The head was texturedMat("wood") over #6B4A2B — the same brown as its own haft
      //     and as the spearman's shaft. §B.1: "pierced greenstone head… #5F7355 — THE ONLY
      //     GREY-GREEN PROP IN THE GAME", and the row's stated 40px read is "the greenstone lump".
      //  2. SIZE. cyl(0.27,0.16,0.62) tapers to a point and measured 0.54 across at its widest;
      //     §B.1 says "3× the current stick tip", and the stick tip on this age is the spearman's
      //     cone(0.11,·) — so 0.33 of radius, straight-sided, 0.66 across. It is a macehead.
      //  3. HEIGHT AND CANT. §B.1: "it MUST ride ABOVE THE SHOULDER LINE in idle so it silhouettes
      //     against SKY, not against grass." Probed, the old head sat at world 1.46–2.18 against a
      //     shoulder line at 2.04 and reached x 0.95 — i.e. a third of it was above the shoulder
      //     and all of it was inside the arm's own outline. Lengthening the haft to 1.20 and
      //     canting the stack 0.22 outboard (weaponGrip negates `out`, so positive throws the head
      //     AWAY from the body) puts the mass at world 2.03–2.55 and x 0.63–1.29, which is 0.57
      //     clear of the coat and level with the head. THAT is what a 40px mask can see, and it is
      //     the whole reason clubman/spearman was the worst outline pair in the game.
      // It clears the ear flap without a collision test at build time because the cant carries the
      // stack FORWARD as well as out: at grip-y 1.20 the head is at z 0.62 and the flap ends at
      // 0.23. Do not straighten `out` without re-checking that.
      // >>> WHAT THIS COSTS, MEASURED, SO THE NEXT LANE DOES NOT HAVE TO REDISCOVER IT. <<<
      // agecheck crops the age's torso to the TORSO's own width (±0.72 world, agecheck.js:234),
      // and this club used to hang inside that window — the tool's comment even names it, "on a
      // clubman a war club that is a sixth of the crop in raw wood". Canted out, the dark wood
      // leaves the crop and the Stone rung measures LIGHTER: §H A2 0.382 -> 0.417 and A2b
      // 0.395 -> 0.436. Verified by rebuilding with out=0 and re-running (0.403), not inferred.
      // The trade in full: A1 13.0 -> 12.9 (still PASS at a floor of 12), A2's worst pair 5.7 ->
      // 7.6 (BETTER), A2b's 0-1 adjacent ΔV 0.251 -> 0.210 against a 0.25 floor — a rung that was
      // sitting one thousandth over the line and now fails with the other four. Against that, §H
      // A4's worst pair in the game goes 0.872 (FAIL) -> 0.686. The ladder gates are failing on
      // four of five rungs either way and their fix is in the PALETTE, not in whether one class's
      // prop happens to shade one crop; a club parked over the ribs to keep a torso mean down is
      // the tool measuring the prop, which is the thing agecheck.js:230 is already complaining about.
      const CG=weaponGrip(R.faR,NC_SWORD_CARRY,0.25,0.22); // shouldered vertical (§6.5) — see the const
      // >>> v131.11 THE FIST-SEAT WAS TRIED HERE AND TAKEN OUT AGAIN. DO NOT RE-APPLY IT. <<<
      // The defect it chased is real. weaponGrip parks the group at faR-local (0,-0.52,0.30)
      // while the HAND is endCap's sphere, r=0.12 at faR-local (0,-0.54,0); both hang off faR,
      // so the offset is the same in every pose. The haft's axis passes 0.284 from the fist's
      // centre and the haft is 0.088 of radius there: 0.284 - 0.088 - 0.12 = 0.076 of AIR,
      // measured 0.084 across the 7-gon's facets. Gate A12 cannot see it — gripcheck measures
      // inside the GROUP's frame, where y=0 is the fist by assertion rather than by geometry.
      // BUT THE SEAT IS NOT AVAILABLE BY TRANSLATION, AND THE NOTE ABOVE ALREADY SAID SO.
      // The fist sits 0.30 BEHIND the group origin in z, so every move that brings the haft's
      // axis onto it drags the whole club back — into the fur cap's ear flap, which is the
      // clearance this block warns about (box 0.245x0.78x0.34 on R.head, helmHideDome, world
      // z -0.11..0.23). Measured by raycast parity on the UNMERGED body, 14748 interior samples,
      // idle pose (armR 0, faR -0.32) — fraction of the club buried in that flap, by seat f:
      //   f=0 (as built) 0.12%   0.25 -> 1.18%   0.30 -> 1.73%   0.35 -> 2.37%   0.648 -> 4.46%
      // and at f=0.648 another 0.84% goes into the shoulder cap and 0.62% into the sleeve cuff.
      // No f under 0.30 closes the daylight, so no fraction buys both. Nor does another
      // direction: inside the plane perpendicular to the stack axis the straight move onto the
      // fist is the one with the SMALLEST backward component, so every alternative goes further
      // back, not less. Sliding along the axis instead runs the fist off the butt at 0.082 and
      // would need 0.677 to cancel the z.
      // What is left is a design call, not a nudge: more `out` so the greenstone clears the flap
      // in x (and a re-run of the agecheck numbers above), a shorter haft, or the gap stays.
      const haft=noShadow(cyl(0.06,0.09,1.20,0x7a5230,7)); haft.position.y=0.42; CG.add(haft);
      const headC=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.33,0.33,0.52,8),plainMat(0x5F7355)));
      headC.scale.z=0.80; headC.position.y=1.20; CG.add(headC);   // §B.1's pierced greenstone, z 0.80
      const collarC=noShadow(cyl(0.135,0.135,0.16,0x4a3320,6)); collarC.position.y=0.90; CG.add(collarC); // the lashing under it
      for(const a of [0.9,3.5]){const stud=noShadow(box(0.11,0.11,0.11,0x4a3320));
        stud.position.set(Math.cos(a)*0.30,1.20,Math.sin(a)*0.24); CG.add(stud);}
    }
    if(u.cls==="shortsword"){ // BRONZE: linen under bronze + the boar's-tusk CONE — no shield
      kitDendra(R,u,tc);
      // the bronze shortsword
      const SG=weaponGrip(R.faR,NC_SPEAR_CARRY,0.25);   // 0.25 once the grip exists to hold: see fistseat
      const ssw=noShadow(box(0.13,1.0,0.12,0xc9a44a)); ssw.position.y=0.62; SG.add(ssw);
      const sgd=noShadow(box(0.38,0.08,0.14,0x9a7532)); sgd.position.y=0.12; SG.add(sgd);
    // v131.22 JOHN: "they still dont have handles". This sword was a BLADE AND A CROSSGUARD and
    // nothing else -- no grip, no pommel, nothing below y=0.08 at all. A12 never saw it because
    // that gate looks for DAYLIGHT BETWEEN parts and an absent handle leaves no gap to find; the
    // blade (0.12..1.12) and the guard (0.08..0.16) overlap, so the weapon read as continuous
    // while the thing the hand closes on did not exist. Guard underside is 0.08, so a 0.20 grip
    // centres at -0.02 and the pommel caps it at -0.145.
    const gripS=noShadow(cyl(0.048,0.052,0.20,0x4a3826,6)); gripS.position.y=-0.02; SG.add(gripS);
    const pomS=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07,6,5),plainMat(0x9a7532)));
    pomS.position.y=-0.145; SG.add(pomS);
    }
    if(u.cls==="broadsword"){ // IRON: scale courses, the Negau BELL, a true broadsword
      kitLamellar(R,u,tc);
      // longer and wider than the bronze blade — and canted outboard, because vertical was not
      // enough on its own: at the fist's x=0.68 a 0.2-wide blade came within 0.04 of the beard's
      // bottom corner and crossed it on any camera off the axis (see weaponGrip's `out`).
      const BG=weaponGrip(R.faR,NC_SPEAR_CARRY,0.28,0.12);  // 0.28 once the grip exists to hold
      const bsw=noShadow(box(0.2,1.35,0.13,0xb9c0c9)); bsw.position.y=0.8; BG.add(bsw);
      const bgd=noShadow(box(0.48,0.09,0.15,0x8d949c)); bgd.position.y=0.12; BG.add(bgd);
    // same absent handle as the shortsword, and the same reason A12 could not see it. Guard
    // underside 0.075; a 0.22 grip centres at -0.03 with the pommel at -0.165. Longer and thicker
    // than the shortsword's because this is a hand-and-a-half blade and the grip is where a
    // silhouette says so.
    const gripB=noShadow(cyl(0.053,0.058,0.22,0x4a3826,6)); gripB.position.y=-0.03; BG.add(gripB);
    const pomB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.08,6,5),plainMat(0x8d949c)));
    pomB.position.y=-0.165; BG.add(pomB);
      // a small round buckler
      const buck=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.09,10),heraldryMat(u.team,u.id)));
      buck.rotation.z=Math.PI/2; buck.position.set(-0.14,-0.3,0.15); R.faL.add(buck);
      const bossB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),plainMat(0x9aa2ad))); bossB.position.set(-0.2,-0.3,0.15); R.faL.add(bossB);
    }
    if(u.cls==="legionaire"){ // CLASSICAL: polished segmentata with gold trim, the tower scutum
      // v130 U1: the segmentata was 0xc2c8d0 — value 0.85, i.e. WHITE — sitting directly above the
      // now-white trousers, so the legionaire's middle band merged with his bottom one and the
      // ladder lost a step. Still polished, just no longer the brightest thing in the frame.
      // v131 THE SEGMENTATA IS THE AGE'S DOMINANT AND IT COMES OUT OF THE TABLE NOW. The hexes
      // here were 0x99a3b0 / 0x848f9d — a grey chosen for this one class, four bands where §B.1
      // asks for seven, and it is exactly how six torsos ended up as six browns with no ladder in
      // them. ageTorso() builds the seven girdle bands in age3.dominant #B4BAC2 with a dark gap
      // between each, which is §B.1's 40px cue verbatim: "seven light horizontal lines with dark
      // gaps on a bright silver torso", the only striped-metal torso in the game.
      const gold=plainMat(NC.gold);
      ageTorso(R,u,tc,{});
      // THE IMPERIAL GALLIC, and NOT a shako with a fin on it. Rounded bowl, brass brow band with
      // three boss rosettes, hinged cheek pieces down beside the face, a neck guard flared back
      // and down, and a TRANSVERSE crest crossing the skull side to side — which is the part that
      // reads head-on, where the fore-aft fin this replaces disappeared into a line.
      helmGallic(R,tc,AGEPAL[3],{});
      // the gladius: mirror-bright, visibly edged, gold furniture
      const GG=weaponGrip(R.faR,NC_SPEAR_CARRY,0.23);
      const gla=noShadow(box(0.16,1.15,0.1,0xc8ced6)); gla.position.y=0.72; GG.add(gla);
      for(const ex of [-0.09,0.09]){const edge=noShadow(box(0.035,1.05,0.11,0xccd0d6));  // §10.22: the only pure white is teeth
        edge.position.set(ex,0.72,0); GG.add(edge);}
      const ggd=noShadow(box(0.42,0.08,0.14,0xd9a92e)); ggd.position.y=0.12; GG.add(ggd);
      const pomG=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09,6,5),gold)); pomG.position.y=-0.08; GG.add(pomG);
      // the bone grip: a gladius' handle is the one part of it that is not metal, and it was
      // missing entirely — 0.070 of daylight between pommel and guard.
      const gripG=noShadow(cyl(0.05,0.055,0.17,0xcfc6ae,6)); gripG.position.y=0.045; GG.add(gripG);
      // the tower scutum — the biggest shield on the field, gold-rimmed
      const scutum=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12,1.5,0.95),heraldryMat(u.team,u.id)));
      scutum.position.set(-0.12,-0.3,0.15); R.faL.add(scutum);
      for(const rz of [0.6,-0.3]){const rim=noShadow(box(0.13,1.54,0.06,0xd9a92e));
        rim.position.set(-0.12,-0.3,rz); R.faL.add(rim);}
      const boss=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13,6,5),gold)); boss.position.set(-0.2,-0.3,0.15); R.faL.add(boss);
    }
    if(u.cls==="vanguard"){ // MEDIEVAL: mail + white surcoat + closed great helm + a giant two-hander
      // MATTE riveted mail with the surcoat quartered in team colour over it — ageTorso builds
      // both, because §A.3's age4.dominant #5E6258 is what the Medieval rung of the ladder IS and
      // a surcoat painted mostly white would swamp it: #D6CBB0 measures 0.798 against mail at
      // 0.378 and §H A2 averages the band. The white survives as the CROSS, which is the part that
      // reads at 40px anyway, and the field carries the team.
      ageTorso(R,u,tc,{});
      const skirtV=noShadow(box(0.5,0.44,0.07,AGEPAL[4].accent)); skirtV.position.set(0,-0.12,0.36); R.torso.add(skirtV);
      // THE GREAT HELM, CLOSED — and the beard hangs out beneath it. v130.7 "opened it out" into a
      // shako with a gold cross painted on the front, on the argument that a closed helm costs the
      // face and the beard, which are what survive to 40px. Half right: it costs the FACE. §0 works
      // this exact unit as its hard example and gives the resolution a real great helm gives — the
      // bottom edge stops 0.06 H above the chin, exactly as one sat over a coif, and the carved
      // beard hangs out below. The unit loses its eyes and its mouth and keeps the larger
      // silhouette carrier of the two, and gains the only featureless face in the game: one bright
      // slit on a dead matte block. The reference art's Norse figure does the same under a mail
      // coif — look at it.
      helmGreatHelm(R,tc,AGEPAL[4],{});
      // the giant two-hander, carried high over the shoulder
      const ZG=weaponGrip(R.faR,NC_SPEAR_CARRY,0.27);
      const zw=noShadow(box(0.17,1.9,0.12,0xc4cad2)); zw.position.y=1.1; ZG.add(zw);
      const zgd=noShadow(box(0.64,0.1,0.16,0x8d949c)); zgd.position.y=0.13; ZG.add(zgd);
      const zpom=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.11,6,5),plainMat(0xd9a92e))); zpom.position.y=-0.1; ZG.add(zpom);
      // 'both fists belong on the hilt' says the line below — and there was no hilt to put them
      // on: 0.070 of daylight between pommel and guard. Leather-wrapped, and long, because a
      // two-hander's grip is the one place its silhouette says two-hander.
      const gripZ=noShadow(cyl(0.055,0.06,0.19,0x4a3826,6)); gripZ.position.y=0.04; ZG.add(gripZ);
      // no shield — both fists belong on the hilt
    }
  }
  if(rig==="pike"){ // THE ANTI-CAVALRY LINE — six ages of spears
    if(u.cls==="spearman"){ // STONE: the clubman's cousin — FLAT-TOP cap and one diagonal strap
      // §B.2 separates the two Stone Age foot units by SHAPE and not by colour: a flat cylinder
      // against clubman's dome, plus the only diagonal on any Stone Age unit. §H A4 tests exactly
      // this pair, and it is the cheapest separation in the game — two flags on one builder.
      // >>> AND FOR THREE ROUNDS IT WAS TWO FLAGS THAT CANCELLED EACH OTHER. `strap:true` reached
      // helmHideDome as well as ageTorso and put clubman's EAR FLAPS back on this head, so the two
      // caps rendered identically and A4 measured IoU 0.872 head-on with the separator "built".
      // §B.2's row says "**no chin strap**" in bold and that is what `flaps:false` is. See
      // kitStoneAge, which now maps the two keys apart.
      kitStoneAge(R,u,tc,{flat:true,strap:true,flaps:false});
      // >>> v131.15 THE 0.3 GRIP OFFSET WAS A SLIDE ALONG THE SHAFT AND IS NOW A FLOAT ACROSS IT. <<<
      // weaponGrip's `z` translates the group in the FOREARM's frame, BEFORE the group's own
      // rotation, so it moves a weapon along its own stack axis only for as long as that axis points
      // the way the forearm's +z does. It used to: the v129.4 baseline carried this line at -1.35,
      // whose stack axis is (0, 0.043, 0.999) — 87 degrees over — so 0.3 of forearm +z was 0.3 of
      // slide DOWN THE SHAFT, and that is what put the fist on the shaft instead of on its butt.
      // v130.4 stood the shaft up (NC_PIKE_CARRY: axis (0, 0.963, 0.269)) and left the 0.3 exactly
      // where it was, where it is now 87 degrees ACROSS the shaft instead of along it.
      // HAND CALCULATION. Fist = SphereGeometry(0.12,6,5) at forearm-local (0,-0.54,0); grip origin
      // (0,-0.52,z); axis (0, cos 0.2726, sin 0.2726). The centre line's miss is
      //     perp(z)^2 = 0.9275 z^2 - 0.01037 z + 0.0000289,  perp(0.30) = 0.2835.
      // MEASURED on the unmerged factory (_buildBodyRaw), in the FOREARM's frame so no pose can
      // change it: the nearest point of the shaft is 0.226 from the fist's CENTRE. AND THE FIST IS
      // NOT A SMOOTH SPHERE — a 6x5 sphere's flat faces stand at 0.12*sin72*cos30 = 0.0988 and only
      // its vertices reach 0.12 (probed: 0.0988 / 0.1200). So the daylight between skin and wood is
      // 0.106 at a vertex and 0.127 across a face, on all six ages of the line. That is John's
      // floating spear, and it is one defect at six call sites, not six defects.
      // WHY 0.13. perp = 0.12 at z = 0.1302 and perp = 0.0988 at z = 0.1082, so 0.13 is the last
      // two-decimal offset whose centre line is inside the fist's vertex circle (perp(0.13)=0.1198,
      // perp(0.131)=0.1208); the contact that actually lands comes from the shaft's own 0.05-0.06
      // radius on top of that. PROBED at 0.13, by ray parity and not by AABB: the shaft's nearest
      // point is 0.067 from the fist's centre and 0.0389 of wood is INSIDE the fist — contact, with
      // 0.0162 more inside the wrist and nothing at all in the sleeve. Shouldered means touching.
      // WHY NOT FURTHER BACK. The fist stands only 0.17 proud of the upper arm's axis while the
      // sleeve band (cyl(0.185,0.20,0.36) at armR y -0.12, i.e. world y 1.61-1.97) has radius 0.20,
      // so a VERTICAL shaft through the MIDDLE of the fist has to come out through the sleeve: at
      // z=0 it buries about 0.12 in it. Leaning the shaft forward would allow both and contradicts
      // AD 6.5 "Vertical pike/musket", so it is not taken here.
      // WHAT MOVES: the whole weapon drops 0.17*sin(0.32) = 0.0535 in world y and 0.17*cos(0.32) =
      // 0.1614 back. Charred tip 3.418 -> 3.365 above the sole, butt 0.509 -> 0.455 — further under
      // 5.4's health bar at 5.3, not nearer it, and still well clear of the turf.
      // WHAT THIS DOES NOT FIX, SAID OUT LOUD: this cap is a 0.84 disc over a 0.55 skull and the
      // shaft stands at x 0.68, so the spear passes THROUGH the brim at BOTH offsets — probed 0.149
      // deep at 0.30 and 0.174 at 0.13. Moving the grip deepens a crossing it did not cause and
      // cannot cure; that is a 6.5a brim item on the widest hat in the game, not a weapon item.
      const SP=weaponGrip(R.faR,NC_SPEAR_CARRY,0.13);
      const shaft=noShadow(cyl(0.05,0.06,2.4,0x7a5230,6)); shaft.position.y=0.7; SP.add(shaft);
      const lash=noShadow(cyl(0.075,0.075,0.14,0x4a3320,5)); lash.position.y=1.82; SP.add(lash);
      // §B.2 ends that row with "**NO METAL ANYWHERE ON THIS UNIT**" and this point was
      // #8D949C — the same cool grey the Iron spearhead and the broadsword blade are made of, on
      // the one class in the game whose material rule is absolute. §B.2's own hexes for it are
      // "tip charred #3A2E22 over #4A463E": a fire-hardened stone point, dark, and 0.14 of radius
      // rather than 0.11 so the head is visibly wider than its own shaft at 40px.
      const flint=noShadow(cone(0.14,0.44,0x4A463E,4)); flint.position.y=2.07; SP.add(flint);
      const char=noShadow(cone(0.105,0.22,0x3A2E22,4)); char.position.y=2.30; SP.add(char);
      // §B.2: "SPARE JAVELIN SLUNG ON THE BACK", and it is here because it is the only line on the
      // page that puts something OUTSIDE this figure's outline. Everything else §B.2 gives the
      // spearman — flat cap, chest strap, charred tip — lands inside a silhouette the clubman
      // already fills: measured, the flat cap is 3px of a 40px figure and the chest strap is 100%
      // occluded (the beard is 1.14 across and sheared forward to z 0.62; the strap was 0.60 across
      // at z 0.47, i.e. behind it, under it and narrower than it — built, invisible, and passed as
      // done). A shaft slung corner to corner crosses the shoulder line at +0.78 and the hip at
      // -0.62, both outboard of a 0.66 coat, so it is a real diagonal in the MASK and not just in
      // the paint. 0.09 of radius is 0.18 across = 2.3px at 40 — over the box filter's half-pixel
      // coverage rule with margin, which the 0.05 spear shaft in the fist is not.
      // It leans the OTHER way from the spear in the fist. The carried spear stands at x +0.68;
      // a slung one raked the same way would have put both diagonals on the right and left the
      // left half of the mask exactly as blank as the clubman's. Tip over the LEFT shoulder at
      // x −0.66 (0.12 outboard of a 0.54 head), butt tucked at the right hip inside the coat.
      // z −0.62 is BEHIND the coat's own back facet at −0.53, so it reads as slung rather than
      // as a stripe painted down the tunic — checked on the probe, not assumed.
      const JV=new THREE.Group(); JV.rotation.z=0.52; JV.position.set(-0.10,0.62,-0.62); R.torso.add(JV);
      const jsh=noShadow(cyl(0.085,0.095,1.95,0x6b4a2b,6)); JV.add(jsh);
      const jtip=noShadow(cone(0.15,0.34,0x3A2E22,4)); jtip.position.y=1.12; JV.add(jtip);  // charred, §B.2
      const jlash=noShadow(cyl(0.115,0.115,0.13,0x4a3320,5)); jlash.position.y=0.86; JV.add(jlash);
    }
    if(u.cls==="spearfighter"){ // BRONZE: the same panoply with NO cheek pieces — §B.2's separator
      kitDendra(R,u,tc,{cheeks:false});
      // v131.15 grip z 0.3 -> 0.13, derivation on the spearman above: weaponGrip's z translates in
      // the FOREARM's frame, so once NC_PIKE_CARRY stood the shaft up the 0.3 stopped being a slide
      // along the shaft and became a 0.2835 miss across it. Probed unmerged, the ash's nearest point
      // is 0.225 from the fist's CENTRE against a 6x5 fist whose faces stand at 0.0988 and whose
      // vertices reach 0.12 — 0.105 to 0.126 of daylight. perp(z)^2 = 0.9275z^2 - 0.01037z +
      // 0.0000289 meets 0.12 at z = 0.1302, so 0.13 is the last offset inside the fist; probed at
      // 0.13 the fist swallows 0.0399 of the shaft and the ENTIRE remaining bill is 0.0185 in the
      // wrist and 0.0096 in the sleeve band. Nothing else on the figure is entered at all.
      // The sauroter drops with it, 0.242 -> 0.188 above the sole: still B.2's bright chip beside
      // the boot. Worst walking frame is about 0.12 once the 0.09 body lean and the 0.045 torso bob
      // are taken off it — arithmetic from animateUnit, not probed, but positive with margin.
      const SP=weaponGrip(R.faR,NC_SPEAR_CARRY,0.13);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,2.8,6),texturedMat("wood",0x8a6a3f)));
      shaft.position.y=0.9; SP.add(shaft);
      const collar=noShadow(cyl(0.075,0.075,0.1,0x9a7532,6)); collar.position.y=2.28; SP.add(collar);
      const tipB=noShadow(cone(0.12,0.5,0xc9a44a,5)); tipB.position.y=2.55; SP.add(tipB);
      // THE SAUROTER. §B.2's stated 40px read for this class is "metal glinting at BOTH ends of
      // the shaft — period-correct and unique", and only one end had any metal on it. The butt
      // spike hangs below the fist at world 0.36, next to the boot, where it is the one bright
      // chip anywhere on the lower third of a Bronze figure. cone() points UP, so it is flipped.
      const saur=noShadow(cone(0.085,0.30,0xc9a44a,5));
      saur.rotation.x=Math.PI; saur.position.y=-0.62; SP.add(saur);
      const ferr=noShadow(cyl(0.072,0.072,0.09,0x9a7532,6)); ferr.position.y=-0.44; SP.add(ferr);
    }
    if(u.cls==="impspear"){ // IRON: the same bell plus the anti-cav line's horsehair TUFT (§B.2)
      kitLamellar(R,u,tc,{tuft:true});
      // v131.15 grip z 0.3 -> 0.13, derivation on the spearman above: weaponGrip's z translates in
      // the FOREARM's frame, so standing the shaft up turned the 0.3 from a slide along the shaft
      // into a 0.2835 miss across it — probed, the ash's nearest point is 0.225 from the fist's
      // CENTRE, i.e. 0.105-0.126 of daylight against a 6x5 fist (faces 0.0988, vertices 0.12).
      // At 0.13 the fist swallows 0.0375 of the shaft.
      // >>> THIS IS THE ONE CLASS THAT PAYS ANYTHING REAL, AND HERE IS THE WHOLE BILL, RAY-PARITY
      // PROBED AT 0.13 RATHER THAN AABB'd: <<<
      //   0.0711 into age 2's scale cape, box(0.40,0.20,0.50) at x 0.571, y 1.06
      //   0.0422 into the tall Iron helmet's own lathe (head-local y 0.75)
      //   0.0232 into the cap under the cape, box(0.34,0.15,0.42) at x 0.588
      //   0.0164 wrist, 0.0153 into the helmet's 0.688 disc, 0.0123 into the humeralia, 0.0120 sleeve
      // At 0.30 this shaft ALREADY grazed the 0.724 brim disc by 0.0073, so the helmet was never
      // clear; what 0.13 adds is a spear resting ON the shoulder guard and touching the helmet's
      // flare instead of hanging 0.11 in front of both. ageShoulders' own note records that every
      // box it builds sits inboard of the arm, so there was never clear air out there to hang it in.
      // NOT CANTED OUTBOARD to buy the helmet back: weaponGrip's `out` is a LEAN, it walks the head
      // of a 3.1 shaft sideways, and a new lean is a 6.3 silhouette decision that has to be measured
      // against the age's own outline rather than guessed at the same time as the grip.
      // The leaf drops 4.182 -> 4.129 above the sole and the butt 0.509 -> 0.455.
      const SP=weaponGrip(R.faR,NC_SPEAR_CARRY,0.13);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,3.1,6),texturedMat("wood",0x8a6a3f)));
      shaft.position.y=1.05; SP.add(shaft);
      const collar=noShadow(cyl(0.08,0.08,0.1,0x687079,6)); collar.position.y=2.52; SP.add(collar);
      for(const lx of [-0.1,0.1]){const lug=noShadow(box(0.14,0.07,0.06,0x8d949c)); lug.position.set(lx,2.6,0); SP.add(lug);}
      const tipI=noShadow(cone(0.13,0.55,0xb9c0c9,5)); tipI.position.y=2.9; SP.add(tipI);
    }
    if(u.cls==="hoplite"){ // CLASSICAL: bronze panoply of the phalanx
      // THE BELL CUIRASS, in the age's own bronze.bright — §A.3 keeps age3.bronze.bright #C29A4E
      // deliberately brighter than age1.metal, because a hoplite standing beside a Bronze Age
      // spearfighter has to read as the LATER man. The muscled front and the flaring bell skirt
      // are the shape; the colour comes out of the table like everything else.
      const A3=AGEPAL[3], bronze=plainMat(A3.metalLit), bronzeD=plainMat(0x9A7A2E);
      _tShell(R,0.58,0.8,bronze,0.535,0.615,12);
      for(const px of [-0.17,0.17]){const pec=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.15,6,5),bronzeD));
        pec.position.set(px,0.76,0.4); pec.scale.set(1.25,1,0.5); R.torso.add(pec);}
      const absB=noShadow(box(0.3,0.24,0.05,0x9A7A2E)); absB.position.set(0,0.42,0.46); R.torso.add(absB);
      for(let i=0;i<6;i++){const pt=noShadow(box(0.14,0.32,0.05,A3.leather)); pt.position.set(-0.33+i*0.13,0.04,0.4); R.torso.add(pt);}
      // THE CORINTHIAN, and it is a different SOLID from the Gallic beside it in the same age.
      // One hammered piece covering the entire head and face: eye slits and a nose bar, nothing
      // else, under a tall fore-aft brush crest. §B.2's cue is "the full-face blank plus the huge
      // dished disc — two blanks at once, enormously readable at low poly", and it is the only
      // reason two Classical units in the same steel do not read as the same man.
      const cor=_lm([[0.60,0],[0.62,0.30],[0.61,0.66],[0.55,1.00],[0.36,1.18],[0,1.26]],14,A3.metalLit);
      cor.position.y=NC_HATY-0.60; R.head.add(cor);   // seated LOW: it swallows the face
      for(const s of [-1,1]){const es=noShadow(box(0.175,0.078,0.05,0x14100E));
        es.position.set(s*0.18,NC_HATY-0.03,0.60); R.head.add(es);}
      const nasal=noShadow(box(0.07,0.39,0.09,A3.metal)); nasal.position.set(0,NC_HATY-0.22,0.60); R.head.add(nasal);
      const crestBase=noShadow(box(0.12,0.1,0.9,A3.metal)); crestBase.position.y=NC_HATY+0.68; R.head.add(crestBase);
      const crest=noShadow(box(0.10,0.40,1.0,tc)); crest.position.y=NC_HATY+0.90; R.head.add(crest);
      // greaves live in the shared leg pass; sandals on the feet
      // the great hoplon
      const aspis=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.78,0.78,0.1,12),heraldryMat(u.team,u.id)));
      aspis.rotation.z=Math.PI/2; aspis.position.set(-0.14,-0.3,0.15); R.faL.add(aspis);
      const rim=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.76,0.05,5,14),plainMat(0xb08a3f)));
      rim.rotation.y=Math.PI/2; rim.position.set(-0.19,-0.3,0.15); R.faL.add(rim);
      // the doru: ash shaft, bronze leaf, sauroter butt-spike
      // v131.15 grip z 0.3 -> 0.13, derivation on the spearman above: NC_PIKE_CARRY standing the
      // shaft up turned weaponGrip's FOREARM-frame 0.3 from a slide along the shaft into a 0.2835
      // miss across it. Probed, the doru's nearest point is 0.225 from the fist's CENTRE — 0.105 to
      // 0.126 of daylight against a 6x5 fist (faces 0.0988, vertices 0.12). perp(z)^2 = 0.9275z^2 -
      // 0.01037z + 0.0000289 meets 0.12 at z = 0.1302; at 0.13 the fist swallows 0.0369 of the shaft
      // and the whole remaining bill is 0.0162 in the wrist and 0.0091 in the sleeve band — the
      // aspis, the corinthian and the bell cuirass are all untouched.
      // The sauroter drops with it, 0.362 -> 0.308 above the sole; the leaf 4.332 -> 4.279, second
      // only to the halberd spike and still far under 5.4's bar at 5.3.
      const SP=weaponGrip(R.faR,NC_SPEAR_CARRY,0.13);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,3.4,6),texturedMat("wood",0x8a6a3f)));
      shaft.position.y=1.1; SP.add(shaft);
      const leaf=noShadow(cone(0.13,0.55,0xc9a44a,5)); leaf.position.y=3.05; SP.add(leaf);
      const saur=noShadow(cone(0.08,0.3,0x9a7532,5)); saur.rotation.x=Math.PI; saur.position.y=-0.5; SP.add(saur);
    }
    if(u.cls==="pikeman"){ // MEDIEVAL: cuirass over gambeson, morion helm, plate boots
      // v130.6 THIS CLASS HAD NO DARK BAND ANYWHERE ON IT. Downsampled to 40 rows the pikeman ran
      // 0.98 (beard) then 0.66 / 0.64 / 0.58 / 0.62 / 0.62 — a bright cuirass over a bright
      // gambeson, i.e. the whole slot §6.2 reserves for the 0.42 coat filled with light steel, and
      // the plate front measuring LIGHTER than the head above it. Every other class in the game
      // carries the team band on its torso (§6.6); this one carried it on a skirt hem and a plume.
      // Two moves, no new geometry: the cuirass burnishes down to the same 0x687079 the iron age
      // already pays an atlas cell for, and the arming doublet under it is TEAM cloth instead of
      // undyed linen — which is what a 16th-century gambeson actually was, and which finally puts
      // this class inside §2.5's 20–30% team budget instead of at about eight.
      // §A.3 reserves age4.plate.bright #C2C8CE for the KNIGHT and the PIKEMAN and nobody else,
      // because bright plate against the vanguard's matte mail is the material contrast that sells
      // the age — and a contrast spent on every Medieval unit is a contrast spent. Gambeson rows
      // in team cloth below (which is what a 16th-century arming doublet was), cuirass above.
      const A4=AGEPAL[4], steel=plainMat(A4.metal);
      for(let i=0;i<3;i++){
        const q=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.575,0.17,10),texturedMat("cloth",tc));
        q.scale.z=0.8; q.position.y=0.16+i*0.16; q.castShadow=false; R.torso.add(q);
      }
      _tShell(R,0.72,0.62,steel,0.545,0.60,12);
      const ridgeP=noShadow(box(0.06,0.62,0.04,A4.metalD)); ridgeP.position.set(0,0.72,0.46); R.torso.add(ridgeP);
      for(const sx of [-1,1])for(let i=0;i<2;i++){ // TASSETS: overlapping plate thigh flaps (§B.2)
        const ts=noShadow(box(0.293,0.215,0.117,i?A4.metalD:A4.metal));
        ts.position.set(sx*0.26,0.20-i*0.14,0.40+i*0.02); R.torso.add(ts);
      }
      // THE MORION — a peaked skull rising to a point at BOTH front and back, a tall fore-aft comb,
      // and a narrow brim turned UP into a peak at each end. That upturned peak is why the brim
      // rule (§H A1b: one flat horizontal disc in the set, and it is the shako's) is not spent
      // here: a morion's brim is a wave, not a plate, and head-on it reads as two horns.
      const mor=_lm([[0.545,0],[0.575,0.16],[0.545,0.46],[0.42,0.70],[0,0.80]],14,A4.metal);
      mor.position.y=NC_HATY-0.04; R.head.add(mor);
      for(const bz of [-1,1]){const peak=noShadow(box(0.44,0.10,0.42,A4.metalD));
        peak.position.set(0,NC_HATY-0.02,bz*0.52); peak.rotation.x=bz*0.55; R.head.add(peak);}
      for(const bx of [-1,1]){const wing=noShadow(box(0.26,0.09,0.30,A4.metalD));
        wing.position.set(bx*0.50,NC_HATY+0.03,0); wing.rotation.z=-bx*0.5; R.head.add(wing);}
      const comb=noShadow(box(0.10,0.36,0.92,A4.metalD)); comb.position.y=NC_HATY+0.80; R.head.add(comb);
      const plumeP=noShadow(cone(0.10,0.5,tc,5)); plumeP.position.set(0.44,NC_HATY+0.70,0); plumeP.rotation.z=-0.32; R.head.add(plumeP);
      // the fancy spear: dark shaft, steel leaf, gold collar, team tassel
      // v130.6 THE PIKE OWNED THE TOP FIVE BANDS OF THE FIGURE. At 3.5 long on a grip that sits at
      // world 0.89 the shaft ran from y≈0.31 — BELOW the boot line, so it grew out of the turf —
      // to a leaf at 4.21, a whole head above the shako, and the ladder's top 12% was a pale
      // diagonal stick where §6.2 puts the black hat. 3.1 on a raised centre lifts the butt to
      // 0.65 (clear of the 0.45 boot top) and drops the leaf to 3.92, which still crowns the hat
      // at 3.81 — a pike has to out-top the man — without owning five bands on its own. The leaf
      // comes off 0xc2c8d0 as well: that is a 0.72 value on the brightest slot in the frame.
      // v131.15 grip z 0.3 -> 0.13, derivation on the spearman above. THIS CLASS HAS ITS OWN
      // QUADRATIC because the 0.12 outboard cant tips the stack axis to (0.1197, 0.9562, 0.2673):
      //     perp(z)^2 = 0.92855 z^2 - 0.010223 z + 0.0000343,  perp(0.30) = 0.2838, perp(0.13) =
      //     0.11999, and the root at 0.12 is z = 0.13001 — this is the tightest of the six by a
      //     hundredth of a millimetre, and it still lands inside.
      // Probed: 0.104-0.125 of daylight at 0.30 (nearest point 0.224 from a fist whose faces stand
      // at 0.0988 and whose vertices reach 0.12), and at 0.13 the fist swallows 0.0351 of the shaft.
      // THE CANT PAYS FOR ITSELF HERE: the entire remaining bill on this class is 0.0171 in the
      // wrist and NOTHING in the sleeve band — the only one of the six that touches no sleeve.
      // The leaf goes 4.234 -> 4.180 above the sole, still the highest thing on the figure, and the
      // butt 0.755 -> 0.702.
      // WHAT THIS DOES NOT FIX, said out loud because it is the other half of "shouldered": at 3.1
      // centred on 1.30 the butt sits at grip-y -0.25 and lands 0.075 under the fist's lowest point,
      // where every other shaft in the line clears it by 0.32-0.59. This man grips the very end of
      // his pike. 3.35 centred on 1.175 would hold the top at 2.85 and drop the butt to -0.50 with
      // it; left alone here because v130.6 chose that length against a boot-top budget and a section
      // H ladder reading that a length change has to be re-measured against, not guessed.
      const SP=weaponGrip(R.faR,NC_SPEAR_CARRY,0.13,0.12);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,3.1,6),texturedMat("wood",0x6b4a2b)));
      shaft.position.y=1.30; SP.add(shaft);
      const collarG=noShadow(cyl(0.08,0.08,0.12,0xd9a92e,6)); collarG.position.y=2.58; SP.add(collarG);
      const tass=noShadow(cone(0.11,0.32,tc,5)); tass.rotation.x=Math.PI; tass.position.y=2.42; SP.add(tass);
      const leafP=noShadow(cone(0.13,0.6,0x9aa2ad,5)); leafP.position.y=2.95; SP.add(leafP);
    }
    if(u.cls==="halberdier"){ // ENLIGHTENMENT: gold-riveted brigandine, closed morion, the halberd
      // THE BRIGANDINE: a blackened shell with a dense grid of gold rivet heads. §B.2 says the
      // rivets are TEXTURE, never geometry, at 2 texels minimum — twelve spheres is what this
      // shipped as and twelve spheres is what it stays, because the atlas has ~20 pairs left for
      // the whole overhaul and a rivet pattern is a cell. Stated rather than quietly ignored.
      const A5=AGEPAL[5], steel=plainMat(A5.metal), goldH=plainMat(NC.gold);
      _tShell(R,0.62,0.92,plainMat(A5.dominant),0.56,0.585,12);
      for(let ry=0;ry<3;ry++)for(let rx=0;rx<4;rx++){
        const riv=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.035,4,4),goldH));
        riv.position.set(-0.27+rx*0.18,0.3+ry*0.26,0.46); R.torso.add(riv);
      }
      for(const ty of [0.19,0.99]){ // gold lace edging, top and bottom
        const trim=new THREE.Mesh(new THREE.CylinderGeometry(0.575,0.575,0.06,12),goldH);
        trim.scale.z=0.8; trim.position.y=ty; trim.castShadow=false; R.torso.add(trim);
      }
      for(const sx of [-0.5,0.5]){ // blued steel pauldrons with gold etching
        const sp=noShadow(box(0.293,0.156,0.293,A5.metal)); sp.position.set(sx*1.06,1.00,0); R.torso.add(sp);
        const et=noShadow(box(0.31,0.047,0.31,NC.gold)); et.position.set(sx*1.06,0.91,0); R.torso.add(et);
      }
      // THE BURGONET WITH A FALLING BUFFE — §B.2 is explicit that this, and not a morion, is the
      // historically real way to get a closed face in this age, and it also keeps the pikeman next
      // door as the only open-faced Medieval-into-gunpowder helm. Comb over the crown, a peak over
      // the brow (a PEAK, not a brim: the brim is the shako's and the shako's alone), hinged
      // cheeks, and a face plate closing the front, blackened steel with heavy gold etched bands.
      const burg=_lm([[0.56,0],[0.585,0.20],[0.55,0.52],[0.40,0.74],[0,0.82]],14,A5.dominant);
      burg.position.y=NC_HATY-0.06; R.head.add(burg);
      const peak=noShadow(box(0.86,0.055,0.293,A5.metal));
      peak.position.set(0,NC_HATY+0.02,0.44); peak.rotation.x=-0.3; R.head.add(peak);
      const buffe=noShadow(box(0.585,0.43,0.047,A5.dominant)); buffe.position.set(0,NC_HATY-0.30,0.52); R.head.add(buffe);
      for(let i=0;i<3;i++){const sl=noShadow(box(0.50,0.035,0.03,0x14100E));
        sl.position.set(0,NC_HATY-0.20-i*0.09,0.55); R.head.add(sl);}   // the buffe's breathing slots
      for(const s of [-1,1]){const ck=noShadow(box(0.086,0.34,0.235,A5.dominant));
        ck.position.set(s*0.50,NC_HATY-0.24,0.16); R.head.add(ck);}
      for(const gy of [0.02,0.36]){const gb=noShadow(cyl(0.575,0.585,0.047,NC.gold,14));
        gb.position.y=NC_HATY+gy; R.head.add(gb);}                       // gold etched bands, 0.012 H
      const combH=noShadow(box(0.086,0.274,0.78,A5.metal)); combH.position.y=NC_HATY+0.78; R.head.add(combH);
      const plumeH2=noShadow(cone(0.10,0.55,tc,5)); plumeH2.position.y=NC_HATY+1.20; R.head.add(plumeH2);
      // the HALBERD: spike, axe blade, rear hook, gold collar
      // v131.15 grip z 0.3 -> 0.13, derivation on the spearman above: NC_PIKE_CARRY standing the
      // shaft up turned weaponGrip's FOREARM-frame 0.3 from a slide along the shaft into a 0.2835
      // miss across it. Probed, the haft's nearest point is 0.219 from the fist's CENTRE — the
      // tightest of the six, and only because this haft is the thickest at 0.065 — which is still
      // 0.099 of daylight to the fist's vertices and 0.121 to its flat faces.
      // perp(z)^2 = 0.9275z^2 - 0.01037z + 0.0000289 meets 0.12 at z = 0.1302; at 0.13 the fist
      // swallows 0.0390 of the haft, the wrist takes 0.0210 and the sleeve band 0.0112, and nothing
      // else on the figure is entered — not the sallet, not the pauldron, not the gold etch.
      // The spike drops 4.432 -> 4.378 above the sole (further under 5.4's bar at 5.3, not nearer)
      // and the butt 0.408 -> 0.355, still 0.42 below the fist, which is the whole point of a
      // shouldered polearm.
      const SP=weaponGrip(R.faR,NC_SPEAR_CARRY,0.13);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.065,3.3,6),texturedMat("wood",0x4a3826)));
      shaft.position.y=1.05; SP.add(shaft);
      const collarH=noShadow(cyl(0.085,0.085,0.12,0xd9a92e,6)); collarH.position.y=2.3; SP.add(collarH);
      const axe=noShadow(box(0.05,0.55,0.42,0xc2c8d0)); axe.position.set(0,2.62,0.28); SP.add(axe);
      const axeEdge=noShadow(box(0.06,0.57,0.06,0xc8ced6)); axeEdge.position.set(0,2.62,0.5); SP.add(axeEdge);
      const hook=noShadow(box(0.05,0.3,0.22,0xb9c0c9)); hook.position.set(0,2.58,-0.2); hook.rotation.x=0.35; SP.add(hook);
      const spike=noShadow(cone(0.1,0.55,0xc2c8d0,5)); spike.position.y=3.15; SP.add(spike);
    }
  }
  if(rig==="bow"){ // THE RANGED LINE — six ages from slung stones to rifled steel
    if(u.cls==="slinger"){ // STONE: hides, a hip-bag of stones, the whirling sling
      // §B.3 holds this cap to the 0.20 H floor and NO HIGHER so the sling's arc owns the
      // silhouette — the lowest hat in the game, and that is the unit's read.
      // >>> …AND IT WAS THE TALLEST CAP IN THE AGE. <<< hh was 0.50 against the clubman's dome at
      // 0.30, i.e. §B.3's "LOW hide skullcap… the lowest hat in the game — THAT IS THE CUE" built
      // two thirds taller than the hat it is supposed to be lower than. 0.24 on rw 0.66 is 1.32
      // across on 0.24 of cap, the flattest head in the game by a wide margin, and next to the
      // spearman's 0.38 drum and the clubman's 0.30 dome-with-flaps that is three different heads
      // at 40px instead of three hats you have to read the colour of.
      kitStoneAge(R,u,tc,{rw:0.66,hh:0.24});
      // §B.3's "coiled sling cord wrapped round the crown to make up mass" — never built, and it
      // is what stops a 0.24 cap reading as no hat at all (§0's floor). 0.70 against a 0.66 cap is
      // 0.04 proud: a thick cord BAND, not a disc. §6.5a's one flat brim stays Enlightenment's.
      const coil=noShadow(cyl(0.70,0.70,0.155,0x8C6B45,12)); coil.position.y=NC_HATY-0.05; R.head.add(coil);
      const coilD=noShadow(cyl(0.705,0.705,0.045,0x5a3c22,12)); coilD.position.y=NC_HATY+0.02; R.head.add(coilD);
      // ---- THE SLING ITSELF, AND §B.3 WANTS ITS ARC TO OWN THE SILHOUETTE ----
      // It hung dead vertical out of the fist — the same line, in the same place, as the spearman's
      // spear shaft and the clubman's haft, which is why three units built round three different
      // props read as one prop at 40px. §B.3's whole reason for pinning the cap to the floor is
      // "so the SLING'S ARC owns the silhouette", and an arc has to go somewhere.
      // >>> THE SIGN OF rotation.z IS THE WHOLE THING, AND I GOT IT BACKWARDS TWICE. <<<
      // R.faR hangs at x +0.68 and weaponGrip has already flipped its stack with a +PI on x, so a
      // NEGATIVE z here rakes the cords back ACROSS the body — over the coat, where the spearman's
      // spear shaft and the clubman's haft already are. Built that way the head-on pair went the
      // wrong direction, 0.871 -> 0.900, which is the gate correctly reporting that a third prop
      // had been added to the same column of pixels as the other two. POSITIVE throws it out. The
      // rake is (−0.45, 0, +0.75): probed, the diamond lands at x 0.94–1.27 and world y 0.30–0.62,
      // i.e. 0.28 outboard of a 0.66 coat and BELOW the hem, which is a patch of frame no other
      // Stone figure puts anything in. The class's rendered width goes 54px -> 72px.
      // TWO cords and not one bar, both braided pale, meeting at a DIAMOND leather pouch (a box
      // turned 45° on z): §B.3 spends a sentence on the fact that this is not a Y-frame slingshot,
      // and a single strap ending in a ball is the silhouette of exactly that. §B.3's WRIST LOOP
      // and RELEASE TAB are on the two cords, asymmetric on purpose.
      const SL=new THREE.Group(); SL.position.set(0,-0.54,0.12); SL.rotation.set(-0.45,0,0.75); R.faR.add(SL);
      // >>> AND THE POUCH STOPS AT THE TURF LINE. <<< At §B.3's full 0.30 of cord — 1.16 world —
      // the diamond probed out at y −0.29, a quarter of a unit UNDER the ground, below boot soles
      // that sit at −0.03, and dragged the class's rendered height from 98px to 112px on geometry
      // buried in a hill. Cord length follows the pouch here, not the other way round: 0.98 of cord
      // with the diamond at −0.62 lands its lowest corner at +0.30, clear of the contact disc.
      // If you re-rake this group, RE-PROBE THE POUCH — the drop is 0.66 of the local run at this
      // rake and 0.80 at the last one, so the same cord length lands in two different places.
      for(const sx of [-0.075,0.075]){const strap=noShadow(box(0.055,0.98,0.04,0xC9BBA0));
        strap.position.set(sx,-0.49,0); strap.rotation.z=sx*0.9; SL.add(strap);}
      const wloop=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.10,0.032,4,8),plainMat(0xC9BBA0)));
      wloop.rotation.y=Math.PI/2; wloop.position.set(-0.10,-0.06,0); SL.add(wloop);   // the wrist loop
      const rtab=noShadow(box(0.11,0.20,0.04,0x8C6B45)); rtab.position.set(0.13,-0.04,0); SL.add(rtab); // the release tab
      const pouch=noShadow(box(0.32,0.32,0.055,0x6b4a2b));
      pouch.rotation.z=Math.PI/4; pouch.position.y=-0.62; SL.add(pouch);      // the diamond, §B.3
      const stone=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.10,5,4),plainMat(0x8A8078))); stone.position.set(0,-0.60,0.06); SL.add(stone);
      // ---- THE AMMO POUCH, AND §B.3 SAYS IT IS THIS UNIT'S READ ----
      // "Leather ammo pouch slung across the body on a 0.030-wide strap — THE POUCH IS THE UNIT'S
      // READ WHEN IDLE", and the row's 40px cue is "the low flat head plus the HANGING POUCH BULGE
      // AT HIP HEIGHT". Probed, the shipped bag was a 0.20 sphere at x 0.42 — spanning 0.22–0.62
      // against a coat that is 0.66 across at that height, i.e. entirely INSIDE the outline. A
      // bulge that does not bulge past anything is not a bulge; it is a patch of colour on a
      // barrel, and §H A4 measures outlines. Out to 0.74 and up in size, it clears the coat by
      // 0.20 and puts a lump on ONE hip — the only asymmetric mass at belt height in the age.
      // It hangs off R.torso and not u.body deliberately: the walk clip swings the torso, so the
      // pouch swings with the man, which is what a bag of river stones on a thong does.
      const bag=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.29,7,6),texturedMat("hide",0x7a5230)));
      bag.scale.set(0.86,1.10,0.72); bag.position.set(0.74,0.10,0.20); R.torso.add(bag);
      // The thong is 0.07 and it hangs near-VERTICAL from the belt, not across the chest at 28°:
      // §B.2 reserves the diagonal — "the ONLY diagonal on any Stone Age unit" — for the spearman,
      // and the first cut of this pouch slung it on a 0.115 bar at −0.42 rad, which is a diagonal
      // chest strap by any other name. Measured, it took spearman/slinger from 0.770 to 0.855 and
      // tripped a4check's own negative control, which is the gate telling you the separator you
      // just built for one class you also built for the other.
      const bstrap=noShadow(box(0.07,0.52,0.045,0x5a3c22));
      bstrap.rotation.z=-0.10; bstrap.position.set(0.66,0.42,0.26); R.torso.add(bstrap);
      for(const [ox,oy] of [[0.70,0.30],[0.80,0.24]]){const st=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.075,4,4),plainMat(0x9aa2ad)));
        st.position.set(ox,oy,0.30); R.torso.add(st);}   // river stones showing over the lip
    }
    if(u.cls==="archer")kitSkinsArcher(R,u,tc,false);   // BRONZE: skins, wool, linen, team kilt
    if(u.cls==="imparcher")kitSkinsArcher(R,u,tc,true); // IRON: the same, gone fancy
    if(u.cls==="comparcher"){ // CLASSICAL: pinned wool chiton, pilos cap, sandals
      const A3c=AGEPAL[3], chitonM=texturedMat("cloth",A3c.accent);
      const chi=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.6,0.85,10),chitonM);
      chi.scale.z=0.8; chi.position.y=0.5; chi.castShadow=false; R.torso.add(chi);
      const pleats=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.67,0.34,10),chitonM);
      pleats.scale.z=0.8; pleats.position.y=-0.02; pleats.castShadow=false; R.torso.add(pleats);
      for(const px of [-0.28,0.28]){const pin=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),plainMat(0xd9a92e)));
        pin.position.set(px,0.96,0.36); R.torso.add(pin);} // shoulder pins
      const beltC=new THREE.Mesh(new THREE.CylinderGeometry(0.57,0.57,0.12,10),texturedMat("cloth",tc));
      beltC.scale.z=0.8; beltC.position.y=0.3; beltC.castShadow=false; R.torso.add(beltC); // team waist cord
      // THE PILOS — a brimless conical FELT cap, kept soft and leaning forward 0.12 rad, which is
      // what contrasts it against the Iron tier's hard metal cone two rows up. The note this
      // replaces argued a cone tapering inward "reads as a wizard" and reached for the shako; the
      // answer is a SHORT cone, not a flared one. At 0.62 tall on a 1.10 skull it is unmistakably
      // a cap, and §B.3's whole point is that the age's ranged unit is the UNARMOURED one.
      const pil=_lm([[0.545,0],[0.44,0.24],[0.28,0.46],[0.12,0.60],[0,0.66]],12,A3c.accent);
      pil.position.set(0,NC_HATY-0.05,0); pil.rotation.x=0.12; R.head.add(pil);
      const pband=noShadow(cyl(0.555,0.565,0.117,tc,12)); pband.position.y=NC_HATY+0.0150; R.head.add(pband);
    }
    if(u.cls==="crossbowman"){ // MEDIEVAL: lincoln green and the bycocket
      const A4c=AGEPAL[4], green=A4c.green;
      const hood=noShadow(cone(0.62,0.55,green,9)); hood.position.y=1.0; hood.rotation.x=0.12; R.torso.add(hood); // hood down the shoulders
      const beltX=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.13,10),texturedMat("hide",0x4a3a26));
      beltX.scale.z=0.8; beltX.position.y=0.22; beltX.castShadow=false; R.torso.add(beltX);
      // THE CHAPERON HOOD with a LIRIPIPE — §B.3's cue is "the liripipe tail, a hanging line off
      // the back of the head, the only trailing element on any head". A pointed soft hood plus a
      // trailing tail does the Robin Hood job better than a hat does, and it is a fourth distinct
      // Medieval headform beside the great helm, the bascinet and the morion.
      const hoodC=_lm([[0.60,0],[0.53,0.30],[0.38,0.62],[0.17,0.84],[0,0.92]],10,green);
      hoodC.position.set(0,NC_HATY-0.09,0); hoodC.rotation.x=-0.18; R.head.add(hoodC);
      const lir=noShadow(cyl(0.055,0.086,1.06,green,6));
      lir.position.set(0,NC_HATY-0.10,-0.62); lir.rotation.x=-0.42; R.head.add(lir);
      const coifC=noShadow(cyl(0.615,0.625,0.16,tc,12)); coifC.position.y=NC_HATY+0.04; R.head.add(coifC);
    }
    if(u.cls==="skirmisher"){ // ENLIGHTENMENT: Rogers' Rangers — scrappy buckskin and a plain rifle
      for(let i=0;i<5;i++){const fr=noShadow(box(0.05,0.16,0.04,0x4a3a26)); // buckskin fringe
        fr.position.set(-0.3+i*0.15,0.52,0.44); R.torso.add(fr);}
      const strapS=noShadow(box(0.26,0.9,0.05,0x4a3a26)); strapS.rotation.z=0.55; strapS.position.set(-0.06,0.62,0.42); R.torso.add(strapS);
      const horn=noShadow(cone(0.09,0.42,0xd2c9b2,6)); horn.rotation.z=1.1; horn.rotation.x=0.4;
      horn.position.set(0.4,0.2,0.32); R.torso.add(horn); // the powder horn
      const satchel=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34,0.28,0.14),texturedMat("hide",0x3a2e1e)));
      satchel.position.set(-0.42,0.14,0.3); R.torso.add(satchel);
      const bedroll=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,1.05,7),texturedMat("cloth",tc)));
      bedroll.rotation.z=0.9; bedroll.position.set(0,0.72,-0.44); R.torso.add(bedroll); // team blanket roll
      // §B.3: the skirmisher's head VARIES BY u.id % 3 — cut-down tricorne, jockey cap, Scotch
      // bonnet — because irregularity is the accurate look for this troop type. u.id and never
      // Math.random(): a desynced hat renders perfectly in any screenshot and is only visible in
      // the source (§G.5). Age 5 is the ONE age kitShako may be called for, and this is the
      // cut-down version — brim panels 0.06 deep against the musketeer's 0.09, cocked at +0.18
      // instead of +0.35 — so the two Enlightenment heads still read apart at the same distance.
      const A5s=AGEPAL[5], vh=u.id%3;
      if(vh===0){
        kitShako(R,tc,{col:A5s.crown,brimCol:A5s.dark,brimR:1.16,band:false,plate:false,plume:false,h:0.51});
        for(let i=0;i<3;i++){
          const car=new THREE.Group(); car.rotation.y=i*Math.PI*2/3; car.position.y=NC_HATY-0.02; R.head.add(car);
          const brim=noShadow(box(0.94,0.055,0.235,A5s.crown)); brim.position.set(0,0.07,0.40); brim.rotation.x=0.18; car.add(brim);
        }
      }else if(vh===1){                       // the jockey cap: low crown, one forward peak
        const cap=_lm([[0.55,0],[0.545,0.30],[0.44,0.52],[0,0.62]],12,A5s.crown);
        cap.position.y=NC_HATY-0.05; R.head.add(cap);
        const pk=noShadow(box(0.66,0.055,0.293,A5s.dark)); pk.position.set(0,NC_HATY-0.02,0.50); pk.rotation.x=-0.2; R.head.add(pk);
      }else{                                  // the Scotch bonnet: a wide flat pancake of wool
        const bon=_lm([[0.62,0],[0.72,0.16],[0.70,0.32],[0.40,0.42],[0,0.44]],14,A5s.crown);
        bon.position.y=NC_HATY-0.04; R.head.add(bon);
        const tuft=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.11,6,5),plainMat(tc)));
        tuft.position.y=NC_HATY+0.46; R.head.add(tuft);
      }
      const plumeS=noShadow(cone(0.078,0.5,tc,5)); plumeS.position.set(0.24,NC_HATY+0.62,0.06); plumeS.rotation.z=-0.35; R.head.add(plumeS);
      // the ranger's rifle — plain iron and walnut; R.musketG wires the shouldered aim for free
      const MG=new THREE.Group(); MG.position.set(NC_MUSKET_CARRY.x,NC_MUSKET_CARRY.y,NC_MUSKET_CARRY.z);
      MG.rotation.set(NC_MUSKET_CARRY.rx,NC_MUSKET_CARRY.ry,0);   // shouldered and canted out — see the const
      const butt=noShadow(box(0.12,0.18,0.46,0x4a3826)); butt.position.set(0,-0.06,-0.34); butt.rotation.x=0.35; MG.add(butt);
      const breech=noShadow(box(0.09,0.13,0.3,0x352a1c)); breech.position.set(0,0,-0.04); MG.add(breech);
      const foreW=noShadow(box(0.08,0.09,1.0,0x4a3826)); foreW.position.set(0,-0.03,0.55); MG.add(foreW);
      const barrel=noShadow(cyl(0.04,0.045,1.7,0x2e2e32,7)); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.04,0.72); MG.add(barrel);
      const bandR=noShadow(cyl(0.055,0.055,0.05,0x4a4e56,7)); bandR.rotation.x=Math.PI/2; bandR.position.set(0,0.04,1.35); MG.add(bandR);
      R.musketG=MG; R.faR.add(MG);
    }
    if(u.cls==="crossbowman"){ // the crossbow, now with a stirrup and string
      // v131.28 IN A GROUP, so the aim pose has something to counter-rotate. These were four loose
      // meshes on R.faR, which is why this was the one ranged weapon that pointed at the sky when
      // the player aimed: R.bowG's compensation line is guarded on a group he did not have.
      // The group sits at the y all four already shared, so their local y goes to 0 and the idle
      // pose is bit-for-bit what it was.
      const XG=new THREE.Group(); XG.position.set(0,-0.45,0); R.faR.add(XG); R.xbowG=XG;
      const stockM=noShadow(box(0.14,0.16,1.1,0x6b4a2b)); stockM.position.set(0,0,0.4); XG.add(stockM);
      const bowArm=noShadow(box(0.95,0.08,0.1,0x8a6a3f)); bowArm.position.set(0,0,0.85); XG.add(bowArm);
      const stringX=noShadow(box(0.9,0.03,0.03,0xd2cdbe)); stringX.position.set(0,0,0.72); XG.add(stringX);
      const stirrup=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.09,0.03,4,8),plainMat(0x4a4e56)));
      stirrup.position.set(0,0,0.96); XG.add(stirrup);
    }else if(u.cls!=="slinger"&&u.cls!=="skirmisher"){ // the wooden bow for tiers 1-3
      const BG=new THREE.Group(); BG.position.set(0,-0.54,0.18); R.faL.add(BG); R.bowG=BG;
      const br=0.55+tier*0.06;
      const bowGeo=new THREE.TorusGeometry(br,0.07,5,10,Math.PI);
      bowGeo.rotateZ(-Math.PI/2); bowGeo.rotateY(-Math.PI/2); // chord along the forearm, belly forward
      // v131.12 THE FIST WAS ON THE STRING, AND THAT IS GEOMETRY, NOT TASTE. John: "holding bow by
      // string and not handle", and "not carrying bow by the middle of the handle". A half-torus
      // runs t = 0..PI at radius br about the group ORIGIN, so the origin sits on the CHORD — and
      // the chord is where the string goes. The belly (t = PI/2) lands at local (0,0,+br) after the
      // two rotations above, i.e. a whole bow-radius in front of the hand.
      // The old line compensated by sliding the GROUP back 0.85*br, which is neither br nor along
      // the axis the belly actually moved, so the grip landed between the string and the stave and
      // the aim pose pivoted about the string. Move the GEOMETRY instead: put the belly on the
      // origin and the fist grips the stave by construction, at every tier, in every pose.
      bowGeo.translate(0,0,-br);
      const bow=new THREE.Mesh(bowGeo,mat(0x6b4a2b)); bow.castShadow=false; BG.add(bow);
      // and the string is now the chord, exactly one radius behind the belly — it used to sit at
      // -0.02, which is to say straight through the archer's fist.
      const string=noShadow(cyl(0.018,0.018,br*2,0xd2cdbe,4)); string.position.z=-br; BG.add(string);
    }
    if(u.cls!=="slinger"&&u.cls!=="skirmisher"){ // the quiver, with arrows to spare
      const quiver=noShadow(cyl(0.2,0.2,0.9,0x6b4a2b)); quiver.position.set(-0.35,0.6,-0.5); quiver.rotation.x=0.4; R.torso.add(quiver);
      for(let i=0;i<3;i++){const sh=noShadow(cyl(0.03,0.03,0.5,0x8a6a3f,4));
        sh.rotation.x=0.4; sh.position.set(-0.43+i*0.08,1.05,-0.66); R.torso.add(sh);
        const fl=noShadow(box(0.08,0.12,0.08,i===1?tc:0xcfc6ae)); fl.rotation.x=0.4; fl.position.set(-0.43+i*0.08,1.28,-0.76); R.torso.add(fl);}
    }
  }
  if(rig==="musket"){ // ENLIGHTENMENT: the King's Musketeers — cassock, tricorne, gold everywhere
    const white=plainMat(0xcecac0), goldM=plainMat(0xd9a92e);
    // the skirted cassock with a gold-fringed hem and buttons
    // v130.5 …CUT OFF AT THE HIP. §6.5 gives this class "white trousers, black boots" and the
    // cassock delivered neither: its hem reached world 0.70, three-hundredths above a boot top at
    // 0.45, so the barcode went coat → boot with no light band between them and the musketeer was
    // a FOUR-mass figure at 40px where §6.2 demands five. Short by 0.22 and the trousers get 0.48
    // of clear air; the gold fringe rides up with it, because the fringe is what says "hem" and a
    // fringe left behind at the old height would just have drawn the missing band in gold.
    const skirt=new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.64,0.30,10),texturedMat("uniform",tc));
    skirt.scale.z=0.8; skirt.position.y=0.13; skirt.castShadow=false; R.torso.add(skirt);
    const hem=noShadow(cyl(0.65,0.65,0.06,NC.gold,10)); hem.scale.z=0.8; hem.position.y=-0.02; R.torso.add(hem);
    for(let i=0;i<4;i++){const btn=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.045,5,4),goldM));
      btn.position.set(0.16,0.78-i*0.16,0.45); R.torso.add(btn);}
    // THE SOUBREVESTE, AND WHY ITS FIELD IS BLACK FELT AND NOT TEAM COLOUR.
    // §B.1 puts a TC field on it with a white-silver cross. §A.3 puts age5.dominant at black felt
    // #22201E, V 0.127, and §H A2 masks every pixel within ΔE00 12 of TEAMCOL before it measures —
    // so a team-coloured soubreveste leaves this age with NO dominant at all and the ladder's last
    // and deepest rung simply missing. The cross, the gold lace and the flame burst §B.1 asks for
    // are all still on it; what flipped is the field, and team colour keeps the sleeves, the coat
    // skirt, the cuffs and the cockade. The team fraction is measured, not asserted — see the
    // report. This is the one place in this lane where a §B row lost to a §H gate, and it lost
    // because §A.2 names this age "Black felt, white lace and gold" and a blue tabard is neither.
    ageTorso(R,u,tc,{});
    for(const sx of [-0.52,0.52])for(let i=0;i<3;i++){ // gold shoulder fringe
      const fr=noShadow(box(0.06,0.16,0.28,0xb8871f)); fr.position.set(sx*1.06,0.8,-0.16+i*0.16); R.torso.add(fr);}
    // v130.5 the belt and its charges sit 0.03-0.05 SHALLOWER and the charges start a hand lower.
    // Nothing moved on the bandolier; the beard did. Once the wedge stopped standing 0.22 proud of
    // the chest, everything strapped to that chest above world 1.73 started printing through it —
    // a dark diagonal smear across the one white mass §6.1 ranks second in the whole figure. Under
    // the beard's own front-face slope now, and still clear of the coat below it where it reads.
    const bando=new THREE.Mesh(new THREE.BoxGeometry(0.3,1.0,0.07),plainMat(AGEPAL[5].leather));
    bando.rotation.z=0.55; bando.position.set(0.1,0.72,0.40); bando.castShadow=false; R.torso.add(bando);
    // the cartridge cases were 0xd2cdbe — four off-white cylinders across the chest of the ONE age
    // whose ladder rung is #22201E. A cartouche box was black waxed leather; it is now that.
    for(let i=0;i<4;i++){const charge=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.14,5),plainMat(AGEPAL[5].leather));
      charge.rotation.z=0.55; charge.position.set(-0.2+i*0.18,0.80-i*0.13,0.44); charge.castShadow=false; R.torso.add(charge);}
    // THE SHAKO PROPER. This age is the one the hat is actually FROM, so the musketeer wears the
    // full-dress version: black felt, gold band, gold plate, white plume. The tricorne it replaces
    // was 0.07 tall on a 0.4 crown — a disc, not a mass, and at 40px a disc on a pale skull just
    // reads as a hat-shaped smudge sitting on nothing.
    // THE SHAKO — and this is the ONE age §6.5a lets it be built for. Flared truncated cone, flat
    // crown, a hard brim, a band, a plate and a plume: the only true shako in the game and the
    // only brim in the set. Every other age now has its own solid.
    // brimH 0.19 and the peak in BLUED STEEL, not felt-black. §H A2 measured this age at #6A5736,
    // V 0.348 — WARM, and fourth-brightest — on the rung §A.2 designs as the darkest and coolest at
    // 0.127. Two things were doing it: the crop is ~40% bare face on the tallest hat in the set,
    // and what was left of it was gold band over warm-black felt. age5.metal #3E4650 is C* 7.1 at
    // Lab hue 264° — grey, not blue, and §A.4 exempts it by name — so a deep peak in it puts a
    // cool, dark, WIDE band across the top of the crop where a 0.07 wafer put nothing.
    // v131.4 THE BAND GOES BLUED STEEL AND THE GOLD LACE GOES UP THE CROWN, AND THAT IS §H A2.
    // §6.3 says "gold band at the brim" and §H A2 crops 28-58% of the figure — which on the
    // tallest hat in the set is exactly the brim line. Cropped and LOOKED at, the top strip of
    // this age's A2 crop was a bar of #CFB53B at V 0.697, the warmest brightest hex in the game,
    // on the rung §A.2 designs as the DARKEST and COOLEST at 0.127; the age measured #655846,
    // warm, and collided with Stone's hide at ΔE00 9.1. age5.metal #3E4650 is C* 7.1 (grey, not
    // blue — §A.4 exempts it by name) and the gold survives as the lace higher up the crown, which
    // is where a shako's upper band actually is.
    // …AND THE GOLD WENT BACK TO THE BRIM, WHERE §6.3 PUTS IT, BECAUSE THE OTHER PLACE WAS WORSE.
    // Moving the band up the crown to clear §H A2's rows cost A2 nothing measurable (0.349 ->
    // 0.345) and cost §H A1 a whole grade: A1 crops the TOP 28% of the figure, which on this class
    // is the upper crown and the plume, so a gold lace and a gold cord up there took the
    // Enlightenment crown from V 0.163 to 0.225 and the Stone/Enlightenment pair from 15.8 to
    // 11.4. Two gates, opposite directions, and A1 has the tighter margin. The band is at the brim
    // (§6.3's own words), the cord is under A1's crop line, and the crown above them is black felt.
    // >>> v131.5 THE PEAK IS BLACK LACQUERED LEATHER AND IT IS 1.72, AND BOTH HALVES ARE MEASURED.
    // COLOUR (§H A2). Histogrammed over A2's own crop with the face flagged out, this class read
    // 37.3% BLUED STEEL — #333A3E / #42494C / #282E32, V 0.22-0.28 — against 6.4% of the black
    // felt the age is named for. The brim is the single largest object in the crop (1.77 across on
    // a crop 1.44 wide) and it was painted age5.metal, so the age whose dominant §A.3 puts at
    // V 0.127 was measuring its own gorget hex. A shako's peak is not blued steel: it is moulded
    // black leather, and §A.3 has that hex — age5.leather #221E1A, V 0.120. Same object, right
    // material, and the age's darkest rung finally lands on the biggest surface the gate reads.
    // SHAPE (§H A1b). 1.50 -> 1.72 of botR. §6.5a: the brim is "the single strongest silhouette
    // cue in the set" and Enlightenment owns the only one in the game — and the Medieval/
    // Enlightenment pair was failing at 0.713 because a shako 1.57 across and a great helm 1.16
    // across are, after the mask is normalised to one height, a column inside a slightly wider
    // column. Two world units of peak is what makes this hat a T and the bucket a bar.
    // v131.6 h 1.10 -> 0.94 and plumeH 0.62 -> 0.44. §6.5a's absolute target for the shako is 1.15
    // and it measured 1.33 — the smallest error in the set, because this is the one hat the whole
    // envelope was borrowed FROM. The brim stays at 1.90 of botR: it is Enlightenment's alone and
    // it is the strongest silhouette cue in the game. What comes down is crown and feather, which
    // is what pushed the head region to 2.57 world against the 2.23 a 1.15 ratio buys on a mask the
    // full 1.90 of the tool's window across.
    // AND IT IS STILL THE TALLEST HAT IN THE GAME, which it has to be. Crown top world 3.81 against
    // the great helm's 3.19 and the tusk cone's 3.95 tip; plume top 4.29, higher than either. The
    // build being corrected had the great helm at 4.32 and the shako at 4.64 — a bucket within
    // 0.32 of a full-dress shako, which is the inversion the owner spotted.
    // brimR 1.90 -> 1.74, AND IT COSTS THE MEASUREMENT NOTHING, WHICH IS THE POINT OF SAYING SO.
    // agecheck crops the head mask to a ±0.95 world window, and a 10-gon peak's widest vertex sits
    // at 0.951 of its radius — so any brimR above 1.689 of botR fills the window and the tool
    // reports the same 1.90 across either way. 1.90 was set last round to move §H A1b's 4-5 pair,
    // and under a crown that is now 0.94 tall it rendered as a puritan hat: 2.25 of peak on 0.94
    // of felt. 2.04 is still, by a wide margin, the only brim in the set (§6.5a) and the crown can
    // be seen over it. This is a LOOK change with a null measurement, which is the right way round.
    kitShako(R,tc,{col:AGEPAL[5].crown,tex:"cloth",brimCol:ageLit(AGEPAL[5].leather),band:NC.gold,
      plate:NC.goldH,plume:AGEPAL[5].accent,plumeH:0.44,brimR:1.74,brimH:0.19,h:0.94});
    // plumeH 0.92 -> 0.46. §B.1 asks for `cone(0.012,0.07,4)` — 0.07 H is 0.27 world — and this
    // was built at 0.92, i.e. 0.24 H, three and a half times spec. It is #D8CFB8 at V 0.813, the
    // brightest hex on the unit, standing at the very top of the tallest figure in the set, so
    // §H A1 (which crops the top 28% of the BOX) was averaging ~20% white feather into the age
    // whose crown §A.2 puts at 0.127: it measured 0.200 and collided with Medieval at 9.8. It is
    // also 0.62 of the height that put this class's hat + head at 0.551 against §6.1a's 0.54
    // ceiling — the only unit in the set over it. Halved, both numbers move the right way.
    const cordT=noShadow(cyl(NC_HEADR*1.12,NC_HEADR*1.17,0.05,NC.goldH,10));
    cordT.position.y=NC_HATY+0.40; R.head.add(cordT); // the dress cord, under A1's crop line
    // the FULL MUSKET: one gun, one group — animateUnit pitches R.musketG when shouldered
    const MG=new THREE.Group(); MG.position.set(NC_MUSKET_CARRY.x,NC_MUSKET_CARRY.y,NC_MUSKET_CARRY.z);
    MG.rotation.set(NC_MUSKET_CARRY.rx,NC_MUSKET_CARRY.ry,0);     // vertical at the shoulder (§6.5), canted out — see the const
    const butt=noShadow(box(0.13,0.2,0.5,0x6b4a2b)); butt.position.set(0,-0.06,-0.38); butt.rotation.x=0.35; MG.add(butt);
    const breech=noShadow(box(0.1,0.15,0.34,0x4a3826)); breech.position.set(0,0,-0.05); MG.add(breech);
    const lock=noShadow(box(0.05,0.11,0.18,0xd9a92e)); lock.position.set(0.07,0,-0.02); MG.add(lock);
    const foreW=noShadow(box(0.09,0.1,1.15,0x6b4a2b)); foreW.position.set(0,-0.035,0.62); MG.add(foreW);
    const barrel=noShadow(cyl(0.045,0.05,1.95,0x3a3a3a,7)); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.045,0.85); MG.add(barrel);
    const band1=noShadow(cyl(0.06,0.06,0.05,0xd9a92e,7)); band1.rotation.x=Math.PI/2; band1.position.set(0,0.045,1.6); MG.add(band1);
    const band2=noShadow(cyl(0.065,0.065,0.05,0xd9a92e,7)); band2.rotation.x=Math.PI/2; band2.position.set(0,0.02,0.25); MG.add(band2);
    // v84 BAYONET: socket ring + a long triangular blade past the muzzle — steel for what powder can't reach
    const bSock=noShadow(cyl(0.058,0.058,0.1,0x9aa2ad,6)); bSock.rotation.x=Math.PI/2; bSock.position.set(0,0.045,1.8); MG.add(bSock);
    const bayo=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.035,0.085,0.52),texturedMat("metal",0xc9ced6))); bayo.position.set(0,0.08,2.08); MG.add(bayo);
    const bayoTip=noShadow(cone(0.04,0.18,0xc9ced6,4)); bayoTip.rotation.x=Math.PI/2; bayoTip.position.set(0,0.08,2.42); MG.add(bayoTip);
    R.musketG=MG; R.faR.add(MG);
  }
  if(rig==="cavalry"){ // five ages in the saddle
    if(u.cls==="chariot"){ // BRONZE: the Egyptian charioteer, standing tall
      const band=noShadow(cyl(0.56,0.56,0.14,0xd9a92e,9)); band.position.y=0.62; R.hat.add(band);
      const stripeB=noShadow(box(0.2,0.5,0.06,tc)); stripeB.position.set(0,0.9,-0.5); R.hat.add(stripeB); // headcloth tail
      const broad=noShadow(cyl(0.62,0.66,0.16,0xd9a92e,9)); broad.position.y=1.18; R.torso.add(broad); // broad collar
      const SP=weaponGrip(R.faR,-1.3,0.35);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,4.4,6),texturedMat("wood",0x8a6a3f)));
      shaft.position.y=1.5; SP.add(shaft);
      const tipC=noShadow(cone(0.12,0.5,0xc9a44a,5)); tipC.position.y=3.85; SP.add(tipC);
    }
    if(u.cls==="heavycav"){ // IRON: bronze scale over leather, the Boeotian helm
      const scaleM=texturedMat("metal",0xb08a3f);
      for(let i=0;i<3;i++){const row=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.58,0.2,10),i%2?scaleM:texturedMat("metal",0x9a7532));
        row.scale.z=0.8; row.position.y=0.3+i*0.24; row.castShadow=false; R.torso.add(row);}
      for(let rx=0;rx<4;rx++)for(let ry=0;ry<2;ry++){const sc=noShadow(box(0.1,0.12,0.04,0x9a7532));
        sc.position.set(-0.24+rx*0.16,0.4+ry*0.26,0.46); R.torso.add(sc);}
      const strapH=noShadow(box(0.2,0.9,0.06,0x4a3320)); strapH.rotation.z=0.6; strapH.position.set(0,0.6,0.44); R.torso.add(strapH);
      // the Boeotian: a soft bronze dome with a wide wavy fold-down brim
      const domeB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.5,9,7,0,Math.PI*2,0,Math.PI*0.55),texturedMat("metal",0xb08a3f)));
      domeB.position.y=0.98; R.hat.add(domeB);
      const brimB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.68,9,5,0,Math.PI*2,Math.PI*0.32,Math.PI*0.22),texturedMat("metal",0x9a7532)));
      brimB.position.y=1.02; brimB.scale.y=1.5; R.hat.add(brimB); // the drooping brim
      const knotB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.08,5,4),plainMat(0x9a7532))); knotB.position.y=1.5; R.hat.add(knotB);
      const SW=weaponGrip(R.faR,-1.25,0.35); // the iron cavalry sword
      const crossH=noShadow(box(0.34,0.07,0.09,0x9a7532)); crossH.position.y=0.14; SW.add(crossH);
      const bladeH=noShadow(box(0.07,1.2,0.16,0xb9c0c9)); bladeH.position.y=0.76; SW.add(bladeH);
      const tipH=noShadow(cone(0.085,0.2,0xb9c0c9,4)); tipH.position.y=1.46; SW.add(tipH);
      const pomH=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.08,5,4),plainMat(0x9a7532))); pomH.position.y=-0.14; SW.add(pomH);
      // THE GRIP. Without it this sword is a pommel, 0.165 of daylight, then a crossguard —
      // which is exactly what John saw: 'missing handle and floating in front of hand'.
      const gripH=noShadow(cyl(0.055,0.06,0.22,0x4a3826,6)); gripH.position.y=0.02; SW.add(gripH);
    }
    if(u.cls==="cataphract"){ // CLASSICAL: mail head to toe, the faceless Sasanian helm
      for(let i=0;i<3;i++){const skirtM=new THREE.Mesh(new THREE.CylinderGeometry(0.56+i*0.02,0.58+i*0.02,0.2,10),texturedMat("metal",i%2?0x8d949c:0x7d858f));
        skirtM.scale.z=0.8; skirtM.position.y=0.14+i*0.3; skirtM.castShadow=false; R.torso.add(skirtM);}
      const domeC=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.52,9,7),texturedMat("metal",0x9aa2ad)));
      domeC.position.y=0.72; domeC.scale.y=1.15; R.hat.add(domeC); // the whole head, encased
      const spikeC=noShadow(cone(0.09,0.4,0x9aa2ad,5)); spikeC.position.y=1.45; R.hat.add(spikeC);
      const aventail=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.68,0.55,9),texturedMat("metal",0x7d858f)));
      aventail.position.y=0.12; R.hat.add(aventail); // mail falling to the shoulders
      const eyeL=noShadow(box(0.14,0.05,0.05,0x0c0c10)); eyeL.position.set(-0.14,0.82,0.5); R.hat.add(eyeL);
      const eyeR=noShadow(box(0.14,0.05,0.05,0x0c0c10)); eyeR.position.set(0.14,0.82,0.5); R.hat.add(eyeR); // minute slits
      const noseS=noShadow(box(0.05,0.14,0.05,0x0c0c10)); noseS.position.set(0,0.62,0.52); R.hat.add(noseS);
      const SC=weaponGrip(R.faR,-1.25,0.35); // the scimitar: a broad, sweeping curve
      const guardS=noShadow(cyl(0.12,0.12,0.06,0xd9a92e,7)); guardS.position.y=0.1; SC.add(guardS);
      const scA=noShadow(box(0.06,0.75,0.2,0xc2c8d0)); scA.position.y=0.5; SC.add(scA);
      const scB=noShadow(box(0.06,0.6,0.24,0xc2c8d0)); scB.position.set(0,1.05,0.13); scB.rotation.x=0.42; SC.add(scB);
      const scTip=noShadow(box(0.06,0.3,0.2,0xc8ced6)); scTip.position.set(0,1.4,0.34); scTip.rotation.x=0.8; SC.add(scTip);
    }
    if(u.cls==="knight"){ // MEDIEVAL: full plate, high plumes, the couched lance
      const cuirK=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.6,0.85,10),texturedMat("metal",0xb9c0c9));
      cuirK.scale.z=0.8; cuirK.position.y=0.55; cuirK.castShadow=false; R.torso.add(cuirK);
      const ridgeK=noShadow(box(0.06,0.8,0.05,0xd9a92e)); ridgeK.position.set(0,0.55,0.46); R.torso.add(ridgeK);
      for(const sx of [-0.5,0.5])for(let i=0;i<3;i++){
        const sp=new THREE.Mesh(new THREE.BoxGeometry(0.46-i*0.07,0.09,0.56-i*0.07),i===0?plainMat(0xd9a92e):texturedMat("metal",0xc2c9d4));
        sp.position.set(sx*(1+i*0.08),1.1-i*0.09,0); sp.castShadow=false; R.torso.add(sp);
      }
      // v131.26 the SEVENTH shape (§6.5a as amended): a closed houndskull bascinet. What was here
      // was a sphere with a 0.74-wide box on the front, and the dome is only 0.58 across at that
      // box's depth — the visor's corners came through the skull by 0.08 a side, which is John's
      // "knight mask is clipping". Closed-faced, per his ruling.
      helmHoundskull(R,tc,AGEPAL[4],{});
      const plumeBase=noShadow(cyl(0.1,0.12,0.12,0xd9a92e,6)); plumeBase.position.set(0,1.42,-0.08); R.hat.add(plumeBase);
      for(let i=0;i<3;i++){const pl=noShadow(cone(0.085,0.66-Math.abs(i-1)*0.12,i===1?0xcfc6ae:tc,5));
        pl.position.set((i-1)*0.13,1.72,-0.14-Math.abs(i-1)*0.04); pl.rotation.x=-0.38; R.hat.add(pl);} // gathered plumes, swept back
      const LL=5.4, LGr=weaponGrip(R.faR,-1.4,0.4);
      const lance=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.11,LL,7),texturedMat("wood",0x8a6a3f)));
      lance.position.y=LL/2-1.0; LGr.add(lance);
      const vamp=noShadow(cone(0.32,0.5,0xc2c9d4,8)); vamp.rotation.x=Math.PI; vamp.position.y=0.35; LGr.add(vamp); // the vamplate
      const tipL=noShadow(cone(0.14,0.55,0xc6c6c6,5)); tipL.position.y=LL-0.75; LGr.add(tipL);
      for(let i=0;i<3;i++){const band=noShadow(cyl(0.1,0.1,0.1,i%2?tc:0xcfc6ae,7)); band.position.y=1.4+i*0.9; LGr.add(band);} // striped
      const shield=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.15,1.05,0.85),heraldryMat(u.team,u.id))); shield.position.set(-0.1,-0.3,0.15); R.faL.add(shield);
    }
    if(u.cls==="dragoon"){ // ENLIGHTENMENT: wool and leather, saber and pistol
      const bandolier=noShadow(box(0.24,0.95,0.06,0x4a3320)); bandolier.rotation.z=0.55; bandolier.position.set(-0.04,0.6,0.44); R.torso.add(bandolier);
      for(let i=0;i<3;i++){const cart=noShadow(box(0.08,0.16,0.05,0xd8cdb4)); cart.position.set(-0.26+i*0.2,0.72-i*0.13,0.48); R.torso.add(cart);}
      const beltD=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.13,10),texturedMat("hide",0x3a2e1e));
      beltD.scale.z=0.8; beltD.position.y=0.2; beltD.castShadow=false; R.torso.add(beltD);
      // broad-brimmed hat, one side pinned up, team plume
      const brimD=noShadow(cyl(0.78,0.8,0.07,0x2b2318,10)); brimD.position.y=0.95; R.hat.add(brimD);
      const pin=noShadow(box(0.7,0.3,0.08,0x2b2318)); pin.position.set(0.55,1.12,0); pin.rotation.z=0.55; R.hat.add(pin); // the cocked side
      const crownD=noShadow(cyl(0.44,0.4,0.42,0x2b2318,9)); crownD.position.y=1.16; R.hat.add(crownD);
      const plumeD=noShadow(cone(0.08,0.6,tc,5)); plumeD.position.set(0.45,1.5,0); plumeD.rotation.z=-0.5; R.hat.add(plumeD);
      // the SABER: a curved blade of two angled segments
      const SB=weaponGrip(R.faR,-1.3,0.35);
      // >>> v131.11 THE SABER FLOATED 0.165 ABOVE AN EMPTY FIST AND HAD NO HANDLE. <<<
      // In the saber's own frame the hand's centre (endCap, r=0.12 at faR-local (0,-0.54,0)) sat
      // at (0,-0.332,0.113): a third of a unit BELOW the lowest thing on the weapon and 0.113 off
      // its axis. Gate A12 passed it because the guard is a torus of ring 0.12 + tube 0.03 at
      // y=0.08, so its geometry spans y -0.07..0.23 and "spans y=0" — that is the ring's WIDTH,
      // not a grip. Below the guard there was nothing at all: no grip, no pommel. Exactly the hole
      // patch-hilts.js closed on heavycav, legionaire and vanguard; this was the fourth sword.
      // HILT FIRST, THEN SEAT IT. The grip is 0.20 centred at -0.11 (spans -0.21..-0.01, biting
      // 0.06 into the guard's -0.07) and the pommel is r 0.075 at -0.235 (spans -0.31..-0.16,
      // biting 0.05 into the grip): one continuous object, no daylight along the stack. A fist
      // belongs at the grip's CENTRE, so the group goes to hand + 0.11 along the stack axis —
      // (0,-0.54,0) + 0.11*(0,-0.2675,0.9636) = (0,-0.569,0.106).
      // Measured: fist-to-saber 0.165 of air -> 0.080 of bite. The blade drops 0.123 (world y
      // 2.705-2.994 -> 2.582-2.871) and comes back 0.216 (tip 1.946 -> 1.729), which puts 0.45% of
      // the tip through the horse's mane — a graze it was avoiding only by floating.
      SB.position.set(0,-0.569,0.106);
      const guard=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.12,0.03,4,8),plainMat(0xd9a92e))); guard.position.y=0.08; SB.add(guard);
      const gripD=noShadow(cyl(0.05,0.055,0.20,0x4a3826,6)); gripD.position.y=-0.11; SB.add(gripD);
      const pomD=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.075,6,5),plainMat(0xd9a92e))); pomD.position.y=-0.235; SB.add(pomD);
      const bl1=noShadow(box(0.05,0.85,0.14,0xc2c8d0)); bl1.position.y=0.55; SB.add(bl1);
      const bl2=noShadow(box(0.05,0.6,0.13,0xc2c8d0)); bl2.position.set(0,1.14,0.09); bl2.rotation.x=0.3; SB.add(bl2);
      // the PISTOL rides the off hand — six shots, then the saber talks
      const PG=new THREE.Group(); PG.position.set(0,-0.5,0.25); PG.rotation.x=0.35; R.faL.add(PG); R.pistolG=PG;
      const grip=noShadow(box(0.1,0.24,0.12,0x4a3826)); grip.position.y=-0.08; PG.add(grip);
      const barrelP=noShadow(cyl(0.045,0.05,0.55,0x2e2e32,7)); barrelP.rotation.x=Math.PI/2; barrelP.position.set(0,0.06,0.3); PG.add(barrelP);
      const lockP=noShadow(box(0.07,0.09,0.14,0xd9a92e)); lockP.position.set(0.05,0.04,0.06); PG.add(lockP);
    }
  }
  if(rig==="scout"){ // built for speed: leather, nothing heavier
    const capS=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.54,8,6,0,Math.PI*2,0,Math.PI*0.5),texturedMat("hide",0x7a5230)));
    capS.position.y=0.74; R.hat.add(capS);
    const stitchS=noShadow(cyl(0.55,0.56,0.09,0x5a3c22,9)); stitchS.position.y=0.72; R.hat.add(stitchS);
    if(u.cls==="elitescout"){ // the elite ride in mail
      for(let i=0;i<3;i++){const rowE=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.58,0.2,10),texturedMat("metal",i%2?0x8d949c:0x7d858f));
        rowE.scale.z=0.8; rowE.position.y=0.24+i*0.28; rowE.castShadow=false; R.torso.add(rowE);}
      const coif=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,0.4,9),texturedMat("metal",0x7d858f)));
      coif.position.y=0.28; R.hat.add(coif); // mail coif under the cap
    }else{ // plain scout: crossed jerkin straps, light as it gets
      const j1=noShadow(box(0.2,0.95,0.05,0x6b4a2b)); j1.rotation.z=0.55; j1.position.set(0,0.6,0.44); R.torso.add(j1);
      const j2=noShadow(box(0.2,0.95,0.05,0x6b4a2b)); j2.rotation.z=-0.55; j2.position.set(0,0.6,0.44); R.torso.add(j2);
    }
    const SPs=weaponGrip(R.faR,-1.25,0.35);
    // v131.11 "VERY CLOSE BUT SLIGHTLY OFF" IS EXACTLY RIGHT, AND IT IS 0.129. The hand's centre
    // (endCap, r=0.12 at faR-local (0,-0.54,0)) sits at (0,-0.326,0.129) in the spear's own frame:
    // the shaft's axis passes 0.129 from it while the shaft is 0.059 of radius there, so its near
    // face is 0.070 from the centre — 0.050 INSIDE the fist — and its far face is 0.188, i.e.
    // 0.068 OUTSIDE it. The spear grazes the edge of the hand instead of running through it, which
    // is the whole of what John saw and why he called it close.
    // A pure perpendicular seat, so nothing slides along the shaft and the reach is untouched:
    // subtract the perpendicular part (0,0.1227,0.0408) from (0,-0.52,0.35). Measured, the world z
    // extent holds at -0.0045..3.1956 against -0.0042..3.1958 and the spear drops 0.129 in y;
    // fist daylight -0.049 -> -0.067 with nothing inside torso, arm or horse either side. Covers
    // elitescout, which shares this branch and measures identically.
    SPs.position.set(0,-0.643,0.309);
    const shaftS=noShadow(cyl(0.05,0.06,2.8,0x8a6a3f,6)); shaftS.position.y=0.9; SPs.add(shaftS);
    const tipS=noShadow(cone(0.11,0.4,0x8d949c,4)); tipS.position.y=2.5; SPs.add(tipS);
    if(CLS[u.cls].tier>=4){const banner=noShadow(box(0.7,0.5,0.06,tc)); banner.position.set(0,1.9,0.1); SPs.add(banner);}
  }
  if(rig==="priest"){
    const aura=new THREE.Mesh(new THREE.RingGeometry(CLS[u.cls].heal.rng-0.3,CLS[u.cls].heal.rng,32),
      new THREE.MeshBasicMaterial({color:0x6fdc7a,transparent:true,opacity:0.16,side:THREE.DoubleSide}));
    aura.rotation.x=-Math.PI/2; aura.position.y=0.07; u.body.add(aura);
    const hoodP=noShadow(cone(0.92,0.9,0xcfc6ae,6)); hoodP.position.y=1.24; R.hat.add(hoodP);
    const robe=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.2,0.9,0.8),texturedMat("robe",0xcfc6ae))); robe.position.y=0.15; R.torso.add(robe);
    // the staff grips the fist like the villager's tools: hand-anchored, carried at the ready, angled OUT (no more shoulder impalement)
    const SG=weaponGrip(R.faR,-0.9);
    SG.rotation.x-=Math.PI/4; // leveled 45° off vertical, same at-ready carry the tools use
    const staff=noShadow(cyl(0.06,0.06,2.0,0x8a6a3f)); staff.position.y=0.55; SG.add(staff); // gripped ~1/4 up the haft: a little butt below the fist, the length held outward
    const orb=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5),mat(0xe0c560))); orb.position.y=1.6; SG.add(orb); // the golden orb crowns the outward tip
  }
  if(rig==="barbarian"){ // §D CAMP BARBARIAN: LIME-WASHED SPIKED HAIR, woad, an oval shield
    // §D's neutrals do not age, but they are not exempt from the new look — the note is explicit
    // that they must be restyled or they read as leftovers from the old build. This one had a box
    // of hair and a second box of beard bolted to R.hat, on top of the carved evergreen beard the
    // shared rig already builds, so it wore two beards 0.05 apart. The box beard is gone; the
    // carved one is forced to §D's dark walnut through CLS.beardTone.
    // THE HAIR IS THE UNIT. §D: "the strongest cheap silhouette available and it is genuinely
    // Celtic" — five lime-washed spikes off a low scalp, no helmet, max channel 216.
    const scalp=noShadow(cyl(0.545,0.565,0.35,0x8A7A5E,12)); scalp.position.y=NC_HATY-0.10; R.head.add(scalp);
    for(let i=0;i<5;i++){
      const a=(i-2)*0.42;
      const sp=noShadow(cone(0.117,0.55,0xd0c8b4,5));
      sp.position.set(Math.sin(a)*0.30,NC_HATY+0.46,Math.cos(a)*0.26-0.06);
      sp.rotation.z=-Math.sin(a)*0.55; sp.rotation.x=Math.cos(a)*0.16-0.20; R.head.add(sp);
    }
    const vest=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.25,0.95,0.85),texturedMat("hide",0x6b4a2b))); vest.position.y=0.1; R.torso.add(vest);
    // the grey-team check cloak, pinned at ONE shoulder with a bronze fibula — asymmetric on purpose
    const cloakB=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.28,1.15,0.90),texturedMat("cloth",TEAMCOL[2])));
    cloakB.rotation.z=0.16; cloakB.position.set(-0.52,0.42,-0.10); R.torso.add(cloakB);
    const fibB=noShadow(cyl(0.10,0.10,0.05,0xA87A3A,8)); fibB.rotation.x=Math.PI/2; fibB.position.set(-0.42,0.92,0.34); R.torso.add(fibB);
    for(const s of [-1,1]){const shp=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.34,6,5),texturedMat("hide",0x5a4028))); shp.position.set(s*0.62,0.6,0); R.torso.add(shp);} // fur shoulders
    const neckB=noShadow(box(0.5,0.1,0.1,0xd2cdbe)); neckB.position.set(0,0.52,0.4); R.torso.add(neckB); // a bone necklace
    // the LONG OVAL Celtic shield with a vertical spine boss — oval against every other shield's
    // round or heater, which is §D's 40px separator from the vikings standing next to him
    const ovalB=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.14,1.55,0.82),plainMat(TEAMCOL[2])));
    ovalB.position.set(-0.14,-0.32,0.12); R.faL.add(ovalB);
    const spineB=noShadow(box(0.16,1.60,0.20,0x5A6068)); spineB.position.set(-0.20,-0.32,0.12); R.faL.add(spineB);
    const CG=weaponGrip(R.faR,-0.9); CG.rotation.x-=Math.PI/4; // the tools' at-ready carry
    const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.13,1.15,0.13),texturedMat("wood",0x6b4a2b))); haft.position.y=0.3; CG.add(haft);
    const knob=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.26,6,5),texturedMat("wood",0x5a4028))); knob.position.y=0.95; CG.add(knob);
    for(let i=0;i<3;i++){const spike=noShadow(cone(0.06,0.16,0x9aa2ad,4)); const a=i*2.1; spike.position.set(Math.cos(a)*0.24,0.95+((i%2)?0.1:-0.06),Math.sin(a)*0.24); spike.rotation.z=-Math.cos(a)*1.2; spike.rotation.x=Math.sin(a)*1.2; CG.add(spike);}
  }
  if(rig==="viking"||rig==="vikingboss"){ // §D SHORE RAIDERS: HORNED HELMS ON BOTH — owner ruling §0a.2
    // §0a.2 closes §I question 3 and it closes it against the historical record: the reference art
    // wins, this is a nutcracker game and not a museum, and the horns are the silhouette that
    // makes a raider read as a raider at 40px. BOTH the raider and the chieftain get them, and
    // that ruling is confirmed rather than provisional — do not "correct" it back.
    // Their palette is deliberately OUTSIDE every age ladder: colder and darker than any team unit,
    // so "not one of the two armies" is legible before anything else about them is. The box beard
    // that used to hang on R.hat is gone — they wear the carved evergreen like everyone else, in
    // §D's golden blonde (BEARD_TONES' lightest permitted tone) via CLS.beardTone.
    const boss=rig==="vikingboss", GREY=TEAMCOL[2];
    const helm=noShadow(_lm([[0.58,0],[0.575,0.26],[0.50,0.50],[0.30,0.64],[0,0.70]],12,0x4A4E54));
    helm.position.y=NC_HATY-0.10; R.head.add(helm);
    const rivB=noShadow(cyl(0.60,0.615,0.115,0x8A8078,12)); rivB.position.y=NC_HATY-0.05; R.head.add(rivB);
    for(let i=0;i<6;i++){const a=(i-2.5)*0.42;         // rivet dots along the brow band
      const rv=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.045,5,4),plainMat(boss?NC.gold:0x6E6A62)));
      rv.position.set(Math.sin(a)*0.60,NC_HATY-0.05,Math.cos(a)*0.60); R.head.add(rv);}
    const nasal=noShadow(box(0.086,0.30,0.09,0x8A8078)); nasal.position.set(0,NC_HATY-0.22,0.56); R.head.add(nasal);
    for(const s of [-1,1]){
      // TWO HORNS, ONE CONE EACH, sweeping out and up at 40° — §D's own hex, and dark. The first
      // cut split each horn into a dark base plus a pale tip and the tip landed 0.2 off the end of
      // the base: looked at, it read as a wing with a separate triangle floating past it. A horn
      // is one object. 0.70 rad off vertical is the 40° the row asks for.
      // v131.2 THE SIGN WAS INVERTED AND THAT IS THE WHOLE DEFECT.
      // ConeGeometry puts its APEX at +Y. rotation.z = +0.70 on the right-hand horn maps local +Y
      // to (-sin0.70, cos0.70) — i.e. the point aimed INBOARD at the helmet and the 0.30-wide flat
      // BASE DISC swung outboard and downward into open air. Rendered, that is a pale flat lozenge
      // hanging clear of the dome with sky between the two, which is exactly what the critic saw
      // and called a second horn pair, and it is why the pair read as wings sweeping down and back.
      // Negating it seats the base at x=0.224 against a dome of 0.578 — buried — and puts the point
      // out and UP at (0.816, 1.612). §0a.2 makes these the silhouette that says "raider" at 40px;
      // they have to be horn-shaped for that to work.
      const horn=noShadow(cone(0.15,boss?1.10:0.92,0x4A3A2A,7));
      horn.position.set(s*0.52,NC_HATY+0.40,-0.02); horn.rotation.z=-s*0.70; R.head.add(horn);
      // the iron cuff now sits where the horn actually LEAVES the dome (x 0.51, y 1.25) instead of
      // at 0.32, where it was 0.25 inside the helmet and had never been visible at all.
      const cuff=noShadow(cyl(0.155,0.175,0.12,0x8A8078,8));
      cuff.position.set(s*0.50,NC_HATY+0.39,-0.02); cuff.rotation.z=-s*0.70; R.head.add(cuff);
    }
    // the coif hangs to the SHOULDERS, not across the mouth. At NC_HATY-0.52 its 0.62-0.74 radius
    // sat over head-local 0.16-0.52, which is exactly where the §6.4 tooth band is painted, and the
    // raider lost the one feature that says nutcracker. Dropped clear of it.
    const coif=noShadow(cyl(0.60,0.76,0.30,0x3A3E44,14)); coif.position.y=NC_HATY-0.86; R.head.add(coif);
    // dark iron SCALE over dark mail: five stacked courses, and the grey team accent stays on the
    // shield and the belt only — §D keeps 0x9AA0A8 off the body so the wilds never read as a team
    for(let i=0;i<5;i++)_tRing(R,0.22+i*0.19,0.176,i%2?0x4A4E54:0x3A3E44,0.560,0.585,12);
    const tunic=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.28,0.42,0.85),texturedMat("cloth",0x3A3E44))); tunic.position.y=-0.10; R.torso.add(tunic);
    for(const s of [-1,1]){const xs=noShadow(box(0.156,1.00,0.06,0x4A3A2A)); xs.rotation.z=s*0.5; xs.position.set(0,0.56,0.46); R.torso.add(xs);}
    const belt=noShadow(box(1.3,0.18,0.88,boss?NC.gold:0x4a3320)); belt.position.y=-0.35; R.torso.add(belt);
    if(boss){                                          // §D: the only neutral with gold, at 1.15x
      for(const s of [-1,1])for(let i=0;i<3;i++){      // three gold arm-rings per arm
        const ar=noShadow(cyl(0.175,0.175,0.078,NC.gold,8)); ar.position.y=-0.16-i*0.16;
        (s<0?R.armL:R.armR).add(ar);}
      // AT -0.60 THIS HOOD COVERED THE MOUTH. Its 0.66-0.80 radius sat over head-local 0.11-0.41,
      // and §6.4's tooth band is painted at 0.30-0.36 — so the chieftain, alone of every figure in
      // the game, had no bared teeth. It is a shoulder mantle; it hangs at the neck.
      const hood=noShadow(cyl(0.66,0.80,0.30,0x6B5F52,12)); hood.position.y=NC_HATY-1.02; R.head.add(hood);
      const pelt=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.42,0.62,0.98),texturedMat("hide",0x6B5F52)));
      pelt.position.set(0,0.90,-0.02); R.torso.add(pelt);
      const wolfH=noShadow(box(0.36,0.34,0.28,0x6B5F52)); wolfH.position.set(0,0.62,0.48); R.torso.add(wolfH);
    }
    // a round war shield on the LEFT forearm
    // §D gives the chieftain NO shield — both hands on the Dane axe haft — and that plus the
    // 1.15x scale and the gold is the whole separation between the two.
    if(!boss){
      const sh=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.65,0.65,0.12,12),plainMat(GREY)));
      sh.rotation.z=Math.PI/2; sh.position.set(-0.15,-0.35,0); R.faL.add(sh);
      const shBoss=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14,5,4),plainMat(0x3A3E44))); shBoss.position.set(-0.24,-0.35,0); R.faL.add(shBoss);
    }
    // the axe: one hand for raiders, a long-hafted monster for the chieftain
    const AG=weaponGrip(R.faR,-0.9); AG.rotation.x-=Math.PI/4;
    const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12,boss?1.7:1.05,0.12),texturedMat("wood",0x6b4a2b))); haft.position.y=boss?0.55:0.25; AG.add(haft);
    if(!boss){const knob=noShadow(cyl(0.156,0.156,0.195,0xC9A97E,10)); knob.position.y=-0.26; AG.add(knob);} // the pale pommel knob
    const bit=noShadow(new THREE.Mesh(new THREE.BoxGeometry(boss?0.65:0.45,boss?0.5:0.36,0.1),texturedMat("metal",0x9aa2ad)));
    bit.position.set(boss?0.34:0.24,boss?1.25:0.7,0); AG.add(bit);
    const horn2=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.2,0.16,0.09),plainMat(0x7d848d))); horn2.position.set(-0.14,boss?1.25:0.7,0); AG.add(horn2); // the back-spike
    if(boss){
      u.body.scale.setScalar(1.45); // the chieftain towers over his crew
      const cloak=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.4,1.5,0.22),texturedMat("hide",0x6B5F52))); cloak.position.set(0,-0.1,-0.5); R.torso.add(cloak);
    }
  }
  if(rig==="king"){
    // ============================================================================================
    //  THE KING AGES WITH HIS TOWN — AGES §C, gated by §H A7
    // ============================================================================================
    // He is the win condition and the most-looked-at unit in the game, and until now he was a gold
    // drum with five spikes on it in every age from the Neolithic to the Enlightenment.
    //
    // THE CONSTANT IS THE GOLD. #CFB53B is on the crown in all six ages; the age changes the
    // crown's FORM and the cap inside it, never its metal. That is what makes six kings one king,
    // and it is why the gold here does NOT come out of AGEPAL — it is the one colour in this file
    // that is deliberately not age-driven.
    //
    // THE ROBE IS A SILHOUETTE DECISION AND IT IS THE ONE §H A7 fails on. §6.5: the robe reaches
    // 0.12 H above ground and THE LEG/BOOT SPLIT VANISHES, so the king reads as a solid trapezoid
    // below the belt where every soldier reads as a split column. That difference survives to 40px
    // and it is the only silhouette-level unit-class distinction in the game. The old king had
    // bare legs like everybody else.
    const kAge=unitAge(u), KA=AGEPAL[kAge];
    const GOLD=plainMat(NC.gold), GOLDD=plainMat(NC.goldD), GOLDH=plainMat(NC.goldH);
    // ---- the robe: one trapezoid from the belt to 0.12 H above the sole ----
    const robeM=kAge===3?plainMat(0x5B2A50)          // §C: Tyrian purple, this king's private colour
      :kAge===0?plainMat(0x4A3826)                    // bear pelt to the ankle
      :kAge===1?plainMat(KA.dominant)                 // cream pleated linen
      // §A.4: "No age's DOMINANT or CROWN may sit within 25 degrees of either team hue at chroma
      // C* > 20." §C's row for this king asks for madder #9A4234 — hue 9 degrees, saturation 0.74
      // — and the robe IS this unit's dominant surface, so a RED-team Iron king rendered as one
      // solid red mass on the one unit a player has to pick out of a fight instantly. §A.3 gives
      // age 2 no red that is not capped; its dominant is the cool grey that carries the age's whole
      // temperature flip. The madder survives as the rosette bands' trim, under the 6% cap.
      :kAge===2?plainMat(KA.dominant)                 // cool iron grey, madder-trimmed
      :texturedMat("uniform",tc);                     // Medieval/Enlightenment: full TC mantle
    const robe=new THREE.Mesh(_facetGeo(new THREE.CylinderGeometry(0.58,0.96,1.42,12),12),robeM);
    robe.scale.z=0.82; robe.position.y=u.rigBaseY-0.32; robe.castShadow=false; u.body.add(robe);
    const hem=_noSh(cyl(0.98,0.98,0.09,NC.gold,12)); hem.scale.z=0.82;
    hem.position.y=u.rigBaseY-1.00; u.body.add(hem);   // gold hem, and the plinth's top edge
    // THE ORPHREY BAND — one ring, and it is §2.5's budget on the king in both directions.
    // Measured, the six kings came back at 3.5 / 9.3 / 7.5 / 4.8 / 44.5 / 43.2% team colour against
    // a budget of 20-30% and a hard ceiling of 35%. That is two different bugs in one class: §C
    // gives ages 0-3 a robe in the age's own colour (bear pelt, linen, grey, purple) and gives 4-5
    // a robe that is ENTIRELY the team mantle. A band round the skirt is the standard fix for both
    // — team on the four that have none, ermine and gold lace on the two that have too much — and
    // it costs one mesh inside a cluster that already merges.
    const orph=_noSh(cyl(0.845,0.965,0.42,kAge<4?tc:kAge===4?0xD6CBB0:NC.gold,12));
    orph.scale.z=0.82; orph.position.y=u.rigBaseY-0.74; u.body.add(orph);
    // gold belt with the SQUARE buckle — straight off the reference art's centre figure
    const kbelt=_noSh(cyl(0.60,0.60,0.16,NC.gold,12)); kbelt.scale.z=0.82; kbelt.position.y=0.30; R.torso.add(kbelt);
    const buck=_noSh(box(0.26,0.20,0.05,NC.goldH)); buck.position.set(0,0.30,0.50); R.torso.add(buck);
    for(const sx of [-1,1]){                           // gold cuff rings at the wrists, also his
      const cuf=_noSh(cyl(0.15,0.15,0.09,NC.gold,8)); cuf.position.y=-0.40; (sx<0?R.faL:R.faR).add(cuf);
    }
    // ---- the mantle, per age: what hangs off the shoulders ----
    if(kAge===0){                                      // bear pelt, head and paws over the shoulders
      const pelt=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.30,1.05,0.95),texturedMat("hide",0x4A3826)));
      pelt.position.set(0,0.72,-0.05); R.torso.add(pelt);
      for(const sx of [-1,1]){const paw=_noSh(box(0.22,0.30,0.16,KA.leather)); paw.position.set(sx*0.34,0.98,0.46); R.torso.add(paw);}
    }else if(kAge===1){                                // the usekh pectoral: the widest gold on any king
      const usekh=_noSh(cyl(0.62,0.68,0.24,NC.gold,14)); usekh.scale.z=0.82; usekh.position.y=0.92; R.torso.add(usekh);
      const inlay=_noSh(cyl(0.64,0.66,0.06,KA.faience,14)); inlay.scale.z=0.82; inlay.position.y=0.80; R.torso.add(inlay);
    }else if(kAge===2){                                // gold rosette bands at hem, cuff and shoulder
      for(const by of [1.02,0.62]){const bnd=_noSh(cyl(0.585,0.585,0.078,NC.gold,12)); bnd.scale.z=0.82; bnd.position.y=by; R.torso.add(bnd);}
      for(const by of [0.90,0.50]){const md=_noSh(cyl(0.582,0.582,0.05,0x9A4234,12)); md.scale.z=0.82; md.position.y=by; R.torso.add(md);}
      for(let i=0;i<5;i++){const ro=_noSh(cyl(0.055,0.055,0.03,NC.goldH,8));
        ro.rotation.x=Math.PI/2; ro.position.set(-0.32+i*0.16,1.02,0.47); R.torso.add(ro);}
    }else if(kAge===3){                                // the paludamentum, pinned at the right shoulder
      const pal=_noSh(box(0.68,1.15,0.10,0x5B2A50)); pal.position.set(-0.12,0.60,-0.42); R.torso.add(pal);
      const drape=_noSh(box(0.30,0.95,0.14,0x5B2A50)); drape.rotation.z=-0.22; drape.position.set(0.44,0.58,0.30); R.torso.add(drape);
      const fib=_noSh(cyl(0.10,0.10,0.05,NC.goldH,8)); fib.rotation.x=Math.PI/2; fib.position.set(0.44,1.02,0.40); R.torso.add(fib);
      const tunicW=_noSh(box(0.66,0.80,0.06,KA.accent)); tunicW.position.set(0,0.62,0.47); R.torso.add(tunicW);
    }else if(kAge===4){                                // ERMINE at the throat and down the front edge
      const erm=_noSh(cyl(0.60,0.64,0.20,0xD6CBB0,12)); erm.scale.z=0.82; erm.position.y=1.00; R.torso.add(erm);
      for(let i=0;i<4;i++){const fl=_noSh(box(0.06,0.09,0.03,0x2b2b2b)); fl.position.set(-0.27+i*0.18,1.00,0.50); R.torso.add(fl);}
      const edge=_noSh(box(0.14,1.05,0.06,0xD6CBB0)); edge.position.set(-0.30,0.58,0.48); R.torso.add(edge);
      for(let i=0;i<4;i++){const dm=_noSh(box(0.07,0.07,0.02,NC.gold)); dm.position.set(0.18,0.92-i*0.22,0.50); R.torso.add(dm);}
    }else{                                             // the broad silk sash of the order + gorget
      const sash=_noSh(box(0.30,1.25,0.05,NC.gold)); sash.rotation.z=0.55; sash.position.set(0,0.60,0.47); R.torso.add(sash);
      const gorg=_noSh(cyl(0.50,0.56,0.14,NC.gold,12)); gorg.scale.z=0.82; gorg.position.y=1.06; R.torso.add(gorg);
      const star=_noSh(cyl(0.13,0.13,0.03,NC.goldH,8)); star.rotation.x=Math.PI/2; star.position.set(-0.28,0.74,0.50); R.torso.add(star);
    }
    // ---- SIX CROWNS. Every one reduces to a gold mass ≥0.10 H tall spanning ≥0.90 × headWidth ----
    // §C's anti-drift note: if a critic can crop the top 0.20 H of any king and not see gold, that
    // king has failed regardless of how correct its history is. The band is the floor; the form on
    // top of it is what changes.
    const bandY=NC_HATY-0.02, bandH=0.40;              // 0.10 H, and it never moves
    // …EXCEPT ON THE BASILEUS, AND THAT IS THE ONE EXCEPTION §C ITSELF ASKS FOR.
    // The wreath below was built correctly — two rings and eleven leaf pairs — and then rendered
    // as a solid gold drum, because this band is a 0.40-tall cylinder at r 0.60 and the wreath's
    // own rings sit at bandY+0.10 and +0.34 at r 0.60: entirely INSIDE it. As a black silhouette
    // at 40px the age-3 king was indistinguishable from the age-2 polos, which is §H A7's third
    // sub-test. §C: "Low, open, and the only crown you can see the head through."
    // >>> v131.4 SIX CROWNS, SIX FORMS — §H A7's THIRD SUB-TEST, WHICH THE TOOL NOW MEASURES. <<<
    // "the six crowns are not mutually distinguishable at 40px by form alone as pure black
    // silhouettes." Measured: IoU 0-2 0.881, 2-3 0.855, 0-3 0.839, 1-4 0.789, 0-1 0.785, 1-2
    // 0.753, 4-5 0.768 — eleven of fifteen pairs over 0.70 — and adjacent h/w Δ of 0.09 and 0.07.
    // Looked at, ages 0-3 were four solid caps: every form §C describes was BUILT and then buried
    // inside a lathe. The Wanax's seven rays were 0.35 tall inside a 0.58 head-cloth; the
    // Chieftain's tines rose off a dome as wide as they were; the Basileus's eleven leaf pairs
    // ringed a hair mass that filled the wreath. A crown whose silhouette is the CAP is the cap.
    // What changes below is not decoration but which solid owns the outline, per age:
    //   0 Chieftain  LOW open band, cap sunk inside it, two long antler tines out at 35°   h/w ~0.85
    //   1 Wanax      flat diadem, SEVEN long rays with sky between them                    h/w ~1.30
    //   2 Great King one tall closed straight-sided drum — §C: "the only king whose crown is
    //                a closed drum"                                                        h/w ~1.55
    //   3 Basileus   the flattest crown in the set: an open wreath over LOW hair           h/w ~0.80
    //   4 Rex        five tall fleurons round a red dome                                   h/w ~1.20
    //   5 Sovereign  two closed arches and an orb-and-cross                                h/w ~1.45
    // §C's gold is deliberately CONSTANT across all six ("the age changes the crown's FORM and the
    // cap inside it, never its metal"), so the king is scored by A7, not by A1's colour spread —
    // a critic reading A1's king numbers is reading a test §C exempts this class from by design.
    if(kAge!==3&&kAge!==0){
      const band=_noSh(cyl(0.60,0.615,bandH,NC.gold,14)); band.position.y=bandY+bandH/2; R.head.add(band);
    }
    if(kAge===0){        // THE CHIEFTAIN — hammered sheet gold, Varna discs, two antler tines
      // THE BAND IS LOW AND THE CAP IS SUNK INSIDE IT. §C's 40px cue for this king is "two antler
      // tines flanking a gold band — the only horned crown", and the shipped build put a 0.58-tall
      // fur dome on top of a 0.40 band and hung the tines off its shoulders, so the outline was a
      // dome with two bumps and it scored IoU 0.881 against the Iron polos. The band carries the
      // §C anti-drift floor on its own (0.26 tall = 0.067 H, plus the discs — checked by A7's own
      // gold-rows clause below), the fur is a roll INSIDE it, and the tines are the silhouette.
      const band0=_noSh(cyl(0.605,0.62,0.28,NC.gold,14)); band0.position.y=bandY+0.14; R.head.add(band0);
      const cap=_lm([[0.575,0],[0.565,0.14],[0.45,0.24],[0,0.30]],10,0x5A4636);
      cap.position.y=bandY+0.10; R.head.add(cap);
      for(let i=0;i<5;i++){const d=_noSh(cyl(0.12,0.12,0.025,NC.goldH,10));
        d.rotation.x=Math.PI/2; d.position.set(-0.34+i*0.17,bandY+0.14,0.60); R.head.add(d);}
      // …and the tines are 0.86 long at 35 degrees, so they clear the band by half their length on
      // both sides. Two long spikes off a low bar is a shape nothing else in the set has.
      for(const sx of [-1,1]){const tine=_noSh(cone(0.078,0.86,KA.accent,5));
        tine.position.set(sx*0.50,bandY+0.66,-0.04); tine.rotation.z=sx*0.60; R.head.add(tine);
        const t2=_noSh(cone(0.055,0.34,KA.accent,5));
        t2.position.set(sx*0.80,bandY+0.86,-0.04); t2.rotation.z=sx*0.95; R.head.add(t2);}
    }else if(kAge===1){  // THE WANAX — a flat radiant diadem: seven rising gold rays
      // THE HEAD-CLOTH DROPS AND THE RAYS DOUBLE. §C: "flat and radiant rather than pointed", and
      // the rays are the whole cue. At 0.35 tall inside a 0.58 head-cloth not one of them broke
      // the outline; this king measured a plain 104x149 blob and scored 0.789 against the Rex.
      // 0.66 of ray on a 0.30 cloth is a comb with real sky between the teeth.
      const cloth=_lm([[0.575,0],[0.56,0.16],[0.44,0.26],[0,0.30]],12,KA.dominant);
      cloth.position.y=bandY+bandH-0.06; R.head.add(cloth);
      const tail=_noSh(box(0.78,0.62,0.10,KA.metal)); tail.position.set(0,bandY-0.10,-0.52); R.head.add(tail);
      // FLAT AND RADIANT, not tall and radiant. §C's word for this diadem is FLAT — "the
      // Aegean/Egyptian form, flat and radiant rather than pointed" — and at 0.66 of ray it stood
      // 1.60 h/w against the Iron polos's 1.47 and scored §H A7's third clause at 0.817: two tall
      // gold masses in one rectangle. 0.40 of ray splayed 0.30 per step is a low wide fan, which
      // is the only crown in the set wider than it is tall apart from the Basileus's open wreath.
      // …AND FLATTENING IT FURTHER WAS THE WRONG DIRECTION, MEASURED. Cut to 0.40 of ray and
      // splayed 0.30 per step, the outer rays tucked back inside the cloth cap's own outline: the
      // diadem measured 110x155 instead of 104x166 and §H A7's third clause went from 0.733 to
      // 0.863 against the polos. The rays only separate this crown while they are OUTSIDE it.
      for(let i=0;i<7;i++){const ray=_noSh(box(0.086,0.66,0.045,NC.gold));
        const a=(i-3)*0.345; ray.position.set(Math.sin(a)*0.56,bandY+bandH+0.30,Math.cos(a)*0.56);
        // …and they FAN. §C calls this diadem "flat and radiant"; splayed 0.23 rad per step the
        // outer rays lean 40 degrees off vertical, so the outline is a sunburst rather than the
        // ring of vertical points the Rex wears — which is the pair §H A7 could not tell apart.
        ray.rotation.y=a; ray.rotation.z=(i-3)*0.13; R.head.add(ray);}
      const plate=_noSh(box(0.24,0.26,0.05,NC.goldH)); plate.position.set(0,bandY+0.22,0.62); R.head.add(plate);
    }else if(kAge===2){  // THE GREAT KING — a truncated conical polos. A closed gold DRUM.
      // TALLER AND STRAIGHTER. §C's 40px cue is "a tall solid gold cylinder on the head — the only
      // king whose crown is a closed drum", and at 1.24 across on 0.80 of height it was neither
      // tall nor a cylinder: h/w 1.13 against the Chieftain's 1.01 and the Basileus's 1.04, three
      // caps of one proportion, IoU 0.881 and 0.855. 1.22 across on 1.16 of drum is the tallest
      // closed solid in the set and the only one with parallel sides.
      // 0.615 and NOT 0.578: narrowed to 1.16 across this drum measured h/w 1.83 and slid whole
      // inside the Wanax's ray cluster — §H A7's third clause went from 0.687 to 0.849 on that one
      // pair. §C's cue for the age is "a TALL SOLID GOLD CYLINDER", and a cylinder has to be wide
      // enough to read as one; the height carries the ratio and the width keeps it out of the
      // diadem's outline.
      // 0.88 OF DRUM AND NOT 1.16, AND §C'S OWN NUMBER IS 0.78. At 1.16 this stood h/w 1.69
      // against the Wanax's 1.67 — two tall gold masses of one proportion, §H A7's third clause at
      // 0.851 — and it was already 50% taller than the `cyl(0.17,0.20,0.20,14)` §C specifies. The
      // age's cue is "a tall solid gold cylinder… the only king whose crown is a closed DRUM", and
      // a drum is defined by being closed and straight-sided, not by being the tallest thing here;
      // the Sovereign's arches own that. Shorter reads as more of a hat, not less.
      const polos=_lm([[0.628,0],[0.636,0.24],[0.636,0.64],[0.612,0.76],[0.47,0.84],[0,0.88]],14,NC.gold);
      polos.position.y=bandY; R.head.add(polos);
      for(let r=0;r<3;r++){const bnd=_noSh(cyl(0.652,0.652,0.05,NC.goldD,14));
        bnd.position.y=bandY+0.18+r*0.22; R.head.add(bnd);}
      const peak=_noSh(cone(0.15,0.22,NC.goldH,8)); peak.position.y=bandY+0.96; R.head.add(peak);
      const fillet=_noSh(cyl(0.60,0.60,0.10,KA.leather,14)); fillet.position.y=bandY-0.04; R.head.add(fillet);
    }else if(kAge===3){  // THE BASILEUS — a laurel wreath. The one crown you see the head through.
      // the two rings span 0.05 to 0.44 — 0.39 world = 0.10 H, so §C's anti-drift floor ("a gold
      // mass >= 0.10 H spanning >= 0.90 x headWidth") is still met — and the leaves BRIDGE them, so
      // the gold region is contiguous top to bottom through eleven separate uprights with real sky
      // between them. That is a broken silhouette, which is the whole point of a wreath.
      // …AND THE HAIR HAS TO STAY UNDER IT. §C: "Low, open, and the only crown you can see the
      // head through", and the 40px cue for the age is the PURPLE, not the head. The shipped build
      // put a 0.36-tall hair lathe at bandY+0.40 — i.e. filling the wreath from the inside — and
      // the Basileus came back as a third solid cap, IoU 0.855 against the polos and 0.839 against
      // the Chieftain. The leaves now lean OUT rather than up, so the ring's own outline is a
      // scalloped edge with sky between every pair, and the hair sits below the lower ring.
      for(const ry of [0.05,0.40]){const ring=_noSh(cyl(0.60,0.60,0.042,NC.gold,16)); ring.position.y=bandY+ry; R.head.add(ring);}
      for(let i=0;i<11;i++){const a=(i/11)*Math.PI*2;
        const lf=_noSh(box(0.075,0.46,0.028,NC.goldH));
        lf.position.set(Math.sin(a)*0.665,bandY+0.225,Math.cos(a)*0.665);
        lf.rotation.y=a; lf.rotation.x=0.26; lf.rotation.z=0.55; R.head.add(lf);}
      const hair=_lm([[0.552,0],[0.545,0.10],[0.44,0.18],[0,0.22]],12,0x3A2A1E);   // §C: no cap; dark hair
      hair.position.y=bandY+0.30; R.head.add(hair);
    }else if(kAge===4){  // THE REX — the reference art's crown: five fleurons round a red dome
      const cap=_lm([[0.55,0],[0.545,0.22],[0.44,0.42],[0.24,0.54],[0,0.58]],12,0x8A2A28);
      cap.position.y=bandY+0.06; R.head.add(cap);
      // LOW AND WIDE, AND THE SOVEREIGN NEXT DOOR GOES TALL. §H A1b had these two at IoU 0.768
      // with h/w 1.42 and 1.49 — 0.07 apart on an adjacent pair that needs 0.15 — because both are
      // "a band, some points and a domed red cap" and only §C's arches tell them apart. The Rex is
      // the OPEN crown: short fleurons stepped out to 0.65 of radius so the gaps between them are
      // as wide as the points, and the cap's dome showing between. The arch is the Sovereign's.
      for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2;
        const fl=_noSh(box(0.135,0.30,0.05,NC.gold));
        // 0.645 and NOT 0.735: past ~0.68 the outer fleurons stop touching the cap and become
        // DETACHED islands — which the mask's flood fill (rightly) drops, so pushing them out made
        // the crown measure NARROWER. A crown's points are attached to its band.
        fl.position.set(Math.sin(a)*0.645,bandY+bandH+0.09,Math.cos(a)*0.645); fl.rotation.y=a; R.head.add(fl);
        const tre=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.098,6,5),GOLDH));
        tre.position.set(Math.sin(a)*0.645,bandY+bandH+0.24,Math.cos(a)*0.645); R.head.add(tre);
        const pa=((i+0.5)/5)*Math.PI*2;                 // four pearls between them (five gaps, four shown)
        if(i<4){const pe=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.070,6,5),plainMat(0xD6CBB0)));
          pe.position.set(Math.sin(pa)*0.62,bandY+bandH+0.06,Math.cos(pa)*0.62); R.head.add(pe);}}
      const orb=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.098,7,6),GOLDH)); orb.position.y=bandY+0.60; R.head.add(orb);
    }else{               // THE SOVEREIGN — a CLOSED imperial crown: two arches and an orb-and-cross
      const cap=_lm([[0.55,0],[0.54,0.20],[0.42,0.38],[0.22,0.50],[0,0.54]],12,0x8A2A28);
      cap.position.y=bandY+0.06; R.head.add(cap);
      for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2;
        const fl=_noSh(box(0.117,0.30,0.047,NC.gold));
        fl.position.set(Math.sin(a)*0.585,bandY+bandH+0.12,Math.cos(a)*0.585); fl.rotation.y=a; R.head.add(fl);}
      // THE ARCHES RISE, AND THAT IS THE WHOLE POINT OF THIS CROWN. §C: "Closed, not open — the
      // visible difference from the Medieval crown, and the correct one." A 0.34 rise put the orb
      // level with the Rex's trefoils and the two crowns scored IoU 0.768. 0.58 of rise plus the
      // orb-and-cross above it makes this the tallest thing any king wears, which is what a closed
      // imperial crown IS, and it takes the pair to 0.45 of h/w separation instead of 0.07.
      for(const ax of [0,Math.PI/2]){                   // THE ARCHES — the visible difference from the Rex
        for(let k=0;k<5;k++){const t=(k-2)/2;
          const seg=_noSh(box(0.086,0.086,0.20,NC.gold));
          const px=Math.sin(t*1.15)*0.53, py=bandY+bandH+0.10+Math.cos(t*1.15)*0.58;
          seg.position.set(Math.cos(ax)*px,py,Math.sin(ax)*px); seg.rotation.y=ax; seg.rotation.x=t*0.9; R.head.add(seg);}}
      const orb=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.12,7,6),GOLDH)); orb.position.y=bandY+bandH+0.76; R.head.add(orb);
      const crV=_noSh(box(0.055,0.30,0.055,NC.goldH)); crV.position.y=bandY+bandH+1.02; R.head.add(crV);
      const crH=_noSh(box(0.19,0.055,0.055,NC.goldH)); crH.position.y=bandY+bandH+1.00; R.head.add(crH);
      for(const sx of [-1,1]){                          // the powdered wig's two side-rolls
        const rl=_noSh(cyl(0.156,0.156,0.215,0xB8B0A0,10));
        rl.rotation.z=Math.PI/2; rl.position.set(sx*0.56,bandY-0.30,-0.06); R.head.add(rl);}
    }
    // ---- the regalia in his hands, and the age's own sceptre head ----
    const KG=weaponGrip(R.faR,NC_SPEAR_CARRY,0.3);
    const staff=_noSh(cyl(0.062,0.070,1.45,kAge===0?KA.wood:NC.gold,8)); staff.position.y=0.50; KG.add(staff);
    if(kAge===0){const mace=_noSh(cyl(0.24,0.24,0.30,KA.stone,8)); mace.position.y=1.30; KG.add(mace);}
    else if(kAge===1){const hilt=_noSh(box(0.30,0.10,0.10,NC.goldH)); hilt.position.y=1.24; KG.add(hilt);
      const bl=_noSh(box(0.13,0.55,0.05,KA.metalLit)); bl.position.y=1.56; KG.add(bl);}
    else if(kAge===2){const m2=_noSh(cyl(0.16,0.16,0.26,NC.goldH,10)); m2.position.y=1.30; KG.add(m2);}
    else if(kAge===3){const eag=_noSh(box(0.24,0.20,0.12,NC.goldH)); eag.position.y=1.28; KG.add(eag);
      const wing=_noSh(box(0.46,0.06,0.10,NC.goldH)); wing.position.y=1.34; KG.add(wing);}
    else{const cx=_noSh(box(0.070,0.30,0.070,NC.goldH)); cx.position.y=1.34; KG.add(cx);
      const cy2=_noSh(box(0.22,0.070,0.070,NC.goldH)); cy2.position.y=1.36; KG.add(cy2);
      const orb2=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.13,7,6),GOLDH)); orb2.position.set(0,-0.50,0.22); R.faL.add(orb2);}
  }
  refreshBar(u);
}

// ---------- name tags: a small billboard above every player-controlled body ----------
function _makeTagSprite(text,team){
  const c=document.createElement("canvas"); c.width=256; c.height=64;
  const g=c.getContext("2d");
  if(g.clearRect){ // headless stubs no-op all of this safely
    g.clearRect(0,0,256,64);
    g.font="bold 34px Georgia, serif"; g.textAlign="center"; g.textBaseline="middle";
    g.lineWidth=6; g.strokeStyle="rgba(20,12,4,0.85)"; g.strokeText(text,128,32);
    g.fillStyle=team===BLUE?"#9db8ff":"#ffb0a6"; g.fillText(text,128,32);
  }
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.LinearFilter; tex.minFilter=THREE.LinearFilter; tex.generateMipmaps=false;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
  sp.scale.set(3.4,0.85,1); sp.center.set(0.5,0);
  return sp;
}
function setNameTag(u,name){
  if(!u)return;
  // v130 U1: 5.1 -> 6.2. A shako puts a foot soldier's crown at ~3.9 and its plume at ~4.4, and
  // the old constants were measured against a hatless 3.35 figure — the hat punched straight
  // through both the bar and the tag (AD §5.4). Same OX_TAG_Y pattern, same reason.
  const _ty=(CLS[u.cls]&&CLS[u.cls].rig==="oxcart")?OX_TAG_Y():(CLS[u.cls]&&CLS[u.cls].mounted)?6.2:6.2; // v113: the wain rides high
  if(u._tag&&u._tagText===name){u._tag.position.y=_ty;return;} // track mounts
  if(u._tag){u.root.remove(u._tag);if(u._tag.material.map)u._tag.material.map.dispose();u._tag.material.dispose();}
  u._tag=_makeTagSprite(name,u.team); u._tagText=name;
  u._tag.position.y=_ty; // just above the health bar
  u.root.add(u._tag);
}
function clearNameTag(u){
  if(u&&u._tag){u.root.remove(u._tag);if(u._tag.material.map)u._tag.material.map.dispose();u._tag.material.dispose();u._tag=null;u._tagText=null;}
}
function syncNameTags(sc){ // sc rows: [name, score, team, unitId, lvl?] — tag those bodies, untag the rest
  const want={};
  for(const row of sc){if(row.length>=4&&typeof row[3]==="number")
    want[row[3]]=row[0]+(row[4]?" ⭐"+row[4]:"");} // v87: everyone sees a player's LEVEL over their head
  for(const u of units){
    if(want[u.id]!==undefined&&u!==player)setNameTag(u,want[u.id]);
    else if(u._tag)clearNameTag(u);
  }
}
// v99 CARGO VISUALS: every client can SEE what a cart hauls. Hosts compute the load
// from live state; guests read the cargo byte the snapshot delivered (u._cargo).
function cargoFrac(u){
  if(typeof u._cargo==="number")return u._cargo; // a guest's view of everyone else
  if(u.cls==="oxcart")return Math.min(1,((u.carry&&u.carry.wood)||0)/300);
  if(u.cls==="trader")return u.tradeLoaded?1:0;
  if(u.bot&&u.bot.role==="cart")return u.tradePhase==="back"?1:0;
  return 0;
}
function updateCargoVisual(u){
  const R=u.rig; if(!R)return;
  const load=cargoFrac(u);
  if(R.goods)R.goods.visible=load>0.01;      // trade carts: the gold rides only when loaded
  if(R.logs){                                 // the ox: the log pile grows with the haul
    R.logs.visible=load>0.01;
    const n=R.logs.children.length, ln=Math.max(1,Math.ceil(load*n)); // v113: the stack is 8 logs now, not 6
    R.logs.children.forEach((lg,i)=>{lg.visible=i<ln;});
  }
}
function refreshBar(u){
  if(u.bar){ // v122: dispose, don't just detach — two SpriteMaterials per class change adds up
    u.root.remove(u.bar.bg); u.root.remove(u.bar.fg);
    if(u.bar.bg.material)u.bar.bg.material.dispose();
    if(u.bar.fg.material)u.bar.fg.material.dispose();
  }
  const rg=CLS[u.cls].rig;
  const barY = CLS[u.cls].mounted?5.4
    :rg==="treb"?16:rg==="ram"?11.5:rg==="catapult"?9
    :rg==="oxcart"?OX_BAR_Y() // v113: the wain rides high — the bar tracks OXSCALE
    :rg==="cannon"?8:5.3;                          // 4.3 -> 5.3: clear of the shako crown (AD §5.4)
  u.bar=makeBar(u.root,barY,1.7,u.team===BLUE?0x53d769:0xff6b5e);
  if(u.isPlayer){u.bar.bg.visible=false;u.bar.fg.visible=false;} // you have the HUD bar
}

// ---------- optional glTF models (see assets/models/README-ASSETS.md) ----------
function tryAttachModel(u){
  const M=MODELS[u.cls]; if(!M)return false;
  u._modelBody=true; // its geometry is SHARED with MODELS[cls] — never dispose it (see buildBodyFor)
  const inst=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(M.scene):M.scene.clone();
  inst.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false; // §3.8 — a model unit stands on the ground too
      if(o.material){ // FBX metallic factors render as charcoal under filmic light
        if(o.material.metalness!==undefined)o.material.metalness=0;
        if(o.material.roughness!==undefined)o.material.roughness=0.9;
        o.material.needsUpdate=true;
      }
      if(o.material&&o.material.map){ // point-sampled skins: sharp PS1 pixels, no smear
        const t=o.material.map;
        t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;
        t.generateMipmaps=false;t.needsUpdate=true;
      }
    }
  });
  const c=M.cfg;
  inst.scale.setScalar(c.scale||1);
  inst.position.y=c.y||0;
  inst.rotation.y=(c.rotY!==undefined)?c.rotY:0;
  u.body.add(inst);
  if(M.clips&&M.clips.length){
    u.mixer=new THREE.AnimationMixer(inst);
    const find=re=>{const cl=M.clips.find(k=>re.test(k.name));return cl?u.mixer.clipAction(cl):null;};
    u.actions={
      idle:find(/idle/i)||u.mixer.clipAction(M.clips[0]),
      walk:find(/walk|run|gallop/i),
      attack:find(/attack|slash|shoot|melee|punch|stab/i),
      work:find(/work|gather|chop|farm/i)
    };
    if(u.actions.work)u.actions.work.setLoop(THREE.LoopRepeat);
    if(u.actions.attack){
      const dur=u.actions.attack.getClip().duration;
      if(!u.actions.work&&dur>1.5){
        // no Work clip: a long "attack" doubles as the work loop (old villager behavior)
        u.actions.attack.setLoop(THREE.LoopRepeat);
      }else{
        // real strike: one-shot, TIME-SCALED to land within one attack cooldown
        u.actions.attack.setLoop(THREE.LoopOnce);
        u.actions.attack.clampWhenFinished=true;
        u.attackAnimDur=0.9;
        u.actions.attack.timeScale=dur/u.attackAnimDur;
      }
    }
    if(u.actions.idle)u.actions.idle.play();
    u.curAction=u.actions.idle;
  }
  return true;
}
// ---------- baked Mixamo playback retargeted onto the procedural rigs ----------
const _limbBones={LeftArm:"armL",LeftForeArm:"faL",RightArm:"armR",RightForeArm:"faR",
  LeftUpLeg:"legL",LeftLeg:"shinL",RightUpLeg:"legR",RightLeg:"shinR"};
const _coreBones={Spine1:"torso",Head:"head"};
const _bq=new THREE.Quaternion();
const WOODEN=true; // nutcrackers move in stop-motion steps, like toys animated by hand
const _dq=new THREE.Quaternion();
function _sampleQ(arr,n,tt,flip,damp){
  if(WOODEN)tt=Math.floor(tt);
  const i0=Math.floor(tt)%n,i1=(i0+1)%n,f=WOODEN?0:tt-Math.floor(tt),a=i0*4,b=i1*4;
  let x=arr[a]*(1-f)+arr[b]*f, y=arr[a+1]*(1-f)+arr[b+1]*f,
      z=arr[a+2]*(1-f)+arr[b+2]*f, w=arr[a+3]*(1-f)+arr[b+3]*f;
  if(flip){x*=flip[0];y*=flip[1];z*=flip[2];}
  _bq.set(x,y,z,w).normalize();
  if(damp!==undefined&&damp<1)return _dq.set(0,0,0,1).slerp(_bq,damp);
  return _bq;
}
function _clipFrom(pool,idx){
  const A=window.BAKED_ANIMS;
  if(!A||!A.pools[pool]||!A.pools[pool].length)return null;
  const names=A.pools[pool];
  return A.clips[names[idx%names.length]];
}
function applyBaked(u,R,dt,moving,working){
  const A=window.BAKED_ANIMS; if(!A)return false;
  if(CLS[u.cls].mounted)return false; // riders keep their sitting pose
  const LF=A.limbFlip||[1,-1,-1];
  let clip=null,tt=0;
  if(u.attackAnimT>0){
    clip=_clipFrom("attack",u.id);
    if(clip){const prog=1-(u.attackAnimT/0.9);tt=Math.min(clip.n-1.001,prog*(clip.n-1));}
  }
  if(!clip&&working){
    const node=u.gathering||(u.bot&&u.bot.node);
    const sub=(u.task&&u.task.site)?/build|hammer|work/i:
              (node&&node.type==="food")?/harvest|pick|farm/i:
              node?/mine|chop/i:null;
    const names=A.pools.work||[];
    let pick=sub?names.find(n=>sub.test(n)):null;
    clip=pick?A.clips[pick]:_clipFrom("work",u.id);
    if(clip){u.bakedT=(u.bakedT||0)+dt*clip.fps;tt=u.bakedT%clip.n;}}
  if(!clip&&moving){
    clip=_clipFrom("walk",u.spd>8.5?1:0)||_clipFrom("walk",0);
    if(clip){u.bakedT=(u.bakedT||0)+dt*clip.fps*(0.55+u.spd*0.055);tt=u.bakedT%clip.n;}}
  if(!clip)return false;
  const striking=u.attackAnimT>0;
  const LEGS={LeftUpLeg:"legL",LeftLeg:"shinL",RightUpLeg:"legR",RightLeg:"shinR"};
  for(const bn in _limbBones){
    const g=R[_limbBones[bn]],arr=clip.bones[bn];
    if(!g||!arr)continue;
    if(striking&&LEGS[bn]){continue;} // toy soldiers strike from planted feet
    const damp=LEGS[bn]?0.9:(striking?0.95:0.8);
    g.quaternion.copy(_sampleQ(arr,clip.n,tt,LF,damp));
  }
  if(striking){ // braced stance while the arms do the work
    R.legL.rotation.set(-0.14,0,0); R.shinL.rotation.set(0.18,0,0);
    R.legR.rotation.set(0.2,0,0);   R.shinR.rotation.set(0.22,0,0);
  }
  for(const bn in _coreBones){
    const g=R[_coreBones[bn]],arr=clip.bones[bn];
    if(g&&arr)g.quaternion.copy(_sampleQ(arr,clip.n,tt,null,bn==="Head"?0.5:(striking?0.6:0.4)));
  }
  if(clip.bob&&clip.bob.length)R.torso.position.y=u.rigBaseY+(clip.bob[Math.floor(tt)%clip.n]||0);
  u.body.rotation.x=moving?0.07:0;
  return true;
}
// event-driven strike: restart the attack clip and hold it until it completes
function triggerAttackAnim(u){
  // v100 SOUND — melee swing whoosh. Combat lines only: ranged/siege get bow/siege cues,
  // villagers/oxen get gather cues. Universal hook: fires for player, bots, and guest re-triggers.
  if(typeof Sound!=="undefined"&&u&&u.root&&u.cls&&CLS[u.cls]){
    const _c=CLS[u.cls],_ln=_c.line,_p={x:u.root.position.x,z:u.root.position.z};
    // v102: swing character by unit — scouts slash light, heavies swing deep, the rest airy
    if(_ln==="scoutline")Sound.play("swinglight",_p);
    else if(_ln==="cavalry"||((_ln==="melee"||_ln==="anticav")&&(_c.tier||0)>=3))Sound.play("swingheavy",_p);
    else if(_ln==="melee"||_ln==="anticav"||_ln==="royal")Sound.play("swing",_p);
    // v109 THE VOICES: battle chatter — ~1 in 4 MELEE swings carries the soldier's own attack shout
    if((_ln==="melee"||_ln==="anticav"||_ln==="royal"||_ln==="cavalry"||_ln==="scoutline")&&
       Math.random()<0.25&&Sound.vox)Sound.vox("atk",u,_p);
  }
  const A=window.BAKED_ANIMS;
  if(A&&A.pools.attack&&u.rig&&u.rig.torso&&!CLS[u.cls].mounted){u.attackAnimT=0.9;return;}
  if(!u.mixer||!u.actions||!u.actions.attack||!u.attackAnimDur)return;
  const a=u.actions.attack;
  if(u.curAction&&u.curAction!==a)u.curAction.fadeOut(0.08);
  a.reset().fadeIn(0.08).play();
  u.curAction=a;
  u.attackAnimT=u.attackAnimDur;
}
function setAction(u,name){
  if(!u.actions)return;
  const a=u.actions[name]||u.actions.idle;
  if(!a||a===u.curAction)return;
  if(u.curAction)u.curAction.fadeOut(0.15);
  a.reset().fadeIn(0.15).play();
  u.curAction=a;
}

// ---------- animation state machine ----------
function animateUnit(u,dt){
  const moving=u.moving; u.moving=false;

  if(u.mixer){ // real model: drive its clips
    if(u.attackAnimT>0){
      u.attackAnimT-=dt; // a strike is playing — let it land
    }else{
      const working=u.cls==="villager"&&!moving&&
        (u.gathering||(u.bot&&u.bot.node)||u.task||(u.isPlayer&&keys.e));
      if(working&&u.actions&&(u.actions.work||u.actions.attack))setAction(u,u.actions.work?"work":"attack");
      else if(moving)setAction(u,"walk");
      else setAction(u,"idle");
    }
    u.mixer.update(dt);
    return;
  }
  const R=u.rig; if(!R)return;
  const t=u.walkT;
  let ls=0,rs=0,al=0,ar=0,bob=0,lean=0;
  if(moving){
    ls=Math.sin(t)*0.72; rs=-ls;
    al=-ls*0.42; ar=ls*0.42;
    bob=Math.abs(Math.sin(t))*0.045;
    lean=0.09; // lean into the stride
  }else{ // idle breathing + sway
    al=Math.sin(T*1.6+u.id)*0.06; ar=-al;
    bob=Math.sin(T*2+u.id)*0.02;
  }
  // villagers chopping at a node or hammering a site
  const chopping=u.cls==="villager"&&!moving&&
    (u.gathering||(u.bot&&u.bot.node)||u.task||(u.isPlayer&&keys.e));
  if(chopping)ar=-1.6+Math.sin(T*7+u.id)*0.75;
  // melee swing: big overhead arc, weapon rides the arm.
  // the SPEAR LINE thrusts instead: the arm coils back, then drives the point forward
  if(u.swing>0){
    const k=Math.max(0,u.swing)/0.25;
    if(CLS[u.cls].line==="anticav"){
      const w=(k-0.5)/0.5;
      ar=k>0.5?0.9*w-1.2*(1-w):-1.2*(k/0.5); // +back at the coil, -forward at full extension
      lean=k>0.5?-0.08:0.2*(k/0.5);          // rock back, then lunge into it
    }else{
      ar=-2.35*k+0.55*(1-k);
      lean=0.16*(1-Math.abs(k*2-1));
    }
  }
  if(u.blocking){al=-1.3;lean=-0.12;}          // shield up
  if(u.isPlayer&&aiming){
    if(R.musketG){al=-1.35;ar=-1.15;}            // musket to the shoulder
    else{al=-1.5;ar=-1.3;}                       // bow drawn down the camera
  }
  let __baked=false;
  if(R.torso&&!u.blocking&&!(u.isPlayer&&aiming))
    __baked=applyBaked(u,R,dt,moving,chopping);
  if(R.torso&&!__baked){ // procedural fallback — and always for blocking/aiming/mounted
    let flL=0.32,flR=0.32;             // elbows carry a natural bend
    let shL=0.16,shR=0.16;             // knees never lock straight
    if(moving){ // knees flex through the forward swing — the actual mechanics of a stride
      shL=0.14+Math.max(0,Math.sin(t-1.9))*0.95;
      shR=0.14+Math.max(0,Math.sin(t-1.9+Math.PI))*0.95;
      flL=0.35+Math.max(0,al)*0.6;   flR=0.35+Math.max(0,ar)*0.6;
    }
    const chopping2=u.swing<=0&&Math.abs(ar+1.6)<0.9&&ar<-0.7; // mid-chop pose
    if(chopping2)flR=0.6;
    if(u.swing>0){const k=Math.max(0,u.swing)/0.25; flR=0.15+k*1.1;} // cock, then extend through the strike
    if(u.blocking)flL=1.05;                                          // shield braced across
    if(u.isPlayer&&aiming){
      if(R.musketG){flL=0.75;flR=0.45;}                              // left hand cradles the fore-stock
      else{flL=0.5;flR=0.55;}                                        // drawn to the cheek
    }
    const sitting=CLS[u.cls].mounted&&R.shinL;
    if(sitting){ ls=-1.0; rs=-1.0; shL=1.35; shR=1.35; }             // riders sit their mounts
    // full-axis writes: clear any twist left over from baked playback
    R.legL.rotation.set(ls,0,0); R.legR.rotation.set(rs,0,0);
    if(R.shinL){R.shinL.rotation.set(shL,0,0); R.shinR.rotation.set(shR,0,0);}
    R.armL.rotation.set(al,0,0); R.armR.rotation.set(ar,0,0);
    if(R.faL){R.faL.rotation.set(-flL,0,0); R.faR.rotation.set(-flR,0,0);}
    if(R.bowG)R.bowG.rotation.x=(u.isPlayer&&aiming)?2.0:0; // upright while the arm rises to draw
    // v131.28 …and the crossbow levels, which it never did. The chain is arm (-1.30) + forearm
    // (-0.55) = -1.85, and the stock's +Z is the muzzle, so +1.85 puts it dead level along the aim
    // ray; the camPitch term is the musket's, so the bow tracks the eye instead of sitting flat.
    // Left uncompensated it read at 74 degrees above horizontal and tipped 16 degrees BACK.
    if(R.xbowG)R.xbowG.rotation.x=(u.isPlayer&&aiming)
      ?1.85+((typeof camPitch!=="undefined"?camPitch:0.55)-0.55)*0.7:0;
    if(R.musketG){ // the gun never leaves the right hand
      const MG=R.musketG;
      if(u.isPlayer&&aiming){ // arm raised, gun shouldered and leveled with the eye
        R.armR.rotation.set(-1.2,-0.2,0);     R.faR.rotation.set(-0.35,0,0);
        R.armL.rotation.set(-1.25,0.45,-0.3); R.faL.rotation.set(-0.55,0,0);
        MG.position.set(0,-0.46,0.18);
        // chain compensation: arm (-1.2) + forearm (-0.35) tipped back level, then camera pitch
        MG.rotation.set(1.55+((typeof camPitch!=="undefined"?camPitch:0.55)-0.55)*0.7,0,0);
      }else{ // shouldered arms — the same pose the rig is built in, so nothing snaps on frame 1
        MG.position.set(NC_MUSKET_CARRY.x,NC_MUSKET_CARRY.y,NC_MUSKET_CARRY.z);
        MG.rotation.set(NC_MUSKET_CARRY.rx,NC_MUSKET_CARRY.ry,0); // ry as well, or the gun snaps on frame 1
      }
    }
    R.torso.position.y=u.rigBaseY+bob;
    const tt=(typeof T!=="undefined"?T:0)+u.id*1.7;
    if(moving){ // shoulders counter the stride; a touch of lateral sway
      const tw=Math.sin(u.walkT*1.15)*0.12;
      R.torso.rotation.set(0,tw,Math.sin(u.walkT*1.15)*0.03);
      R.head.rotation.set(0,-tw*0.5,0);
    }else{
      R.torso.rotation.x*=0.8; R.torso.rotation.y*=0.9; R.torso.rotation.z*=0.9;
      R.torso.position.y=u.rigBaseY+Math.sin(tt*1.5)*0.02;   // breathing
      if(!u.blocking&&!(u.isPlayer&&aiming))
        R.head.rotation.set(0,Math.sin(tt*0.35)*0.22,0);     // idle glances
    }
    u.body.rotation.x=lean;
  }
  if(R.horseLegs){
    if(R.horseLegs[0].userData&&R.horseLegs[0].userData.trot){ // v113 THE DRAUGHT TROT (ox, market mule)
      // Jointed like the destrier, but a harnessed animal never gallops: diagonal pairs swing
      // together (LF+RH, then RF+LH), knees fold on the recovery, and the body rocks a little
      // as the load shifts. Slower cadence and shallower reach than the war-horse.
      const tt2=t*1.15;
      for(let i=0;i<4;i++){
        const L=R.horseLegs[i], front=L.userData.front;
        const ph=tt2+((i===0||i===3)?0:Math.PI); // legs are [LF,RF,LH,RH] — 0 & 3 are one diagonal
        const tgtHip=moving?Math.sin(ph)*(front?0.5:0.44):0;
        L.rotation.x+=(tgtHip-L.rotation.x)*Math.min(1,dt*12);
        const kn=L.userData.knee;
        const flex=moving?Math.max(0,Math.sin(ph+Math.PI*0.4))*(front?0.5:0.62):0;
        kn.rotation.x+=(flex-kn.rotation.x)*Math.min(1,dt*12);
      }
      if(R.horseG){ // the plod: a shallow rise on each diagonal beat
        const bob=moving?Math.abs(Math.sin(tt2))*0.05:0;
        R.horseG.position.y+=(bob-R.horseG.position.y)*Math.min(1,dt*10);
      }
      if(R.horseNeck){ // the head nods into the collar as it pulls
        const nod=moving?0.06+Math.sin(tt2*2)*0.045:0;
        R.horseNeck.rotation.x+=(nod-R.horseNeck.rotation.x)*Math.min(1,dt*8);
      }
    }else if(R.horseLegs[0].userData&&R.horseLegs[0].userData.knee){ // the jointed destrier
      // THE FOUR-BEAT GALLOP (transverse, right lead): each hoof strikes alone —
      // beat 1 left hind, beat 2 right hind with the diagonal left fore close behind,
      // beat 3 the leading right fore, then the suspension when everything is airborne.
      const gt=t*1.5;
      const BEAT=[0.32,0.50,0.00,0.18]; // legs are [LF,RF,LH,RH] — footfall fraction of the stride
      for(let i=0;i<4;i++){
        const L=R.horseLegs[i], front=L.userData.front;
        const ph=gt-BEAT[i]*Math.PI*2;
        const tgtHip=moving?Math.sin(ph)*(front?0.78:0.68):0;
        L.rotation.x+=(tgtHip-L.rotation.x)*Math.min(1,dt*14);
        // the carpus folds on the recovery swing, snaps straight for the strike
        const flex=moving?Math.max(0,Math.sin(ph+Math.PI*0.45))*(front?0.95:1.2):0;
        const kn=L.userData.knee;
        kn.rotation.x+=(flex-kn.rotation.x)*Math.min(1,dt*14);
      }
      if(R.horseG){ // the suspension: a breath of air under all four hooves
        const bob=moving?Math.max(0,Math.sin(gt+Math.PI*1.35))*0.14:0;
        R.horseG.position.y+=(bob-R.horseG.position.y)*Math.min(1,dt*12);
      }
      if(R.horseNeck){ // the head reaches with the stride — subtle, or it looks like nodding
        const reach=moving?Math.sin(gt+Math.PI*0.55)*0.055:0;
        R.horseNeck.rotation.x+=(reach-R.horseNeck.rotation.x)*Math.min(1,dt*10);
      }
    }else{ // the cart mule keeps its old trot
      const g=moving?Math.sin(t*1.35)*0.8:0;
      R.horseLegs[0].rotation.x=g;  R.horseLegs[1].rotation.x=-g;
      R.horseLegs[2].rotation.x=-g; R.horseLegs[3].rotation.x=g;
    }
  }
  if(R.wheels)for(const w of R.wheels)if(moving)w.rotation.x+=dt*(w.userData.rr||7); // roll, don't twirl
  if(u.alive&&CLS[u.cls]&&CLS[u.cls].rig==="wolf"){ // the pounce: crouch back, spring forward
    if(u.swing>0){const k=1-u.swing/0.25; u.body.rotation.x=-0.4+k*0.55; u.body.position.y=Math.sin(k*Math.PI)*0.35;}
    else{u.body.rotation.x+=(0-u.body.rotation.x)*Math.min(1,dt*8); u.body.position.y+=(0-u.body.position.y)*Math.min(1,dt*8);}
  }
  if(R.barrel&&CLS[u.cls]&&CLS[u.cls].rig==="cannon"){ // the muzzle follows the gunner's eye
    let el=0.06;
    if(u.isPlayer&&aiming){
      const cd=new THREE.Vector3(); camera.getWorldDirection(cd);
      el=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(cd.y,-1,1)),-0.12,0.45);
    }
    // +x rotation LOWERS a +z muzzle, so the barrel takes the NEGATED angle
    R.barrel.rotation.x+=((-el)-R.barrel.rotation.x)*Math.min(1,dt*8);
  }
  if(R.gunSG){ // the gun leaps back on firing, then rolls home
    if(u._recoil>0)u._recoil-=dt;
    const rz=(u._recoil>0)?-0.5*(u._recoil/0.4):0;
    R.gunSG.position.z+=(rz-R.gunSG.position.z)*Math.min(1,dt*(u._recoil>0?22:4));
  }
  if(R.log){ // ram log swings forward on the strike
    if(u.swing>0)R.log.position.z=(1-u.swing/0.25)*1.1;
    else R.log.position.z+=(0-R.log.position.z)*Math.min(1,dt*5);
  }
  if(R.arm){ // throwing arm — the trebuchet heaves, the onager kicks
    const rest=(u.armRest===undefined?-1.15:u.armRest);
    if(u.cls==="trebuchet"){
      if(u.swing>0.2&&!u._trebGo){u._trebGo=1;u._trebT=0;} // the release
      if(u._trebGo){
        u._trebT+=dt;
        const k=Math.min(1,u._trebT/1.15);
        const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2; // heavy start, whip through, heavy settle
        R.arm.rotation.x=rest+e*1.9;
        if(k>=1)u._trebGo=0;
      }else R.arm.rotation.x+=(rest-R.arm.rotation.x)*Math.min(1,dt*0.8); // the slow winch home
    }
    else if(u.swing>0)R.arm.rotation.x=rest+(1-u.swing/0.25)*1.9;
    else R.arm.rotation.x+=(rest-R.arm.rotation.x)*Math.min(1,dt*2.5);
  }
  if(R.barrel){ // recoil
    if(u.swing>0)R.barrel.position.z=0.2-(1-u.swing/0.25)*0.35;
    else R.barrel.position.z+=(0.2-R.barrel.position.z)*Math.min(1,dt*4);
  }
}

function makeUnit(team,cls,x,z,opts){
  opts=opts||{};
  const root=new THREE.Group(); root.position.set(x,terrainHeight(x,z),z); scene.add(root);
  const body=new THREE.Group(); root.add(body);
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.85,1.15,16),
    new THREE.MeshBasicMaterial({color:opts.isPlayer?0xffffff:TEAMCOL[team],side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.06; root.add(ring);
  const u={id:UID++,team,cls,root,body,ring,alive:true,hp:1,maxHp:1,atkT:0,
    facing:0,carry:{food:0,gold:0,stone:0,wood:0},gathering:null,gatherT:0,buildT:0,
    isPlayer:!!opts.isPlayer,isKing:!!opts.isKing,name:opts.name||"Unit",
    bot:opts.bot||null,respawnT:0,walkT:0,convertGoal:null,rally:false,anchor:{x,z},corpse:false,
    scriptedCls:null,reconvertT:0,moving:false,dieT:0,blocking:false,task:null,
    convertTo:null,rigBaseY:1.2,attackAnimT:0,attackAnimDur:0};
  buildBodyFor(u);
  setClassStats(u);
  units.push(u); return u;
}
function restyleUnits(team,defer){ // villagers change wardrobe with the age, like the town does
  // v131.11 AND THE KING, WHO IS THE REASON THIS WAS A BUG. John: "the king outfit does not
  // currently change as city ages up." The §C ladder for him is all there — six crowns, six robes,
  // Tyrian purple at Classical, the team mantle at Medieval — and none of it ever rendered past the
  // age he spawned in, because this loop only ever re-dressed villagers.
  // Soldiers are deliberately NOT included: a soldier is built at the age he is trained in and
  // keeps that kit, which is both the cheaper behaviour and the readable one (an old spearman looks
  // old). The king is the one unit that is spawned once at match start and never respawns, so for
  // him "re-dress on age-up" is the ONLY path his own ladder has.
  for(const u of units){
    if(u.alive&&u.team===team&&(u.cls==="villager"||(CLS[u.cls]&&CLS[u.cls].rig==="king"))){
      if(defer)_restyleQ.push({kind:"u",u});
      else buildBodyFor(u);
    }
  }
}
function setClassStats(u){
  const d=CLS[u.cls];
  const b=ageBuff(u.team); // troops trained in later ages are hardier
  u.maxHp=Math.round(d.hp*b); u.hp=u.maxHp; u.spd=d.spd; u.dmg=d.dmg*b; u.rng=d.rng; u.cd=d.cd;
  u.ranged=!!d.ranged;
  if(u.buffs)applyBuffStats(u); // v87: blacksmith buffs ride on top of every class's base stats
  setBar(u.bar,1);
}
// v87: the STAT-model buffs (max HP, speed, attack cooldown) — event-time buffs
// (damage, crit, dodge, lifesteal…) apply at their callsites in dealDamage & co.
// Never touches rng: the garrison range boost stacks after this and must survive.
function applyBuffStats(u){
  const d=CLS[u.cls]; if(!d)return;
  const frac=u.maxHp>0?Math.max(0,Math.min(1,u.hp/u.maxHp)):1;
  u.maxHp=Math.round(d.hp*ageBuff(u.team)*(1+0.05*buffSt(u,"hp")));
  u.hp=Math.max(1,Math.round(u.maxHp*frac));
  u.spd=d.spd+0.5*buffSt(u,"spd");
  u.cd=Math.max(0.2,d.cd-0.1*buffSt(u,"atkspd"));
  if(u.bar)setBar(u.bar,u.hp/u.maxHp);
}
function setClass(u,cls){
  u.cls=cls; buildBodyFor(u); setClassStats(u);
  if(cls==="dragoon")u.ammo=6; // a fresh dragoon rides out with a loaded revolver
  u.gathering=null;
  if(u.isPlayer)updatePlayerHud();
}
function dist2(ax,az,bx,bz){const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz;}
function dist(a,b){return Math.sqrt(dist2(a.root.position.x,a.root.position.z,b.root.position.x,b.root.position.z));}

// ---- PRE-WARM: mint the head skin at boot, before anything can ask for it mid-game ----
// §G.4's rule is about the seeded window (02-world.js:190 → :1706) and the fact that `_blocks()`
// inside texturedMat calls Math.random(): a new (kind,hex) pair first minted inside that window
// shifts every resource-node index on the wire and forces PROTO off 26. ncHeadMat() deliberately
// makes no random call at all, so it cannot do that even if it were reached from inside — but the
// discipline is worth keeping visible, and there is a second reason that is not theoretical: the
// atlas allocates cells in FIRST-REQUEST order, and a cell whose position depends on which unit
// happens to spawn first is a cell whose position depends on AI timing. Mint it here, at parse
// time, which is already downstream of the handback (this file loads after 02-world.js).
try{ ncHeadMat(); }catch(_){}
// …and the trader's coat, for the same two reasons and one more. texturedMat("cloth",tc) is
// already in the cache the moment any archer, comparcher or Bronze/Classical villager exists —
// they all wear a cloth kilt in team colour — but the Trader is a MARKET PURCHASE and can be the
// first unit of its team on the field, so "somebody else will have minted it" is a guess about
// build order, which is the class of guess §G.4 exists to stop being made. Minting a CanvasTexture
// costs four Math.random() calls (THREE burns them on a uuid, and _tex restores the ambient stream
// before it constructs), so a first request that lands inside 02-world's seeded window walks every
// resource-node index on the wire and forces PROTO off 26. One line, at parse time, and the
// question never has to be asked again. Both live teams; the neutral grey never trades.
try{ for(const t of [0,1])texturedMat("cloth",TEAMCOL[t]); }catch(_){}
