#!/usr/bin/env node
/* v132.54 — THE FOG WAS PAINTING THE DEAD MOTES WHITE.

   John's repro, which is the whole thing: "you have to at least be level one, walk far enough to
   where starting location is in the fog of war to see the dots."

   Every measurement I took said the pool was clean — auraStats().lit read 0 while he was looking
   at thirty dots — and every one of those measurements was RIGHT. The dots are not lit. They are
   BLACK, and the fog is what makes them white:

     r128's fog for a Points material is  gl_FragColor.rgb = mix(rgb, fogColor, fogFactor).
     An expired mote has colour (0,0,0). Near the camera fogFactor is 0, so it stays black and
     invisible — which is why the dots are never in the near field. Out in the fog fogFactor goes
     to 1, so that black point resolves to fogColor, and under ADDITIVE blending it ADDS a full
     fog-coloured splat to the frame. A dead mote in the distance is a bright white dot.

   Everything falls out of that. The dots sit where he has BEEN, because that is where slots were
   last written — his spawn, the roads he walked. He must be level 1+ because a level-0 player has
   never written a slot at all. They only appear once the place is in fog. They vanish when he
   hides _auraPts. The colour buffer reads all-zero the whole time. And no amount of expiring,
   leashing, orphan-killing or render-path sweeping could ever touch them, because by every
   measure the engine takes, those points are already off.

   The maddening part: 01-engine.js has carried this exact analysis since v130.2, written about
   the ambient dust — "r128 fogs a Points material by mixing its colour TOWARD fog.color, which
   under additive blending means a distant mote adds most of the fog colour on top of the fog and
   resolves to a clipped white speck". I read that comment, quoted it back, fixed the dust with
   fog:false in v132.52 — and did not look at the other additive Points in the game.

   fog:false. The aura's own colour is what should light it, at every distance. */
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

sub('js/05-combat.js',
`  _auraMat=new THREE.PointsMaterial({size:AURA_SIZE,sizeAttenuation:false,vertexColors:true,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,map:_auraDot()});`,
`  // v132.54 fog:false IS LOad-BEARING. With fog on, r128 mixes every point's colour toward
  // fog.color by distance — and an EXPIRED mote is black, so out in the fog it resolves to the
  // fog colour and additive blending paints it as a bright white dot. The pool's dead slots keep
  // their last world position, so the result is a permanent constellation marking everywhere the
  // player has ever been: his spawn, the roads he walked. Invisible up close (fogFactor 0),
  // blazing at distance (fogFactor 1). Reported by John across five versions; invisible to every
  // instrument I had, because by the colour buffer those points ARE off. 01-engine.js has carried
  // this same analysis for the ambient dust since v130.2.
  _auraMat=new THREE.PointsMaterial({size:AURA_SIZE,sizeAttenuation:false,vertexColors:true,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,map:_auraDot(),fog:false});`,
'05-combat: the aura material takes no fog');

console.log('v132.54 aura-fog: '+edits+' edits applied');
