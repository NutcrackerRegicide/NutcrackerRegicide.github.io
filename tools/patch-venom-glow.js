#!/usr/bin/env node
/* patch-venom-glow.js — v132.47: John's playtest, item 2. "venomous should cause a slightly green
 * glow on your weapon".
 *
 * ── WHY IT IS NOT PARENTED TO THE WEAPON ────────────────────────────────────────────────────
 * The obvious build is to attach a glow to the weapon mesh. That mesh lives under u.body, and
 * u.body is emptied and its geometry DISPOSED on every unit rebuild (04-units.js ~2240) — a
 * restyle, an age-up, a class change. Anything parented there is destroyed without warning, and
 * the effect would work until the first time the unit was rebuilt and then silently never again.
 * Invariant #9 exists because of exactly this.
 *   So it rides the v132.42 pooled-look pass instead: positioned at the weapon HAND each frame,
 * owned by nothing, and cleaned up by the same hide-all-then-re-arm rule as everything else there.
 *
 * ── WHERE THE HAND IS ───────────────────────────────────────────────────────────────────────
 * Offset along the unit's facing and out to its right — the same convention the swing puffs and
 * the muzzle flash already use for "where the weapon is". Slightly forward, slightly out, at
 * chest height. It tracks the facing, so it reads as being ON the weapon while never touching it.
 *
 * ── "SLIGHTLY" IS THE WHOLE BRIEF ───────────────────────────────────────────────────────────
 * John asked for a slight glow, so it is one small sprite at low opacity with a gentle breath —
 * not a torch. It says "this blade is treated" at a glance and does not compete with the level
 * aura, which is the thing on a unit that must always read.
 *
 * ⚠ It marks the HOLDER of VENOMOUS, not a poisoned victim. The victim already gets the green
 * puff, the drips for the duration and the venom cue.
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

sub("a look positioned in the world, not just above the head",
`function _lookAt(u,yOff,col,size,op){`,
`// v132.47: a look at an OFFSET from the unit rather than straight above it — the venom glow sits
// where the weapon hand is, which means tracking the facing.
function _lookAtOff(u,fwd,side,yOff,col,size,op){
  const f=u.facing||0;
  const fx=Math.sin(f), fz=Math.cos(f);
  _lookRaw(u.root.position.x+fx*fwd+fz*side,
           u.root.position.y+yOff,
           u.root.position.z+fz*fwd-fx*side,col,size,op);
}
function _lookAt(u,yOff,col,size,op){`);

sub("split the raw placement out",
`  m.visible=true; m.material.color.setHex(col); m.material.opacity=op;
  m.scale.set(size,size,1);
  m.position.set(u.root.position.x,u.root.position.y+yOff,u.root.position.z);
  _lookOn++;
}`,
`  m.visible=true; m.material.color.setHex(col); m.material.opacity=op;
  m.scale.set(size,size,1);
  m.position.set(u.root.position.x,u.root.position.y+yOff,u.root.position.z);
  _lookOn++;
}
function _lookRaw(x,y,z,col,size,op){
  if(!_lookPool)_lookPool=[];
  let m=null;
  for(const q of _lookPool)if(!q.visible){m=q;break;}
  if(!m){ m=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff,transparent:true,
    opacity:1,depthWrite:false})); scene.add(m); _lookPool.push(m); }
  m.visible=true; m.material.color.setHex(col); m.material.opacity=op;
  m.scale.set(size,size,1); m.position.set(x,y,z);
  _lookOn++;
}`);

sub("the venom glow",
`    const rg=buffSt(u,"regen");                            // SECOND SKIN — one mote every two`,
`    // v132.47 VENOMOUS — a slight green glow on the weapon. ⚠ NOT parented to the weapon mesh:
    // that lives under u.body, which is emptied and geometry-disposed on every rebuild, so an
    // attachment there works until the first restyle and then silently never again (invariant #9).
    // Positioned at the hand each frame instead — forward and out to the right, at chest height,
    // tracking the facing so it reads as being ON the blade while owning nothing.
    if(buffSt(u,"venom"))
      _lookAtOff(u,0.55,0.45,1.55,0x8fd45a,0.42,0.30+0.10*Math.sin(t*3.1));
    const rg=buffSt(u,"regen");                            // SECOND SKIN — one mote every two`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — the venom glow rides the hand, not the mesh");
