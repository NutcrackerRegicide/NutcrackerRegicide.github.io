#!/usr/bin/env node
/* v132.52 — THE MOTES WERE NOT SWIRLING, THEY WERE WALKING AWAY.
   renderFrame's "living atmosphere" block ADDED a cosine to each mote's position every frame:
       a.array[i*3]+=Math.cos(tt*0.5+i*1.7)*0.006;
   Adding a wave to a position is not oscillation, it is INTEGRATION. The sign only flips on the
   wave's half period (~6.3s at 0.5 rad/s), so a mote travels in one direction for hundreds of
   frames before turning round — a random walk with a slow leash, not a swirl. The layer's whole
   premise is a box that rides the camera, and its members were quietly leaving that box.
   Found by the v132.52 far-field gate, which read a lit mote 110 units out where the box is 24.
   Also fixes the loop, whose comment claims it updates "a third per frame": `i+=3` steps the
   INDEX, so it moves motes 0,3,6,… every frame and the other two thirds never move at all.
   Thirty-two motes cost nothing to move properly. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const wr=(f,s)=>fs.writeFileSync(path.join(ROOT,f),s);
let edits=0;
function sub(file,find,repl,label){
  const src=rd(file); const n=src.split(find).length-1;
  if(n!==1){console.error('ABORT ['+label+'] matched '+n+' times, expected 1');process.exit(1);}
  wr(file,src.replace(find,repl)); edits++; console.log('  ok  '+label);
}

/* keep the pristine positions so the swirl is an OFFSET, never an accumulation */
sub('js/01-engine.js',
`  g.setAttribute("color",new THREE.BufferAttribute(col,3));`,
`  g.setAttribute("color",new THREE.BufferAttribute(col,3));
  // v132.52 THE BASE POSITIONS, KEPT. The swirl in 09-main.js used to add itself into the live
  // array, so the motes integrated their own animation and wandered out of the box. Holding the
  // originals turns that into an offset, which is what it always meant to be — and it is what
  // lets the per-vertex fade above stay honest, since a mote's radius no longer drifts.
  dustBase=pos.slice();`,
'01-engine: keep the dust base positions');

sub('js/01-engine.js',
`let dustPts=null;`,
`let dustPts=null, dustBase=null;`,
'01-engine: dustBase declaration');

sub('js/09-main.js',
`  if(dustPts){
    const a=dustPts.geometry.attributes.position, tt=clock.elapsedTime;
    for(let i=0;i<a.count;i+=3){ // update a third per frame — plenty at mote speed
      a.array[i*3+1]+=Math.sin(tt*0.8+i)*0.004;
      a.array[i*3]+=Math.cos(tt*0.5+i*1.7)*0.006;
    }
    a.needsUpdate=true;
  }`,
`  if(dustPts&&dustBase){
    // v132.52 AN OFFSET FROM THE BASE, NOT AN ADDITION TO THE POSITION. See tools/patch-dust-drift.js:
    // the old form integrated a cosine into the live array, so a mote drifted for a whole half
    // period before turning round and left the camera box entirely. The amplitudes below are the
    // TOTAL excursion now, where before they were a speed. Every mote moves, every frame: there
    // are thirty-two of them, and the old "i+=3" moved the same third forever while claiming to
    // rotate through them.
    const a=dustPts.geometry.attributes.position, tt=clock.elapsedTime;
    for(let i=0;i<a.count;i++){
      a.array[i*3]  =dustBase[i*3]  +Math.cos(tt*0.5+i*1.7)*0.35;
      a.array[i*3+1]=dustBase[i*3+1]+Math.sin(tt*0.8+i)*0.22;
      a.array[i*3+2]=dustBase[i*3+2];
    }
    a.needsUpdate=true;
  }`,
'09-main: the swirl is an offset from the base');

console.log('v132.52 dust-drift: '+edits+' edits applied');
