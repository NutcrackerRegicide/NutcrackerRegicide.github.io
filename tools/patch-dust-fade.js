#!/usr/bin/env node
/* v132.52 — THE AMBIENT DUST, FOURTH TIME, AND THIS TIME THE CAUSE.
   John has reported this layer four times now: v130.1 ("confetti scattered across the distance"),
   v130.2 ("they were STILL confetti"), v131.11 ("can we tone down the sparkly ambient floater
   things?") and now — as a line of glowing dots hanging in the fog that follows the road and
   never goes away. He reasonably read it as his level aura lingering. It is not: hiding dustPts
   removes it, and every particle pool reads empty while it is on screen.

   WHY THE FIRST THREE FIXES COULD NOT WORK. All three moved COUNT and OPACITY. The reason a far
   mote stays bright is neither. Two mechanisms, both of which survive dimming:
     · r128 fogs a Points material by mixing its colour TOWARD fog.color. Under ADDITIVE blending
       that means a distant mote adds FOG-COLOURED LIGHT ON TOP OF THE FOG — the further away it
       is, the more of the fog's own brightness it contributes. Fog makes them worse, not fainter.
     · the box RIDES THE CAMERA, so a mote never moves relative to the eye. The far ones sit at a
       fixed screen position in the horizon band, frame after frame, which is exactly why they
       read as a trail that follows the road: the road recedes to that same spot whichever road
       you are on.
   So the fix is not fewer motes. It is that a mote must be WORTH ZERO at distance, and must not
   be handed the fog's brightness on the way. Because the field rides the camera, each mote's
   distance from the eye is CONSTANT — so the fade is baked once at build time and costs nothing
   per frame. */
const fs=require('fs'),path=require('path');
const F=path.join(__dirname,'..','js/01-engine.js');
let s=fs.readFileSync(F,'utf8');
const old=`  const DUST_N=110, DUST_BOX=48, DUST_LOW=0.5, DUST_HIGH=4.2;
  const N=DUST_N, pos=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    pos[i*3]=(Math.random()*2-1)*DUST_BOX;
    pos[i*3+1]=DUST_LOW+Math.random()*(DUST_HIGH-DUST_LOW);
    pos[i*3+2]=(Math.random()*2-1)*DUST_BOX;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));`;
const nw=`  // v132.52 THE NUMBERS THAT MATTER ARE THE LAST TWO. Count and box shrink together so the
  // NEAR-FIELD DENSITY IS UNCHANGED — roughly two dozen motes within twenty units, which is what
  // v131.11 settled on and what the layer is for. What is new is that a mote is faded to nothing
  // before it can reach the horizon band at all.
  const DUST_N=32, DUST_BOX=24, DUST_LOW=0.5, DUST_HIGH=4.2,
        DUST_FULL=10,      // full strength within this radius of the eye
        DUST_GONE=24;      // and worth exactly zero beyond it — not dim, ZERO
  const N=DUST_N, pos=new Float32Array(N*3), col=new Float32Array(N*3);
  const cr=1.0, cg=0.878, cb=0.627;             // 0xffe0a0, now carried per-vertex
  for(let i=0;i<N;i++){
    pos[i*3]=(Math.random()*2-1)*DUST_BOX;
    pos[i*3+1]=DUST_LOW+Math.random()*(DUST_HIGH-DUST_LOW);
    pos[i*3+2]=(Math.random()*2-1)*DUST_BOX;
    // BAKED ONCE, and it is allowed to be baked because the field rides the camera: a mote's
    // distance from the eye never changes, so this is not an approximation of a per-frame fade,
    // it IS the per-frame fade with the loop lifted out. Squared, so the falloff is gentle where
    // the motes do their job and steep where they would otherwise become specks in the fog.
    const r=Math.hypot(pos[i*3],pos[i*3+2]);
    let f=(DUST_GONE-r)/(DUST_GONE-DUST_FULL);
    f=f<0?0:(f>1?1:f); f*=f;
    col[i*3]=cr*f; col[i*3+1]=cg*f; col[i*3+2]=cb*f;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.BufferAttribute(col,3));`;
if(s.split(old).length-1!==1){console.error('ABORT: dust build anchor not unique');process.exit(1);}
s=s.replace(old,nw);
const oldm=`  dustPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xffe0a0,size:0.26,transparent:true,
    opacity:0.10,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));`;
const nwm=`  // fog:false IS THE OTHER HALF OF THE FIX AND THE HALF THAT WAS NEVER TRIED. r128 fogs a Points
  // material by lerping its colour toward fog.color; under AdditiveBlending a fogged mote therefore
  // ADDS the fog's own brightness to the fog, and the further away it is the more it adds. That is
  // the mechanism behind every "confetti in the distance" report since v130.1, and no amount of
  // opacity can beat it — the fog was supplying the light, not the mote.
  dustPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:0.26,transparent:true,
    opacity:0.10,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true,
    vertexColors:true,fog:false}));`;
if(s.split(oldm).length-1!==1){console.error('ABORT: dust material anchor not unique');process.exit(1);}
s=s.replace(oldm,nwm);
fs.writeFileSync(F,s);
console.log('  ok  01-engine: dust faded to zero by distance, per-vertex, and fog:false');
