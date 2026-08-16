#!/usr/bin/env node
/* v132.52 gates for the ambient dust — the layer John has now reported four times and which,
   until this file, had NO coverage at all. That is the whole story of the three failed fixes:
   nothing measured the far field, so "toned down" was only ever a judgement made on one screen.
   These gates measure the artefact itself (the built geometry), not the constants that made it. */
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

sub('tools/smoketest.js',
`auraLive,AURA_LEASH,AURA_LEASH_Y,puff,fxEffects:()=>effects,`,
`auraLive,AURA_LEASH,AURA_LEASH_Y,puff,fxEffects:()=>effects,dustPts:()=>dustPts,`,
'smoketest: export the dust layer');

sub('tools/smoketest.js',
`  check("v116 touch: the mobile layer is a no-op outside a browser",`,
`  // ---------- v132.52: THE AMBIENT DUST MUST NOT REACH THE HORIZON ----------
  // John, four times: v130.1 "confetti scattered across the distance", v130.2 "STILL confetti",
  // v131.11 "tone down the sparkly ambient floater things", and v132.51 a line of glowing dots
  // hanging in the fog which he reasonably took for his own level aura. Three fixes moved COUNT
  // and OPACITY; none could work, because the brightness of a far mote comes from the FOG —
  // r128 lerps a Points colour toward fog.color, and under additive blending a fogged mote adds
  // the fog's own light back on top of it. The field also rides the camera, so a far mote sits
  // at a FIXED screen position in the horizon band and never drifts out of it.
  {
    const G=global.__G, dp=G.dustPts();
    const P=dp.geometry.attributes.position.array;
    const CA=dp.geometry.attributes.color?dp.geometry.attributes.color.array:null;
    const n=dp.geometry.attributes.position.count;
    let litFar=0, near=0, brightest=0;
    for(let i=0;i<n;i++){
      const r=Math.hypot(P[i*3],P[i*3+2]);
      const lit=CA?Math.max(CA[i*3],CA[i*3+1],CA[i*3+2]):1;
      if(lit>brightest)brightest=lit;
      if(lit>0.004&&r>litFar)litFar=r;
      if(r<=20&&lit>0.05)near++;
    }
    check("v132.52 dust: no mote is LIT further than "+litFar.toFixed(1)+"u from the eye — the "+
      "field rides the camera, so that distance is fixed and this is the whole horizon band. "+
      "Dimming could never empty it: r128 lerps a Points colour toward fog.color, and under "+
      "additive blending the fog was supplying the light, not the mote",
      CA!==null&&litFar<=24.01);
    check("v132.52 dust: …and the layer still EXISTS — "+near+" motes lit inside twenty units "+
      "(brightest "+brightest.toFixed(2)+"). It is a catch-the-light layer for the near field; "+
      "a gate that passed by deleting it would be no fix at all",
      near>=10&&near<=45&&brightest>0.5);
    check("v132.52 dust: the material takes NO FOG and carries per-vertex colour (fog "+
      dp.material.fog+", vertexColors "+dp.material.vertexColors+") — the two mechanisms behind "+
      "every confetti report since v130.1",
      dp.material.fog===false&&dp.material.vertexColors===true);
  }
  check("v116 touch: the mobile layer is a no-op outside a browser",`,
'smoketest: the dust far-field gates');

console.log('v132.52 dust gates: '+edits+' edits applied');
