#!/usr/bin/env node
/* patch-fx-shapes.js — v132.45: they were all squares. John asked whether the knife looks like a knife.
 *
 * ── THE HONEST ANSWER WAS NO ────────────────────────────────────────────────────────────────
 * fxs() builds a THREE.Sprite with a SpriteMaterial and no `map`. An untextured sprite renders as
 * a SOLID CAMERA-FACING SQUARE. So the v132.44 "thrown knife" is a pale square travelling through
 * the air with two smaller squares behind it — and I wrote "a knife you SEE thrown" in that
 * patch's own header, which was not true. It travels, which was the actual fix; it does not look
 * like anything.
 *   Nor does anything else. Every drip, shard, spark, mote and spike added since v132.41 is a
 * square, and puff() — the game's original primitive — has always been one too.
 *
 * ── THREE PROCEDURAL TEXTURES, BUILT THE WAY THE AURA ALREADY DOES IT ───────────────────────
 * _auraDot() builds a DataTexture from raw bytes with the note "canvas is stubbed in the harness",
 * which is the pattern and the reason for it. Three more, same technique:
 *     SOFT    a round falloff. The DEFAULT for every particle, so drips, shards, motes and sparks
 *             all stop being squares without a single call site changing.
 *     BLADE   a knife: point, edge, guard, grip. Only useful because a sprite can be ROTATED —
 *             r128's SpriteMaterial.rotation is screen-space radians — so it can point where it
 *             is going and tumble on the way, which is what makes it read as thrown rather than
 *             as an object sliding sideways.
 *     SLIVER  a tapered shard for KEEN EYE's spike burst, rotated radially. The worksheet called
 *             that a "spike burst" and eight squares are not spikes.
 *
 * ⚠ THE MAP IS SET AT CREATION, NOT ON USE. Going from no-map to map changes a material's shader
 * defines and forces a program recompile; swapping one texture for another of the same format is
 * a uniform change. So every pooled sprite is born with the soft dot and only ever swaps.
 *
 * ⚠ AND THE TEXTURES ARE LAZY. Three DataTextures at load would sit inside the seeded world-gen
 * window, and in r128 a texture mints a uuid like everything else — four random draws, and every
 * tree on the map moves (invariant #2).
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

sub("the three textures",
`let _fxsPool=null,_fxsGeo=null,_fxsNext=0;`,
`let _fxsPool=null,_fxsGeo=null,_fxsNext=0;
// v132.45 THE SHAPES. Raw-byte DataTextures, the same way _auraDot does it and for the same
// reason: canvas is stubbed in the headless harness. Built LAZILY — three textures at load would
// each mint a uuid inside the seeded window and move every tree on the map (invariant #2).
let _texSoft=null,_texBlade=null,_texSliver=null;
function _mkTex(w,h,fn){
  const d=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const a=Math.max(0,Math.min(1,fn((x+0.5)/w,(y+0.5)/h)));
    const i=(y*w+x)*4; d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=Math.round(255*a);
  }
  const t=new THREE.DataTexture(d,w,h,THREE.RGBAFormat); t.needsUpdate=true; return t;
}
function _texBuild(){
  if(_texSoft)return;
  // a round falloff — what a mote, a drip, a shard or a spark should look like
  _texSoft=_mkTex(16,16,(u,v)=>{const r=Math.hypot(u-0.5,v-0.5)*2; const a=1-r; return a*a;});
  // A KNIFE, pointing along +u. Proportions matter more than resolution here: the first cut had a
  // guard nearly as tall as the image and a blade 62% of the height, which rendered as a cleaver.
  // A knife is mostly THIN — a slim grip, a guard barely wider than it, and a long narrow blade
  // that carries a slight belly before the point. 48px of length so the taper is smooth rather
  // than stepped; the alpha is anti-aliased at the edge for the same reason.
  _texBlade=_mkTex(48,16,(u,v)=>{
    const dy=Math.abs(v-0.5)*2;                        // 0 at the spine, 1 at the edges
    const edge=(w)=>Math.max(0,Math.min(1,(w-dy)*7));  // soft edge instead of a hard step
    if(u>=0.34){                                       // the blade: a belly, then a point
      const t=(u-0.34)/0.66;                           // 0 at the guard, 1 at the tip
      const w=0.40*Math.sqrt(Math.max(0,1-t*t))*(1-0.15*t);
      return edge(w);
    }
    if(u>=0.28)return edge(0.62);                      // the guard — wider than the grip, no more
    if(u>=0.03)return edge(0.20);                      // a slim grip
    return 0;
  });
  // A SHARD for the crit burst, pointing along +u. Concave sides so it reads as a splinter of
  // light rather than as a triangle.
  _texSliver=_mkTex(32,8,(u,v)=>{
    const dy=Math.abs(v-0.5)*2;
    const w=0.92*Math.pow(1-u,1.6);
    return Math.max(0,Math.min(1,(w-dy)*9));
  });
}`);

sub("every sprite is born with a map",
`    const m=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff,transparent:true,opacity:1,
      depthWrite:false}));
    scene.add(m); _fxsPool.push(m); return m;`,
`    // ⚠ BORN WITH A MAP. no-map → map changes the shader defines and forces a recompile; texture
    // → texture is a uniform swap. So it starts with the soft dot and only ever exchanges it.
    const m=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff,transparent:true,opacity:1,
      depthWrite:false,map:_texSoft}));
    scene.add(m); _fxsPool.push(m); return m;`);

sub("build the textures with the pools",
`  _fxsPool=[]; _hexPool=[]; _xringPool=[];`,
`  _texBuild();
  _fxsPool=[]; _hexPool=[]; _xringPool=[];`);

sub("fxs takes a shape and a spin",
`function fxs(x,y,z,col,size,life,vx,vy,vz,g,grow,fade0){
  if(typeof scene==="undefined"||typeof THREE==="undefined")return null;
  _fxBuild();
  const m=_fxsTake(); m.visible=true;
  m.position.set(x,y,z); m.scale.set(size,size,1);
  m.material.color.setHex(col); m.material.opacity=(fade0===undefined?1:fade0);
  const e={m,t:life,dur:life,vx:vx||0,vy:vy||0,vz:vz||0,g:g||0,grow:(grow===undefined?1:grow),
    op0:(fade0===undefined?1:fade0),kind:"s"};
  _fxLive.push(e); return e;
}`,
`// opts: {tex:"blade"|"sliver", rot:radians, spin:rad/s, ar:aspect}. Everything without opts gets
// the soft dot, which is why drips, shards, motes and sparks all improved without a call site
// changing. Shape only matters where the thing is meant to be recognisable.
function fxs(x,y,z,col,size,life,vx,vy,vz,g,grow,fade0,opts){
  if(typeof scene==="undefined"||typeof THREE==="undefined")return null;
  _fxBuild();
  const m=_fxsTake(); m.visible=true;
  const o=opts||{};
  m.material.map=(o.tex==="blade")?_texBlade:(o.tex==="sliver")?_texSliver:_texSoft;
  m.material.rotation=o.rot||0;
  m.position.set(x,y,z);
  const ar=o.ar||1;                                    // a blade is longer than it is wide
  m.scale.set(size*ar,size,1);
  m.material.color.setHex(col); m.material.opacity=(fade0===undefined?1:fade0);
  const e={m,t:life,dur:life,vx:vx||0,vy:vy||0,vz:vz||0,g:g||0,grow:(grow===undefined?1:grow),
    op0:(fade0===undefined?1:fade0),kind:"s",spin:o.spin||0};
  _fxLive.push(e); return e;
}`);

sub("tumble it as it flies",
`      if(e.grow!==1)e.m.scale.multiplyScalar(1+(e.grow-1)*dt);
      e.m.material.opacity=e.op0*k;`,
`      if(e.grow!==1)e.m.scale.multiplyScalar(1+(e.grow-1)*dt);
      if(e.spin)e.m.material.rotation+=e.spin*dt;      // a thrown knife tumbles
      e.m.material.opacity=e.op0*k;`);

// ---- the two effects where shape carries the meaning ----
sub("the knife looks like a knife",
`      fxs(x,gy+1.7,z,0xe8e4d8,0.34,life,dx/d*(d/life),0.55,dz/d*(d/life),1.2,1,0.95);`,
`      // v132.45: a BLADE, pointed along its travel and tumbling. Sprite rotation is screen-space,
      // so the bearing is taken in screen terms — good enough at this speed and this size, and it
      // is what turns "a thing sliding sideways" into "a thing thrown".
      fxs(x,gy+1.7,z,0xe8e4d8,0.30,life,dx/d*(d/life),0.55,dz/d*(d/life),1.2,1,0.95,
          {tex:"blade",ar:2.0,rot:Math.atan2(dz,dx),spin:11});`);

sub("the spikes look like spikes",
`        fxs(x,gy+2.4,z,0xfff4d0,0.30,0.19,Math.cos(a)*13,1.2,Math.sin(a)*13,0,0.55,1);}`,
`        fxs(x,gy+2.4,z,0xfff4d0,0.26,0.19,Math.cos(a)*13,1.2,Math.sin(a)*13,0,0.55,1,
            {tex:"sliver",ar:2.4,rot:a});}   // v132.45: the worksheet said SPIKE burst, and eight
                                             // squares are not spikes`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — the particles have shapes");
