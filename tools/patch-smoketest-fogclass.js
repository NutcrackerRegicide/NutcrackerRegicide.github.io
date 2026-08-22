#!/usr/bin/env node
/* v132.54 — the gate for the CLASS, not the instance.
   This bug has now been shipped twice from the same root: an additive-blended material with
   three.js fog left on. Under AdditiveBlending r128's `mix(rgb, fogColor, fogFactor)` means a
   distant fragment ADDS the fog's own colour to the frame — so a BLACK point (an expired mote,
   deliberately blanked) turns into a bright white splat in the fog and stays invisible up close.
   It cost John five versions on the aura and three on the ambient dust before that. A gate on one
   material would not have caught the second one, so this gate walks the scene and holds the rule
   for every additive object in the game, including ones that do not exist yet. */
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
`dustPts:()=>dustPts,`,
`dustPts:()=>dustPts,scene:()=>scene,`,
'smoketest: export the scene');

sub('tools/smoketest.js',
`  check("v116 touch: the mobile layer is a no-op outside a browser",`,
`  // ---------- v132.54: NO ADDITIVE MATERIAL MAY TAKE FOG ----------
  {
    const G=global.__G, sc=G.scene();
    const adds=[];
    sc.traverse(o=>{
      const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
      for(const m of ms)if(m&&m.blending===THREE.AdditiveBlending)
        adds.push({what:o.type+(o.name?":"+o.name:""),fog:m.fog!==false});
    });
    const fogged=adds.filter(a=>a.fog);
    check("v132.54 fog: the scene HAS additive layers to police ("+adds.length+
      " of them: "+adds.map(a=>a.what).join(", ")+") — a rule nobody is subject to is not a rule",
      adds.length>=2);
    check("v132.54 fog: and NOT ONE of them takes three.js fog"+
      (fogged.length?" — offenders: "+fogged.map(a=>a.what).join(", "):"")+
      ". Under AdditiveBlending r128 computes mix(rgb, fogColor, fogFactor), so a distant "+
      "fragment ADDS the fog's own colour to the frame. A BLACK point — an expired aura mote, "+
      "deliberately blanked — therefore renders as a bright white splat out in the fog and stays "+
      "invisible up close, which is precisely the constellation John photographed marking "+
      "everywhere he had walked. Every instrument read that pool as clean, and every one was "+
      "right: the fog was doing the drawing, not the game. Shipped twice from this same root "+
      "(dust v130.1-v132.52, aura v132.29-v132.54) before anything tested for it",
      fogged.length===0);
  }
  check("v116 touch: the mobile layer is a no-op outside a browser",`,
'smoketest: the additive-fog class gate');

console.log('v132.54 fog-class gate: '+edits+' edits applied');
