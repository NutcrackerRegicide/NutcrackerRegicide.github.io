#!/usr/bin/env node
/* patch-fx-knife.js — v132.44: the one recommendation I made and never built.
 *
 * ── THE GAP, AND WHOSE IT IS ────────────────────────────────────────────────────────────────
 * The worksheet says of KNIFE FIGHTER: "make it an actual small knife mesh that travels and
 * sticks — it is the only buff whose fiction is a thrown object, and the current three-puff dotted
 * line is a placeholder standing in for exactly that. If not, tighten the puff line to five
 * smaller, faster dots so it at least reads as travel."
 *   I deferred the real projectile, which was right — it needs a projectile kind, a mesh, a travel
 * path and lag compensation, and that was a Batch F when I first said so. Then I never did the
 * cheap fallback either, and declared the worksheet complete twice. An audit against the source
 * found it; my memory did not.
 *
 * ── BETTER THAN EITHER THING I OFFERED, AND CHEAPER THAN ONE OF THEM ────────────────────────
 * v132.41's fxs() carries velocity, which neither option assumed. So the knife FLIES: one pooled
 * sprite launched from the thrower along the bearing to its mark, covering the distance in the
 * time a thrown knife should take, with two small trailing motes behind it. That reads as a
 * thrown weapon rather than as three things happening in a row — which was the real complaint —
 * and it needs no projectile kind, no collision and no lag compensation, because the damage was
 * already resolved instantly and still is. The visual is honest about that: it is a knife you
 * SEE thrown, not a knife whose flight decides anything.
 *
 * ⚠ AND IT GOES ON THE WIRE. knifeTick is driven from the host unit loop, so the old puffs drew on
 * the host and nowhere else — the same trap as everything else born on that side. Kind 13 carries
 * the destination in the two spare fields, exactly as RAPID VOLLEY already does.
 *
 * PROTO 44 → 45.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={comb:path.join(__dirname,"..","js","05-combat.js"),
         net:path.join(__dirname,"..","js","10-net.js")};
const c={o:fs.readFileSync(P.comb,"utf8")}, n={o:fs.readFileSync(P.net,"utf8")};
const subC=mk(c), subN=mk(n);

subN("PROTO 45",
`  PROTO:44,             // v132.43 public timed modifiers (s.tm) — the other half of "a client`,
`  PROTO:45,             // v132.44 the thrown-knife kind. Was:
                        // v132.43 public timed modifiers (s.tm) — the other half of "a client`);

subC("the knife kind",
`      VFX_FEAST=12;   // v132.42 SECOND WIND`,
`      VFX_FEAST=12,   // v132.42 SECOND WIND
      VFX_KNIFE=13;   // v132.44 KNIFE FIGHTER — the only buff whose fiction is a thrown object`);

subC("the knife renderer",
`    case VFX_STUN: {           // CONCUSSIVE BLOW — sparks ORBITING for the stun's own duration,`,
`    case VFX_KNIFE: {          // KNIFE FIGHTER — it FLIES. One pooled sprite along the bearing to
      const tx=p/10, tz=q/10;  // its mark, plus two motes trailing. No projectile kind, no
      const dx=tx-x, dz=tz-z;  // collision, no lag compensation: the damage resolved instantly
      const d=Math.hypot(dx,dz)||0.001;              // and still does. This is a knife you SEE
      const life=Math.min(0.34,0.055+d*0.019);       // thrown, not one whose flight decides
      fxs(x,gy+1.7,z,0xe8e4d8,0.34,life,dx/d*(d/life),0.55,dz/d*(d/life),1.2,1,0.95);
      for(let i=1;i<=2;i++)                          // …and a little of the air it left behind
        fxs(x+dx*(i*0.13),gy+1.7,z+dz*(i*0.13),0xd8dde2,0.20,life*0.55,
            dx/d*(d/life)*0.6,0.3,dz/d*(d/life)*0.6,0.8,0.85,0.5);
      break; }
    case VFX_STUN: {           // CONCUSSIVE BLOW — sparks ORBITING for the stun's own duration,`);

subC("throw it instead of dotting it",
`  for(let k=1;k<=3;k++)                                   // a line of puffs stands in for the flight
    puff(px+(best.root.position.x-px)*k/4,1.6,pz+(best.root.position.z-pz)*k/4,0xd8dde2,0.35);
  _sfxAt("knifethrow",u);`,
`  // v132.44: it FLIES now. The three static puffs read as three separate things happening rather
  // than as one thing travelling — which was the whole complaint in the worksheet. And it goes on
  // the wire: knifeTick runs in the host unit loop, so the old dots drew on the host alone.
  _vfx(VFX_KNIFE,px,pz,Math.round(best.root.position.x*10),Math.round(best.root.position.z*10));
  _sfxAt("knifethrow",u);`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.comb,c.o); fs.writeFileSync(P.net,n.o);
console.log("patched — the knife flies, and reaches guests. PROTO 45.");
