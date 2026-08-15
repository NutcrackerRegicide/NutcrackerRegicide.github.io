#!/usr/bin/env node
/* patch-fx-hooks.js — v132.41: hang the eleven set-pieces on their moments.
 *
 * Each one replaces or joins the single coloured puff that stood in for it. The puffs that were
 * doing useful work are KEPT and the set-piece rides on top — a slam should still throw its dust
 * mote as well as its shockwave; two marks at one instant read as one richer event, not as two.
 *
 * ── WHAT IS DELIBERATELY LEFT ALONE ─────────────────────────────────────────────────────────
 * Nine buffs still get nothing, and that is the recommendation from the worksheet rather than an
 * omission: Deep Gash, Bloodthirst, Blood Tax, Hunter's Step and Bramble Mail all fire on EVERY
 * blow, so an effect there fires as often as the impact already does and simply thickens it.
 * Frequency is the budget.
 *
 * ⚠ THE DODGE HOOK GOES BEFORE THE `return`. dealDamage bails out on a dodge — that is the whole
 * mechanic — so anything placed after it never runs. Same trap the dodge SOUND hit in v132.38.
 *
 * ⚠ THE VOLLEY HOOK SITS INSIDE THE _volleyIn GUARD. Without that the three streaks would each
 * re-enter and draw three more.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","05-combat.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}
const VP="victim.root.position", AP="attU.root.position";

sub("EARTHSHAKER — the radius made visible",
`      puff(px,0.6,pz,0xc9a06a,2.2);
      _sfxAt("quakeslam",attU);`,
`      puff(px,0.6,pz,0xc9a06a,2.2);
      _vfx(VFX_QUAKE,px,pz,Math.round(R*10),0);   // v132.41: the shockwave carries the RADIUS —
      _sfxAt("quakeslam",attU);                   // nobody could tell what it reached before`);

sub("KEEN EYE — a spike burst, not a bigger flash",
`      m*=2; puff(${VP}.x,2.4,${VP}.z,0xffd24a,1.1);
      _sfxAt("critstrike",victim);`,
`      m*=2; puff(${VP}.x,2.4,${VP}.z,0xffd24a,1.1);
      _vfx(VFX_CRIT,${VP}.x,${VP}.z,0,0);         // v132.41: sharp and quick — at 3 stacks this
      _sfxAt("critstrike",victim);                // rides ~15% of blows`);

sub("SIXTH SENSE — before the return",
`      puff(${VP}.x,1.6,${VP}.z,0x9fd8ff);
      _sfxAt("dodgeswish",victim);`,
`      puff(${VP}.x,1.6,${VP}.z,0x9fd8ff);
      // ⚠ BEFORE the return below — dealDamage bails on a dodge, so anything after never runs
      _vfx(VFX_DODGE,${VP}.x,${VP}.z,Math.round((victim.facing||0)*100),0);
      _sfxAt("dodgeswish",victim);`);

sub("ARROW WARD — a facet, angled at the archer",
`        puff(${VP}.x,2.2,${VP}.z,0x9fd8ff,1.0);
        _sfxAt("wardblock",victim);`,
`        puff(${VP}.x,2.2,${VP}.z,0x9fd8ff,1.0);
        _vfx(VFX_WARD,${VP}.x,${VP}.z,Math.round(_fxAng(att,victim)*100),0);
        _sfxAt("wardblock",victim);`);

sub("IRON GUARD — the same facet in steel",
`        puff(${VP}.x,2.2,${VP}.z,0xd8dde2,1.0);
        _sfxAt("guardblock",victim);`,
`        puff(${VP}.x,2.2,${VP}.z,0xd8dde2,1.0);
        _vfx(VFX_GUARD,${VP}.x,${VP}.z,Math.round(_fxAng(att,victim)*100),0);
        _sfxAt("guardblock",victim);`);

sub("RAPID VOLLEY — three streaks on the three twangs",
`      _volleyIn=false;
      _sfxAt("volleyshot",attU);`,
`      _volleyIn=false;
      _vfx(VFX_VOLLEY,${AP}.x,${AP}.z,                  // v132.41: three streaks, staggered onto
        Math.round(${VP}.x*10),Math.round(${VP}.z*10)); // the three twangs already in the sound
      _sfxAt("volleyshot",attU);`);

sub("CULLER — one hard white flash",
`    puff(${VP}.x,1.8,${VP}.z,0xd8e070,1.2);
    _sfxAt("cullkill",victim);`,
`    puff(${VP}.x,1.8,${VP}.z,0xd8e070,1.2);
    _vfx(VFX_CULL,${VP}.x,${VP}.z,0,0);
    _sfxAt("cullkill",victim);`);

sub("SERRATED EDGE — a mark that lingers as long as the bleed",
`      puff(${VP}.x,2.0,${VP}.z,0xb3262a,0.7);
      _sfxAt("bleedhit",victim);`,
`      puff(${VP}.x,2.0,${VP}.z,0xb3262a,0.7);
      _vfx(VFX_BLEED,${VP}.x,${VP}.z,6,0);  // drips while it bleeds — you can see who is dying
      _sfxAt("bleedhit",victim);`);

sub("VENOMOUS — the same idea in green",
`      puff(${VP}.x,2.0,${VP}.z,0x8fd45a,0.8);
      _sfxAt("venomhit",victim);`,
`      puff(${VP}.x,2.0,${VP}.z,0x8fd45a,0.8);
      _vfx(VFX_VENOM,${VP}.x,${VP}.z,5,0);
      _sfxAt("venomhit",victim);`);

sub("CONCUSSIVE BLOW — the orbit IS the stun timer",
`      puff(${VP}.x,2.8,${VP}.z,0xffe9a8,1.1);
      _sfxAt("stunhit",victim);`,
`      puff(${VP}.x,2.8,${VP}.z,0xffe9a8,1.1);
      _vfx(VFX_STUN,${VP}.x,${VP}.z,15,0);  // 1.5s — the same clock tmodAdd just set above
      _sfxAt("stunhit",victim);`);

sub("SHRUG IT OFF — the debuffs shatter",
`      _sfxAt("shrugoff",victim);`,
`      _vfx(VFX_SHRUG,${VP}.x,${VP}.z,0,0);
      _sfxAt("shrugoff",victim);`);

sub("the angle helper",
`function _vfx(kind,x,z,p,q){`,
`// the bearing from whoever swung to whoever was hit, so a facet faces the blow it stopped
function _fxAng(att,victim){
  if(!att||!att.root||!victim||!victim.root)return 0;
  return Math.atan2(att.root.position.x-victim.root.position.x,
                    att.root.position.z-victim.root.position.z);
}
function _vfx(kind,x,z,p,q){`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — eleven set-pieces on their moments");
