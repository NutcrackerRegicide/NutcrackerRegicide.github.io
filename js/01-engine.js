/* REGICIDE PVP — 01-engine.js */
// ---------- three setup ----------
scene=new THREE.Scene();
scene.background=new THREE.Color(0x9db8d6);
// v128: the haze was doing more damage than any material. A grey-lilac fog starting 60 units out
// desaturates the ENTIRE mid-field — the exact band a player spends the whole match in — and grey
// is the one colour a lush scene cannot afford. It is bright sky blue now, and it starts far
// enough back that the playable foreground stays fully saturated.
// The FAR value is load-bearing and must NOT be pushed out for prettiness: worldDeco is distance
// culled (88 on battery saver, 105 off) and the fog is what hides that cull line. Fade the world
// out further than you delete it and distant trees pop in and out in plain sight.
//
// v130.1 THE FOG AND THE SKY WERE NOT THE SAME COLOUR, AND THAT IS THE WHOLE HORIZON.
// fog was 0xbfe4ff while the dome's horizon stop was 0xcdeeff — 14/10/0 apart, over the 4/channel
// limit in ART-DIRECTION §4.3 — so distant land dissolved into a band that did not belong to the
// sky it was dissolving into. Worse, BOTH were near-white: 0xcdeeff measures 0.93 screen value,
// which is above the bloom threshold, so the entire far field bloomed and clipped. Measured on the
// wide vantage: 35.7% of pixels clipped in some channel, and the upper half of the frame was one
// featureless sheet of milk with no ridge and no gradient in it.
// §2.1's #BFD6E6 is 0.82 — under the 0.86 bloom threshold, so the horizon settles into a COLOUR
// instead of glowing. The dome's horizon stop is the same three bytes (see buildSky below); they
// are one value written twice and they must move together or the illusion is a visible cut-out.
//
// Near/far are now §4.2's HIDE_D×0.5 / HIDE_D for the desktop cull line of 150 (js/09-main.js:272).
// Fading the world out exactly where it is deleted is what makes the cull line invisible; the old
// 104/182 faded PAST it, so on desktop trees vanished at 41% opacity and on a phone (HIDE_D 88)
// they popped in at full saturation. Binding the two properly needs setHideD() to call
// __setFogRange below — that lives in js/09-main.js and belongs to the atmosphere item; these
// constants are the desktop case, which is what every render in _art/ is shot at.
//
// v130.6 DO NOT PRE-DIVIDE THIS HEX FOR THE GRADE. Half the palette in this project is authored
// against the post stack — see the cloud hex at buildClouds, and the terrain's held-back saturation
// — so reaching for the same trick here is the obvious move and it is the wrong one. A round-4 read
// of 06-wide called the horizon a cut-out (sky 193,215,226 over distant ground 186,208,209, blue 17
// short) and prescribed authoring this hex high so the far field lands on §2.1's swatch after tone
// mapping. FOG IS NOT TONE MAPPED. r128 puts <fog_fragment> AFTER <tonemapping_fragment> and
// <encodings_fragment> in every lit shader, so a fragment at factor 1 writes these three bytes
// literally — the same way the raw sky dome does — and the grade then bends both by the same amount.
// Measured rather than argued: collapse the range so every fragment is fully fogged and the WHOLE
// frame renders 193,215,226, byte for byte the sky above it. Pre-dividing would shove the fog off
// the dome's horizon stop, which is the §4.3 divergence this comment block exists to prevent.
// The 7/7/17 is 10% of the GROUND'S OWN COLOUR, held back on purpose: GROUND_FOG
// (js/02-world.js:145) caps the ground and everything standing on it at a 0.90 fog factor out at
// fogFar and lets go only by fogFar×2.5; the ridge sits at 0.82 (§4.4). Nothing in this file can
// close that, and closing it there is paid for in F6 — what the ground keeps at the cull line is
// exactly the size of the pop when the tree standing on it is deleted.
scene.fog=new THREE.Fog(0xBFD6E6,75,150);
// v128.2 ANDROID FLICKER. A near plane of 0.1 against a far plane of 1200 is a 12,000:1 range,
// and depth precision is distributed almost entirely in the first few units. Desktop and iOS
// hand out a 24-bit depth buffer and absorb it; plenty of Android GPUs give 16 bits, where that
// ratio is not enough to separate two surfaces a few centimetres apart — so coplanar geometry
// strobes as the camera moves. That is the classic "flickers on Android, fine on iPhone" split,
// and v128.1's outline hulls made it far worse by placing a second surface a fraction of a unit
// off every inked mesh.
// The camera never gets closer than ~7 units to the player in any of the three rigs, so 0.1 was
// buying precision nothing needs. 0.6 is a 6× improvement for free. FAR stays at 1200: the sky
// dome is radius 700 about the origin and the camera can stand 200 out, so anything under ~900
// clips the sky into a black hole.
camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,0.6,1200);
renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1)); // lo-fi loves 1:1 — and so does the GPU
renderer.shadowMap.enabled=true;
// v130.4 PCF WAS SANDING OFF THE ONE HARD EDGE THE STYLE IS BUILT ON. Its 9-tap kernel blurs the
// shadow boundary over ~1.5 texels, which at the old 1024/±70 map is 0.2 world units of grey mush
// — and grey mush is exactly what the toon ramp spends four bands trying not to produce. A cel
// drawing wants the shadow to be a SHAPE with an outline, the same as everything else in the
// frame. Basic is 1 tap: hard in, hard out, and cheaper (ART-DIRECTION §3.8).
renderer.shadowMap.type=THREE.BasicShadowMap;
// v130 THIS LINE WAS DEAD FOR TWO YEARS. It is correct and it stays, but it only ever fires on the
// direct `renderer.render()` path (the smoketest, drawcost.js, any build with no EffectComposer).
// The moment a composer exists the game renders into ITS targets, and r128 takes a program's
// output encoding from the BOUND TARGET, not from the renderer — WebGLPrograms.getParameters:
// `outputEncoding: null !== renderTarget ? getEncoding(renderTarget.texture) : renderer.outputEncoding`.
// The composer's two ping-pong targets are LinearEncoding, so <encodings_fragment> compiled down to
// a no-op for every lit material in the game. See the real fix where the composer is built.
renderer.outputEncoding=THREE.sRGBEncoding;
// v128 THE TOON PASS. ACESFilmic was the single biggest thing standing between this game and a
// vibrant cartoon: it rolls highlights off into pastel and pulls saturation out of exactly the
// bright greens the style lives on, AND it smears the hard steps a toon ramp works so hard to
// make. Filmic tone mapping is for photographic light on photographic shapes; these are flat
// colours on low-poly forms. Linear keeps the ramp crisp and the greens loud.
renderer.toneMapping=THREE.LinearToneMapping;
// v130 EXPOSURE IS NOW A LINEAR-LIGHT DIAL, NOT A SCREEN-BRIGHTNESS DIAL. 0.78 was chosen against
// an unencoded frame, where it multiplied the value you actually saw. With the encode restored it
// multiplies IRRADIANCE and the sRGB curve then lifts the result hard, so the same number blew
// every pale material — canvas, plaster, snow caps — to flat 255 and took its folds with it.
// This is the one number in the pipeline with a derivation rather than a taste, so here it is.
// A flat surface in full sun receives sun 1.55 + sky 0.45 + ambient 0.05 = 2.05, or 1.83–1.90 per
// channel once the lights' own tints are counted. Setting exposure to the reciprocal of that puts
// the ramp's TOP band at 1.0x albedo, which is what makes ART-DIRECTION §2 true as written: an
// authored sRGB hex eyedroppered off a large sunlit area comes back as the hex that was authored.
// 1/2.05 = 0.488, 1/1.83 = 0.546; 0.50 sits between them.
//
// v130.4 …AND THAT DERIVATION IS STILL RIGHT WHILE 0.50 IS NOW WRONG, because the thing it was
// measured against no longer exists. 0.50 was picked to hold a clipping budget on a build whose
// horizon was 0xCDEEFF (0.93 screen value, above the bloom threshold) and whose far field measured
// 35.7% of pixels clipped. The atmosphere and palette passes have since taken the sky, the fog and
// the pale surfaces down. Re-swept on today's build, worst-shot clipping to 255 in ANY channel:
//     0.50→0.46%  0.54→0.68%  0.56→0.71%  0.58→0.73%  0.60→0.91%  0.62→2.15%  0.68→2.89%
// and 0.00% in all three channels at every stop. There is a knee between 0.60 and 0.62 and it is
// one shot: the near units' sunlit white trousers and beards on the crowd vantage.
//
// §3.6 asks for two things that no longer both fit, so read the section carefully — it says which
// one it means. `0.62` is annotated "starting point, tune down from 0.78"; the ≤2%/≤0.5% budget is
// annotated "Checkable rule". A starting point yields to a checkable rule. 0.60 is the highest
// stop that holds it, and it holds it with 2.2× of headroom, which matters because the unit lane
// is still moving those white masses UP toward §6.2's 0.89 — at 0.62 the next brightening of a
// beard fails the budget outright.
// In screen terms 0.60 vs 0.62 is (0.62/0.60)^(1/2.2) = 1.5% of value. Nobody can see it. The
// crowd vantage's clipped fraction moves 2.15% → 0.91%. That is the whole trade.
//
// TWO CORRECTIONS to how 0.50 was argued, because whoever sweeps this next will hit both traps:
//   · It was scored on GROUND-HALF pixels. §3.6 says "of pixels", whole frame. The ground half is
//     a harsher denominator and it is not the rule that was written down.
//   · Exposure is NOT the reason §6.2's ladder fails. Those white masses are not too dark, they
//     are too SPLIT: the same trouser leg clips at 255 in full sun and sits at 0.53 in the ramp's
//     shadow band. A gain slides a spread, it cannot close one. Measured on a real unit, going
//     0.50 → 0.62 lifts the white bands 0.57 → 0.64 (a quarter of the gap to 0.86) and pushes the
//     hat and boots 0.20 → 0.23, i.e. AWAY from their 0.14. Closing the ladder is a unit-material
//     job; there is no exposure that does it.
// WHAT WAS SUBORDINATED: value spread, and §3.6's advisory number. p95−p5 over the six shots
// falls 0.634 → 0.620 from 0.50 to 0.60 — a sliver of the §1.1 "whole frame is one value"
// complaint, traded for a quarter of the §6.2 white-band gap. Spread has no number anywhere; the
// clipping budget does, and it is still met.
renderer.toneMappingExposure=0.60;
document.body.appendChild(renderer.domElement);
// v122: a lost GL context used to render as a silent WHITE SCREEN — John's 45-minute match died
// that way and he was dropped back to the main menu with no explanation. Swallowing the default
// lets the browser hand the context back; either way he now gets a sentence instead of a void.
renderer.domElement.addEventListener("webglcontextlost",e=>{
  e.preventDefault();
  console.warn("[gl] context lost");
  if(typeof msg==="function")msg("⚠ The graphics context was lost — reload the page if the screen stays blank.","warn");
},false);
renderer.domElement.addEventListener("webglcontextrestored",()=>{
  console.warn("[gl] context restored");
  if(typeof msg==="function")msg("Graphics restored.","blue");
},false);
clock=new THREE.Clock();

// ---------- v128: THE TOON RAMP ----------
// One shared gradient map drives every MeshToonMaterial in the game, so the whole world bands at
// the SAME light levels and reads as one drawing rather than a pile of separately-shaded objects.
// Four steps, not the usual three: three gives a hard terminator that looks great on a character
// and awful on a 400-unit hillside, where the single mid-step turns whole valleys into one flat
// slab. The extra step buys the terrain a shoulder to roll through.
// NearestFilter is mandatory — linear filtering between the cells is just a gradient again, which
// is the thing we are getting rid of. And NO sRGB encoding here: the gradient map is a lookup
// into lighting, not a colour to be displayed, so encoding it would bend the steps.
//
// v130 FOUR STEPS, BUT ONLY TWO OF THEM WERE REACHABLE — this is why the game looked unlit.
// r128 samples the ramp at `u = dotNL*0.5 + 0.5` (gradientmap_pars_fragment). At four texels with
// NearestFilter the cell boundaries land at dotNL = -0.5, 0.0 and +0.5, so the ENTIRE lit
// hemisphere from grazing light to dead-on-the-sun only ever hit two cells, 0xd2 and 0xff. Every
// hillside, every roof plane and every unit facing anywhere vaguely upward got the same value: a
// 4-step ramp behaving like a 2-step one, which is the mechanical reason a scene with a ramp in it
// read flat. Measured on a grey quad walked from dotNL 0 to 1 (with the hemisphere at its old
// 0.75, which is the other half of the story): the whole lit hemisphere swung 30%, and the nine
// samples produced nine DIFFERENT values — a gradient wearing a ramp's clothes. The same walk
// after this change gives 61%, in four flat plateaus you can point at.
//
// The fix is NOT more bands — four is still the right number for the style. It is putting the
// breaks where the light actually lives. 64 texels buys the resolution to place them at
// dotNL = -0.15 / 0.18 / 0.52 (ART-DIRECTION §3.7), which splits the lit hemisphere across three
// cells instead of one and leaves a single deep-shadow cell for everything turned away.
// Boundary index for a threshold t is i = round((t+1)*32) -> 27, 38, 49.
//
// THE BYTES ARE LINEAR, NOT SCREEN VALUES, and that is the part that is easy to get wrong. The
// ramp is a multiplier on irradiance and the sRGB encode happens downstream of it, so a byte b
// shows up on screen at (b/255)^(1/2.2). 38/75/146/255 land at 0.42 / 0.58 / 0.78 / 1.00 — four
// even-looking steps. The obvious authoring (evenly spaced 64/128/191/255) encodes to
// 0.52/0.74/0.89/1.00 and merges the top two bands back together, which is precisely the failure
// the wider ramp exists to fix.
//
// v130.4 THE RAMP IS NOT THE REASON THE WORLD STILL READS AS ONE BAND. DO NOT RE-AUTHOR IT.
// Measured, so the next person to look does not have to: painting each band on its own and
// counting the pixels it owns (hemisphere and ambient off, so a lit pixel belongs to exactly one
// cell) gives the top band 87% of every sun-lit pixel in the meadow, 93% in the town, 77% in the
// crowd. That looks like a broken ramp and is not one. It is geometry:
//   · The TERRAIN's world-space dotNL runs 0.562 … 0.888 across all 18,271 vertices — the WHOLE
//     plane sits above the 0.52 break, so it is one band by arithmetic and always will be. With
//     the sun at 49.4° a surface has to tilt 18° away from it to fall out of the top cell, and
//     this map's steepest slope is 16.5°. It misses the band edge by a degree and a half.
//   · Everything with real curvature bands exactly as authored: sampling the tree meshes gives
//     41 / 12 / 11 / 36 across the four cells, and the forest vantage shows all four.
// So the two levers that can put a second value on this ground are (a) shadows — which is why
// §3.8 is a blocking item and not a polish one — and (b) more terrain relief, which is world gen
// and therefore on the wire. Moving the top break down to catch a 16.5° slope is the third
// option and it is the wrong one: it would drag half the flat lawn into the mid cell and split
// the ground into two values, which is a different picture from the one §3.7 authored.
const RAMP_BANDS=[
  {upto:27,v:38},   // deep shadow  dotNL < -0.15   — turned away from the sun
  {upto:38,v:75},   // shadow       -0.15 … 0.18    — the terminator band
  {upto:49,v:146},  // mid           0.18 … 0.52    — the shoulder a hillside rolls through
  {upto:64,v:255}   // lit           > 0.52         — full sun
];
function makeToonRamp(width){
  const c=document.createElement("canvas"); c.width=width; c.height=1;
  const ctx=c.getContext("2d");
  for(let i=0;i<width;i++){
    let v=255; for(const b of RAMP_BANDS){ if(i<b.upto){ v=b.v; break; } }
    ctx.fillStyle="rgb("+v+","+v+","+v+")"; ctx.fillRect(i,0,1,1);
  }
  const t=new THREE.CanvasTexture(c);
  t.minFilter=t.magFilter=THREE.NearestFilter;
  t.generateMipmaps=false;
  return t;
}
// Power of two, and 64 is the smallest width that can place all three breaks within half a texel
// of where §3.7 asks for them. Wider buys nothing: the ramp is four flat runs either way.
const TOON_RAMP=makeToonRamp(64);

// ---------- lighting: bright, warm, and pointed ----------
// v128: a cool sky bounce against a warm sun is what makes stylised greens sing — the shadowed
// side of every leaf goes faintly blue and the lit side goes gold, which is the whole trick behind
// how a Gen-1 route looks. The old rig was a warm hemisphere over a warm sun with a warm ambient
// on top: three lights all pushing the same direction, which is why everything read dusty.
// v130 THE HEMISPHERE WAS THE CULPRIT, NOT THE RAMP. In r128 only the DIRECTIONAL light goes
// through getGradientIrradiance; HemisphereLight lands in indirectDiffuse as a smooth, completely
// unquantised wrap-lambert term (lights_pars_begin), and AmbientLight is a flat constant. At
// hemi 0.75 / sun 1.15 roughly 40% of all the light hitting a lit up-facing surface bypassed the
// toon ramp entirely — the bands were being drawn and then half-filled back in. Widening the ramp
// above does nothing while that is true.
// 0.45 / 1.55 holds total energy on a sunlit surface almost exactly constant (1.95 -> 2.05) and
// nearly doubles the ramp's authority over the image. It is a redistribution, not a brightening.
// This deliberately overrides the note below about the RATIO never changing: that note was written
// when the ramp was the only suspect. The cool-shadow read it was protecting survives because the
// hemisphere's ground colour is now grass.base darkened 40% rather than a saturated sea-green, so
// the shade side still goes blue at the top and warm-green at the bottom — see ART-DIRECTION §3.3.
// DO NOT put the hemisphere back up to fight a dark shadow side. Cool the ramp's bottom band.
const hemi=new THREE.HemisphereLight(0xa8ccea,0x4a6330,0.45); scene.add(hemi);
// A toon ramp quantises DIRECTIONAL light. Ambient bypasses that entirely — it lifts every pixel
// equally, so the bands wash together and the whole point is lost. What was 0.18 of warm ambient
// is now a whisper, just enough to keep pure-shadow faces from going flat.
const warm=new THREE.AmbientLight(0xffe8cc,0.05); scene.add(warm);
const sun=new THREE.DirectionalLight(0xfff1d2,1.55);
sun.position.set(36,90,48); sun.castShadow=true; // same ratio as (6,15,8), at the map's scale
// v130.4 THE BOX WAS TWICE AS WIDE AS IT NEEDED TO BE AND HALF AS SHARP AS IT COULD BE.
// ±70 at 1024 is 0.137 world units per texel — a unit is about a metre across, so his whole
// shadow was seven texels of PCF porridge and simply did not read as a nutcracker-shaped hole in
// the grass. ±52 at 2048 is 0.051, a 2.7× sharpening, and it costs nothing in draw calls: the
// tighter box culls MORE casters out of the depth pass than the extra resolution adds.
// SHADOW_R below must move with these four numbers — the texel snap in aimShadow() derives from
// it, and a mismatch puts the snap on the wrong grid and brings the crawl straight back.
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-52;sun.shadow.camera.right=52;   // tight box that FOLLOWS THE VIEW
sun.shadow.camera.top=52;sun.shadow.camera.bottom=-52;
// NEAR IS 110, NOT r128's 0.5, AND THAT IS A PRECISION FIX RATHER THAN A CULL. An ortho shadow
// camera spreads its depth range evenly, so 0.5→340 spends two thirds of the buffer on empty sky
// between the light and the map. The light sits 221 units off its target along (120,168,80); the
// deepest thing the ±52 box can hold is ~266 away and the tallest caster in it ~146, so 110→340
// brackets every real caster with room either side and hands the rest of the range back to the
// geometry that is actually in it.
sun.shadow.camera.near=110;
sun.shadow.camera.far=340;
sun.shadow.camera.updateProjectionMatrix();
// v129.5 BIAS FIRST, THEN RECEIVERS. Both were 0, which was harmless only because exactly ONE
// mesh in the whole scene received shadows and it was not itself a caster, so nothing could
// self-shadow. The moment receiving is widened (below), bias 0 ships global acne: measured at
// 44% of the frame changing, the forest going black and every unit darkening uniformly. These
// two numbers were found by sweeping a bias sheet against the real scene, not guessed.
sun.shadow.normalBias=0.10; sun.shadow.bias=-0.0004;
scene.add(sun.target);
renderer.shadowMap.autoUpdate=false; // refreshed every other frame from the game loop
scene.add(sun);

// v130.4 THE SHADOW BOX FOLLOWED THE PLAYER, WHICH IS NOT WHERE ANYONE IS LOOKING.
// 09-main.js parked the box on the player every frame. In the over-the-shoulder rig the camera
// stands 7.4 units BEHIND him and the eye lives 20–60 units in FRONT of him, so a ±52 box centred
// on his feet spends its back half on ground nobody can see and runs out before the mid-field
// does. ART-DIRECTION §3.8 says centre it on the VIEW. It also has to be centred on the view for
// a duller reason: every render this overhaul is judged on comes out of tools/vista.js, which
// freezes the game loop and teleports a camera — so anything aimed from renderFrame aims at
// wherever the player happens to be standing, and the town and forest shots photograph a world
// with the shadow box a hundred units off frame. Aiming from the SCENE's onBeforeRender, off
// whichever camera is rendering, is one rule that is true in the game and in every tool.
const SHADOW_R=52;                       // MUST equal the ortho half-extent set above
const _SUN_OFF=new THREE.Vector3(120,168,80);   // §3.1's vector; direction is canon, length is not
// The light's basis is CONSTANT because that offset never rotates, so the snap grid can be built
// once. It has to be the light's grid and not world x/z: the sun's azimuth is 33.7° off world X,
// so rounding focus.x and focus.z to texel multiples snaps to a lattice the shadow map is not
// sampled on, and the crawl it is supposed to kill survives the rounding.
const _lz=_SUN_OFF.clone().normalize();
const _lx=new THREE.Vector3(0,1,0).cross(_lz).normalize();
const _ly=_lz.clone().cross(_lx);
const _shFocus=new THREE.Vector3(), _shFwd=new THREE.Vector3(), _shAim=new THREE.Vector3();
let _shHave=false, _shPx=0, _shPz=0;
function aimShadow(cam){
  // The horizontal view forward, not the camera's own -Z: a pitched-down camera would otherwise
  // pull the focus toward its own feet exactly when it can see furthest.
  _shFwd.set(0,0,-1).applyQuaternion(cam.quaternion); _shFwd.y=0;
  if(_shFwd.lengthSq()<1e-8)_shFwd.set(0,0,-1); else _shFwd.normalize();
  const tx=cam.position.x+_shFwd.x*30, tz=cam.position.z+_shFwd.z*30;   // ≈ player + forward*23
  // Damped, because the map only regenerates on even frames and an undamped box shears against its
  // own contents on the frames in between.
  // THE CUT TEST IS ON THE TARGET'S OWN STEP, NOT ON HOW FAR THE BOX HAS FALLEN BEHIND, and that
  // distinction cost a whole render round. Snapping on "the box is more than a box-width out" never
  // fires for a jump SHORTER than the box: vista.js's first shot moves the eye 39 units, the lerp
  // ate it 12% at a time, and the one render it takes came out with the shadows parked most of a
  // box off — i.e. the tool photographed a lag, not the game. Nothing in the world moves the view
  // 24 units between two frames (a sprint is ~0.2, a hard mouse flick ~10), so a step that big is a
  // cut — a respawn, a minimap jump, a tool teleporting the camera — and a cut wants the box NOW.
  if(!_shHave||Math.abs(tx-_shPx)>24||Math.abs(tz-_shPz)>24){
    _shFocus.set(tx,0,tz); _shHave=true;
  }else{
    _shFocus.x+=(tx-_shFocus.x)*0.12; _shFocus.z+=(tz-_shFocus.z)*0.12;
  }
  _shPx=tx; _shPz=tz;
  const texel=(2*SHADOW_R)/sun.shadow.mapSize.x;
  const u=Math.round(_shFocus.dot(_lx)/texel)*texel, v=Math.round(_shFocus.dot(_ly)/texel)*texel;
  _shAim.copy(_lx).multiplyScalar(u).addScaledVector(_ly,v).addScaledVector(_lz,_shFocus.dot(_lz));
  if(sun.target.position.distanceToSquared(_shAim)>1e-8){
    sun.target.position.copy(_shAim); sun.target.updateMatrixWorld(true);
    sun.position.copy(_shAim).add(_SUN_OFF); sun.updateMatrixWorld(true);
  }
}
// ONE DOOR FOR THE SHADOW RESOLUTION, because 2048 is a desktop number.
// The map went to 2048 for sharpness and that is 4× the depth-pass fill and a 16MB RGBA target —
// which is fine on the machine these renders are shot on and is exactly the sort of thing that
// turns up later as "it got hot and dropped to 12fps on the Moto". r128 only allocates the target
// once, so mapSize alone does nothing after the first frame; the map has to be released too.
// The texel snap above reads mapSize live, so it re-grids itself and does not need telling.
window.__shadowRes=function(px){
  const n=Math.max(256,px|0);
  if(sun.shadow.mapSize.x===n)return;
  sun.shadow.mapSize.set(n,n);
  if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
};

// v128: ONE factory swap converts almost the whole game. `mat`, `plainMat`, `texturedMat`,
// `headMaterials` and `heraldryMat` are where every material in 02-world, 03-buildings and
// 04-units comes from, so toon-shading the game is five edits here rather than a thousand
// downstream. Anything that reaches past these and news up a Lambert directly is deliberate
// (clouds, water, decals) and is handled where it lives.
// v130 THE OTHER HALF OF THE ENCODING FIX, and skipping it is how you turn one bug into two.
// r128 has no ColorManagement, so `material.color` is handed to the shader RAW and used as a
// LINEAR albedo. A texture tagged sRGBEncoding, by contrast, is decoded to linear on sample. So
// the same authored hex means two different physical brightnesses depending on whether it arrived
// as a texel or as a material colour — which is the real shape of "textured surfaces render c^2.2
// darker than the flat colour beside them".
// Restoring the output encode alone does NOT fix that, it INVERTS it: textured surfaces come back
// correct while flat ones, never having been decoded, come out at c^(1/2.2) — washed out and now
// too BRIGHT next to their own textures. Both halves are needed for a hex to mean one thing.
// So every authored colour is decoded here, at the one door almost every material in the game
// comes through (ART-DIRECTION §7.4). Downstream files keep writing plain sRGB hex — that is the
// point; nobody should be hand-converting palette entries at the call site.
// The clone matters: callers pass shared THREE.Color objects (TEAMCOL entries, cached palettes)
// and converting in place would darken them a second time on every material built from them.
//
// `srgb()` IS THE DOOR. It is global on purpose — every later file can and should use it, because
// this factory only covers `material.color`, and that is NOT the only way a colour reaches the
// shader. Anything that hands the GPU a hex by another route is still raw and now renders washed
// out and too pale, and there are three such routes live in the game today:
//   · VERTEX COLOURS. `geometry.attributes.color` multiplies diffuseColor before lighting exactly
//     the way material.color does, so it needs the same decode. TREE_MAT (02-world.js:226) bakes
//     raw hexes into a colour attribute at :222 and is the map's dominant object class — the
//     forest is visibly paler than the ground until that is converted. Same for the terrain and
//     the instanced foliage layers. Merged UNIT geometry is already fine: _mergeCluster
//     (04-units.js:202) reads `c.material.color` off materials minted here, so it inherits.
//   · MeshBasicMaterial / SpriteMaterial / PointsMaterial. Unlit, but still encoded on output, so
//     flat team rings, auras and banners read pale until they go through srgb() too.
//   · Light colours are deliberately NOT converted. They are tints on an intensity, not albedo,
//     and ART-DIRECTION §3 authored the hex/intensity pairs together.
function srgb(c){return (c&&c.isColor?c.clone():new THREE.Color(c===undefined?0xffffff:c)).convertSRGBToLinear();}
function toonMat(o){o=o||{};o.gradientMap=TOON_RAMP;if(o.color!==undefined)o.color=srgb(o.color);return new THREE.MeshToonMaterial(o);}
function mat(c){return toonMat({color:c});}

// ================= v128.1: THE INK =================
// Cel shading is two halves — quantised light (the ramp above) and a LINE. This is the line, and
// on a phone it is the half that does the most work: at 0.7 pixel ratio on a 6-inch screen, a
// brown unit against green grass separates by hue alone, badly. A black edge separates it always.
//
// HOW WE GOT HERE, because the obvious answer looked better on paper: the cheap technique is a
// screen-space edge detector reading the depth buffer — one full-screen pass, cost independent of
// scene complexity, exactly right for a host at 10–19 fps. It is implemented and it is not what
// shipped, for two reasons found by trying it.
//   1. EffectComposer ping-pongs two targets and `clone()` copies depthTexture BY REFERENCE, so
//      the edge pass samples the same attachment it is drawing into. WebGL resolves that feedback
//      loop as zero. Fixable with a private scene target — and I did fix it.
//   2. The depth texture then still read back all-zero under the headless GL this environment
//      renders with, so there was no way to SEE it working. Shipping a renderer change I could
//      not look at is exactly the thing this codebase keeps getting burned by.
// Inverted hulls are geometry. They render the same everywhere, and I can look at them.
//
// COST CONTROL is the whole design. A hull is +1 draw call per outlined mesh, so this is applied
// by SILHOUETTE VALUE, not everywhere: the big readable shapes get a line, the fiddly interior
// bits do not. It also reuses the source geometry — no extra vertex memory, just the call.
const INK_MATS=new Map();
function inkMaterial(px){
  const key=String(px);
  if(INK_MATS.has(key))return INK_MATS.get(key);
  // A plain scaled-up copy would fatten thin shapes and pinch fat ones. Pushing along the NORMAL
  // in view space gives a line of roughly even weight whatever the silhouette is doing, and doing
  // it in the vertex shader means the hull costs no CPU at all.
  const m=new THREE.ShaderMaterial({
    side:THREE.BackSide, fog:true,
    // v128.2: push the hull a hair further back in the depth test. On a 16-bit Android depth
    // buffer the shell and the surface it wraps land in the same depth bucket at grazing angles
    // and strobe against each other. polygonOffset is the standard cure and costs nothing.
    polygonOffset:true, polygonOffsetFactor:1.0, polygonOffsetUnits:1.0,
    uniforms:{inkPx:{value:px},bufH:{value:620},tanHalfFov:{value:0.55},
      inkCol:{value:new THREE.Color(0x14180f)},
      // v130.1 THESE THREE MOVE WITH scene.fog OR THE MID-FIELD BECOMES A WIRE DRAWING.
      // The ink shader reimplements linear fog by hand, so it carries its own copy of the fog
      // colour and range. Change one and not the other and every outlined mesh fogs on a different
      // curve from its own body — a distant tree keeps a hard black edge around a canopy that has
      // already faded to sky (ART-DIRECTION §10.13). Same bytes, same distances, same commit.
      // v130.3 …AND THEY ARE COPIED FROM scene.fog AT MINT TIME, not written as constants here.
      // __setFogRange can only reach materials that already exist, and these are minted LAZILY —
      // the first roof slab to want an outline makes one (03-buildings.js:313), long after
      // 12-touch.js has pulled the cull line to 88 on a phone. Hardcoding 75/150 meant every
      // outline born after that moment fogged on the DESKTOP curve while its body used the saver's:
      // black edges hanging in clear air around canopies that had already gone to sky, on the one
      // platform nobody here can look at. Read the live fog and the class of bug cannot recur.
      fogColor:{value:(scene.fog?scene.fog.color.clone():new THREE.Color(0xBFD6E6))},
      fogNear:{value:scene.fog?scene.fog.near:75},fogFar:{value:scene.fog?scene.fog.far:150}},
    vertexShader:[
      "uniform float inkPx;uniform float bufH;uniform float tanHalfFov;varying float vFog;",
      "void main(){",
      "  vec4 mv=modelViewMatrix*vec4(position,1.0);",
      "  vec3 n=normalize(normalMatrix*normal);",
      // scale the push with distance so the line keeps a near-constant WIDTH ON SCREEN instead of
      // vanishing at range — which is precisely when a small screen needs it most
      // inkPx is DEVICE PIXELS, converted to a view-space push using the live buffer height.
      // The first version used a fixed constant here, which holds the line at a constant FRACTION
      // OF THE SCREEN — and a phone render at the battery saver's 0.7 pixel ratio proved what that
      // costs: on a 273-pixel-tall buffer a 2.4px line resolves to roughly ONE device pixel and
      // dissolves completely. The outlines were invisible on exactly the device they were added
      // for. Dividing by bufH keeps the line the same number of real pixels at any resolution, so
      // it gets relatively THICKER as the buffer shrinks, which is what small screens need.
      "  mv.xyz+=n*inkPx*(-mv.z)*(2.0/bufH)*tanHalfFov;",
      "  vFog=-mv.z;",
      "  gl_Position=projectionMatrix*mv;",
      "}"].join("\n"),
    fragmentShader:[
      "uniform vec3 inkCol;uniform vec3 fogColor;uniform float fogNear,fogFar;varying float vFog;",
      "void main(){",
      // the outline has to take the fog too, or every distant tree keeps a hard black edge while
      // its body fades to sky and the horizon turns into a wire drawing
      "  float f=smoothstep(fogNear,fogFar,vFog);",
      "  gl_FragColor=vec4(mix(inkCol,fogColor,f),1.0);",
      "}"].join("\n")
  });
  INK_MATS.set(key,m); return m;
}
// Attach a hull to `mesh`, drawn from the same geometry. `px` is roughly the line's screen width.
// Every ink material has to be told the live buffer height, or the line silently changes weight
// whenever the window resizes or the battery saver moves the pixel ratio. Called from the resize
// path and from the saver.
window.__syncInk=function(){
  const sz=renderer.getDrawingBufferSize(new THREE.Vector2());
  const t=Math.tan(camera.fov*Math.PI/360);
  // v128.3 CSS PIXELS, NOT DEVICE PIXELS. Feeding the raw drawing-buffer height made `px` mean
  // "device pixels", and the phone runs the battery saver at a 0.7 pixel ratio — so a 2.4 line
  // rasterised at 2.4 device px and then got UPSCALED to the screen, landing at 3.4 CSS px. The
  // same constant drew a hairline on a desktop and a slab on a phone, which is the opposite of
  // what a small screen wants. Dividing by the pixel ratio gives the canvas's CSS height, which
  // makes `px` mean CSS pixels — the unit that is already defined to look the same at a phone's
  // viewing distance and a monitor's. One number, same apparent weight everywhere.
  const dpr=Math.max(0.01,renderer.getPixelRatio?renderer.getPixelRatio():1);
  const cssH=Math.max(1,sz.y/dpr);
  INK_MATS.forEach(m=>{m.uniforms.bufH.value=cssH;m.uniforms.tanHalfFov.value=t;});
};
// v130.1 ONE DOOR FOR THE FOG RANGE, so the two copies can never drift apart again.
// ART-DIRECTION §4.2 binds fog.far to HIDE_D and fog.near to HIDE_D×0.5 — the cull line and the
// fade have to be the same distance or the cull line is visible on one platform or the other. The
// cull line itself lives in js/09-main.js (`setHideD`, :273) and the battery saver moves it to 88,
// so the wiring is one call from there: `setHideD(v){ …; __setFogRange(HIDE_D); }`. That file is
// another lane's; this is the half that belongs here, ready for it.
window.__setFogRange=function(hideD){
  const far=Math.max(20,hideD||150), near=far*0.5;
  if(scene.fog){scene.fog.near=near;scene.fog.far=far;}
  INK_MATS.forEach(m=>{m.uniforms.fogNear.value=near;m.uniforms.fogFar.value=far;});
};
// `?ink=0` turns every outline off. This exists because I cannot reproduce an Android device
// here: if John's guest still flickers with the outlines gone, the hulls are innocent and the
// depth range was the whole story; if the flicker stops, they are the cause and the next dial is
// the hull offset. One reload settles a question I would otherwise have to guess at.
// v128.3 …and `?ink=<n>` now SCALES it, because the person who can see the phone is not the person
// who can edit the shader. ?ink=0 off · ?ink=0.5 half-weight · ?ink=2 double. Dial it on the device,
// tell me the number that looked right, and I bake that in — instead of me guessing a constant and
// posting a new build for every guess.
window.__inkScale=1;
try{
  const q=/[?&]ink=([0-9]*\.?[0-9]+)/.exec((typeof location!=="undefined"&&location.search)||"");
  if(q){
    const v=parseFloat(q[1]);
    if(isFinite(v)&&v>=0){window.__inkScale=v; if(v===0)window.__noInk=true;}
  }
}catch(_){}
// BUG, found by playtest: __syncInk was wired to resize and to the battery-saver toggle and
// called from NEITHER at startup. On a desktop that never fires a resize, bufH stayed at its 620
// default while the real buffer was 1440 tall — so every line rendered ~2.3× thicker than asked
// for. Sync once, now, and again on the first frame in case the canvas is still settling.
try{
  if(window.__syncInk)window.__syncInk();
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>{try{window.__syncInk&&window.__syncInk();}catch(_){}});
}catch(_){}
function inkOutline(mesh,px){
  if(!mesh||!mesh.geometry||window.__noInk)return mesh;
  const hull=new THREE.Mesh(mesh.geometry,inkMaterial((px||2.4)*(window.__inkScale===undefined?1:window.__inkScale)));
  hull.castShadow=false; hull.receiveShadow=false;
  hull.renderOrder=(mesh.renderOrder||0)-1;
  hull.matrixAutoUpdate=false;                 // it never moves relative to its parent
  mesh.add(hull);
  return mesh;
}
// v129.5 THE GAME CAST 1,078 SHADOWS AND CAUGHT ONE.
// A scene traverse found 1,078 meshes with castShadow=true and exactly ONE with receiveShadow —
// the terrain plane at 02-world.js:46. The shadow map was being generated correctly every other
// frame, at 1024x1024, ~19% occupied, with the forest and the Town Centre plainly legible in it —
// and then thrown away, because nothing a shadow landed on was listening. Units did not shade
// each other, buildings did not shade themselves, and the ground pads under every structure had
// receiving explicitly turned OFF. That is the whole of "the units look like stickers".
//
// This is FREE by the metric that binds this project. In r128 receiveShadow is a per-object
// `uniform bool` (lights_pars_begin), NOT a program define — USE_SHADOWMAP is renderer-level, so
// the 9-tap PCF is already compiled into every lit material and the bool only decides whether to
// short-circuit it. Measured at the wood/road/base vantages: 620 draw calls and 48 programs both
// before and after, identical to the digit. The only cost is fill — 1.78x more shadow-sampled
// fragments — which does not show up in draw calls but is real on a phone. It is why Battery
// Saver's `renderer.shadowMap.enabled=false` (12-touch.js) matters more now, not less.
function box(w,h,d,c){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.castShadow=true;m.receiveShadow=true;return m;}
function cone(r,h,c,seg){const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,seg||5),mat(c));m.castShadow=true;m.receiveShadow=true;return m;}
function cyl(rt,rb,h,c,seg){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||7),mat(c));m.castShadow=true;m.receiveShadow=true;return m;}

// ---------- glTF model registry (async; hot-swaps units when loaded) ----------
// Embedded MODEL_DATA (base64 script) is preferred: fetch() is blocked on file://,
// so URL loading only works when the game is served over http.
const MODELS={};
(function loadModels(){
  if(typeof THREE.GLTFLoader==="undefined")return;
  const L=new THREE.GLTFLoader();
  const onDone=(cls,cfg)=>g=>{
    MODELS[cls]={scene:g.scene,clips:g.animations||[],cfg};
    for(const u of units)if(u.cls===cls)buildBodyFor(u); // swap live units
    console.log("[models] loaded",cls,"clips:",(g.animations||[]).map(c=>c.name).join(", "));
    if(typeof msg==="function")msg("Character model loaded: "+(CLS[cls]?CLS[cls].name:cls),"blue");
  };
  for(const cls in MODEL_MANIFEST){
    const cfg=MODEL_MANIFEST[cls];
    const b64=(window.MODEL_DATA||{})[cls];
    if(b64){
      const bin=atob(b64),buf=new ArrayBuffer(bin.length),v=new Uint8Array(buf);
      for(let i=0;i<bin.length;i++)v[i]=bin.charCodeAt(i);
      L.parse(buf,"",onDone(cls,cfg),err=>console.warn("[models] parse failed:",cls,err));
    }else{
      L.load(cfg.file,onDone(cls,cfg),undefined,err=>console.warn("[models] fetch failed (file:// blocks this — embed it with tools/embed_model.py):",cfg.file,err));
    }
  }
})();

// ---------- procedural pixel-art textures (DOS-era surfaces, zero asset files) ----------
function makePixelTexture(px,palette,speckles){
  const c=document.createElement("canvas"); c.width=c.height=px;
  const ctx=c.getContext("2d");
  for(let y=0;y<px;y+=2)for(let x=0;x<px;x+=2){
    ctx.fillStyle=palette[(Math.random()*palette.length)|0];
    ctx.fillRect(x,y,2,2);
  }
  if(speckles)for(const [col,n] of speckles)for(let i=0;i<n;i++){
    ctx.fillStyle=col;
    ctx.fillRect(((Math.random()*px)|0)&~1,((Math.random()*px)|0)&~1,2,2);
  }
  const t=new THREE.CanvasTexture(c);
  t.encoding=THREE.sRGBEncoding; // proper color depth — no more washed-out pale ground
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.generateMipmaps=false;
  return t;
}
// v128: the old palette was five near-identical olive-drabs with grey-beige speckle — meadow in
// drizzle, not meadow in June. Same VALUES, pushed hard toward yellow-green, which is what reads
// as "lush" rather than "wet". The speckle is warmer too: light flecks are sunlit blades now.
// …and the speckle counts came DOWN hard at the same time. Saturating the palette turned what had
// been quiet grey-beige noise into confetti — the ground read as television static rather than
// grass. Lush is not the same as busy: the base tones sit close together so the lawn reads as ONE
// surface, and the flecks are few enough to be flowers instead of interference.
// v130.1 THE LOUDEST OBJECT IN THE GAME WAS THIS SWATCH.
// It is not a decoration — the terrain material is white with this as its map, so these five hexes
// ARE the albedo of 50–65% of every frame, and they were a nuclear kelly green: #79ad4a measures
// S 0.42 / L 0.49 before the grade, and the grade's ×1.12 saturation then pushes the sunlit midfield
// to S 0.50, over §2.2's hard ceiling of 0.45 and above the saturation of any unit standing on it.
// The whole value hierarchy in §0 is inverted by this one swatch: the stage was shouting louder
// than the actors. Re-authored around §2.2's grass.base #6B8C33, pulled a few points off the
// saturation to leave room for the grade to push it back UP to the swatch (measured: authored
// S 0.36 lands at S 0.42 on screen), and the five tones sit closer together so the lawn reads as
// ONE surface rather than a quilt.
// 96 -> 128 IS NOT COSMETIC. 96 is not a power of two, and r128's WebGL1 upload path silently
// resizes an NPOT texture with RepeatWrapping down to 64 with a bilinear drawImage — so the
// hand-placed pixel art was being destroyed on exactly the older-Android population the 0.6 near
// plane exists for. 128 uploads as authored.
const grassTex=makePixelTexture(128,
  ["#667A3E","#61753A","#6C8043","#5D7137","#708447"],
  [["#7A8F4C",60],["#4F6631",55],["#8A8F52",8],["#A8563F",3],["#C6CFA8",3]]);
grassTex.repeat.set(46,30);
// ...and THE TELEVISION STATIC. At repeat 46×30 over a 534×450 plane this texture is ~0.12 world
// units per texel — far under one screen pixel at any play distance — so NearestFilter with no
// mipmaps was point-sampling a random texel per pixel every frame. That is the hard checkerboard
// quilt visible across the ground in every baseline shot; it is aliasing, not grass.
// Mipmaps fix it at range while NearestFilter on MAGnification keeps the pixel art crisp up close,
// which is the whole reason the swatch exists. Anisotropy keeps the far ground from smearing to
// mud at grazing angles, which is most of the frame in a third-person shot.
// PATCHED HERE, NOT IN makePixelTexture (§10.14): that factory is shared by every 16px unit skin,
// building skin and heraldry cell, all of which are deliberately unmipped for the atlas.
grassTex.generateMipmaps=true;
grassTex.minFilter=THREE.LinearMipmapLinearFilter;
grassTex.magFilter=THREE.NearestFilter;
try{grassTex.anisotropy=renderer.capabilities.getMaxAnisotropy();}catch(_){}

// ---------- sky dome + sun (bloom feeds on this) ----------
// SUN_DIST parks the painted sun just inside the dome. The dome is radius 700 about (cam.x,0,cam.z)
// and the sprite hangs off the camera, so the worst case is a camera 60 up looking from the map
// edge: sqrt(400² + 530²) = 664 — inside the shell, and a long way inside camera.far (1200).
// SUN_ANG is the disc's angular size in radians; scale = distance × angle keeps it the same size on
// screen wherever you stand, which is the entire reason it is not a fixed world position any more.
// SUN_ANG is the whole sprite including its halo, not the bright core — the core is the first 14%
// of that radius (see the falloff below), so 0.13 rad draws an 80px glow around a 22px disc in a
// 620px-high frame. Sized by looking: at 0.075 the first render came back as a pinprick that read
// as a distant planet, because a steep falloff spends most of the quad on alpha the eye cannot see.
const SUN_DIST=620, SUN_ANG=0.13;    // 0.13 rad ≈ 7.4°, an ~80px sprite in a 620px-high frame
let skyDome=null, sunSpr=null;
(function buildSky(){
  const geo=new THREE.SphereGeometry(700,20,12);
  // v130.1 THREE STOPS, AND THE BOTTOM ONE IS scene.fog.color TO THE BYTE.
  // Two things were wrong here and they compounded. The horizon stop (0xcdeeff) did not match the
  // fog (0xbfe4ff), so the far field and the sky it fades into were different colours — §4.3 calls
  // that non-negotiable and it is, because the moment they diverge distant geometry stops
  // dissolving and starts being cut out. And the two-stop ramp spent its whole range on pale: at
  // y*1.35 the dome is already 47% of the way to `top` by 35° of elevation, and `top` was itself a
  // light cyan, so the sky had no dark end anywhere and the upper half of a wide shot was milk.
  // §2.1's ladder — #BFD6E6 at the horizon, #6FA6DC at y=0.35, #2E6FB8 at the zenith — is 0.82 →
  // 0.63 → 0.42 screen value. That is a real gradient with a dark end, and the dark end is what
  // gives the frame the value spread §1.1 says it does not have.
  // The two-segment mix is deliberate: one linear ramp from horizon to zenith would put the mid
  // tone at y=0.5 and leave the band just above the treeline — the band a player actually looks
  // at — flat. Breaking at 0.35 puts the colour change where the picture is.
  // KEEP THIS MATERIAL RAW. No <tonemapping_fragment>, no <encodings_fragment>: it writes literal
  // sRGB, which is exactly why it can equal scene.fog.color (applied after the encode, see
  // fog_fragment's position in meshtoon_frag). Tone mapping the dome would darken the largest
  // region of every frame AND break the horizon match (§10.17).
  const skyMat=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:new THREE.Color(0x2E6FB8)},mid:{value:new THREE.Color(0x6FA6DC)},
              horizon:{value:new THREE.Color(0xBFD6E6)}},
    vertexShader:"varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"uniform vec3 top;uniform vec3 mid;uniform vec3 horizon;varying vec3 vP;"+
      "void main(){float y=normalize(vP).y;"+
      "vec3 col=y<0.35?mix(horizon,mid,clamp(y/0.35,0.0,1.0))"+
      ":mix(mid,top,clamp((y-0.35)/0.65,0.0,1.0));"+
      // below-horizon falloff: hold the fog colour through the first few degrees so the seam where
      // the ground plane ends is invisible, and only then drop away. 0.72 was a hard step into a
      // grey band you could see under the treeline on any wide shot.
      "col=mix(col,horizon*0.90,smoothstep(0.0,-0.34,y));"+
      "gl_FragColor=vec4(col,1.0);}"
  });
  skyDome=new THREE.Mesh(geo,skyMat);
  skyDome.frustumCulled=false; // never clips into a black hole
  skyDome.renderOrder=-1;
  scene.add(skyDome);
  scene.background=null;
  // v130.3 THE PAINTED SUN WAS NAILED TO A WORLD POINT AND THE LIGHT WAS NOT.
  // The sprite sat at world (150,210,100) for ever while renderFrame re-parks the DirectionalLight
  // to (player.x+120, 168, player.z+80) every frame — so walking 400 units swung the visible sun
  // right across the sky while every shadow in the game kept pointing exactly where it always had
  // (ART-DIRECTION §3.5). At the blue Town Centre, 175 units out, the disc and the light were about
  // 40° apart. It is now placed off the LIVE light vector in the sky hook below, at a fixed
  // distance from the camera, which is the sun-at-infinity model the shadows already assume.
  //
  // AND IT WAS A SQUARE. An untextured SpriteMaterial is a flat quad, so 70×70 of additive #ffdf9a
  // over a bright sky clipped to a WHITE RECTANGLE with hard corners. Nobody caught it because the
  // old fixed position happens to sit behind the camera in all six vista shots — but the moment the
  // disc follows the light it is in frame the instant a player turns east. So: a plateau and a
  // curve. The plateau is the disc, the curve is the halo, and the halo's exponent is the only
  // thing standing between "a sun" and "a smudge on the sky" — the first pass used a bare alpha^2.2
  // with no plateau and rendered a 20px pinprick that read as a distant planet, because a steep
  // curve spends most of the quad on alpha the eye cannot see.
  //
  // AND IT IS NOT ADDITIVE, which was the second thing I got wrong by reaching for the obvious.
  // Additive is the reflex for a light source and it is wrong over THIS sky: the dome sits around
  // (0.45, 0.65, 0.85) at the elevation the sun occupies, so ANY meaningful addition saturates blue
  // first and the disc resolves to a cold white-cyan blob — the exact opposite of the warm sun the
  // rig is lit by, and exactly what the first sun-facing render came back with. Straight alpha over
  // the sky writes §2.1's #FFE9A8 as itself; bloom then lifts the core to about #FFFFBE, which is
  // still warm, still not white, and still clear of F1. Measured on a shot taken straight into the
  // sun: 0.03% of pixels clipped in any channel, 0% in all three, against §3.6's 2% / 0.5%.
  //
  // Painted per texel rather than with createRadialGradient, and that is not a style preference:
  // tools/smoketest.js stubs the 2D context with a Proxy that answers every unknown method with a
  // no-op returning undefined, so `createRadialGradient(...).addColorStop()` throws LOAD FAIL and
  // takes all fourteen files down with it. Every other texture factory in this file (makeToonRamp,
  // makePixelTexture) fills with fillRect for the same reason. 4096 fills, once, at load.
  const sc=document.createElement("canvas"); sc.width=sc.height=64;
  const sctx=sc.getContext("2d");
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const dx=x+0.5-32, dy=y+0.5-32, t=Math.sqrt(dx*dx+dy*dy)/32;
    const a=t>=1?0:(t<0.16?1:Math.pow(1-(t-0.16)/0.84,2.0));
    if(a<=0)continue;
    sctx.fillStyle="rgba(255,233,168,"+a.toFixed(3)+")"; // §2.1 sun.disc #FFE9A8
    sctx.fillRect(x,y,1,1);
  }
  const sunTex=new THREE.CanvasTexture(sc);
  // TAGGED sRGB, unlike the toon ramp two hundred lines up, and for the opposite reason: this one
  // IS a colour to be displayed, not a lookup into lighting. r128 decodes it to linear on sample
  // and <encodings_fragment> re-encodes on output, so the hex authored above is the hex that lands
  // in the buffer. Leave it untagged and the disc renders at c^(1/2.2) — a pale cream that is not
  // the palette entry it claims to be.
  sunTex.encoding=THREE.sRGBEncoding;
  sunTex.generateMipmaps=false; sunTex.minFilter=sunTex.magFilter=THREE.LinearFilter;
  sunSpr=new THREE.Sprite(new THREE.SpriteMaterial({
    map:sunTex,color:0xffffff,transparent:true,opacity:1.0,fog:false,depthWrite:false,
    // toneMapped:false for the same reason the dome and the clouds opt out — exposure 0.50 is a
    // dial sized against IRRADIANCE, and an unlit material never receives any, so tone mapping one
    // just halves the authored value. A sun at half brightness is a lamp.
    toneMapped:false}));
  sunSpr.scale.set(SUN_DIST*SUN_ANG,SUN_DIST*SUN_ANG,1);
  sunSpr.renderOrder=-1;              // behind everything transparent; it is at 620 units, not here
  scene.add(sunSpr);
})();

// ---------- drifting clouds + floating dust motes (the fairy-tale layer) ----------
const clouds=[];
// The drift in 09-main.js wraps a cloud from +CLOUD_WRAP back to -CLOUD_WRAP. It lives here, next
// to the ring the clouds are seeded on, because the only thing that makes it correct is being
// LARGER than that ring's outer radius (340 below) — as a bare 300 in the other file it silently
// teleported the outermost clouds across the sky on the first frame.
const CLOUD_WRAP=360;
// ART-DIRECTION §4.5: "the cloud field follows the camera in x/z the way the sky dome does, so the
// sky is never empty at the map edges." It did not, which is half of why 06-wide's sky was bare.
// The field is one parent Group so that pinning it is one write; the drift in 09-main.js keeps
// working untouched because each cloud's ±300 wrap is now in the field's local space.
const cloudField=new THREE.Group(); scene.add(cloudField);
(function buildClouds(){
  // v130.1 THE FLOATING GREY-GREEN ROCKS. These were MeshLambertMaterial with fog ON, which meant
  // two things at once, both bad. Lambert lit them — and the only light reaching an object 70 units
  // up with nothing above it is the hemisphere, whose GROUND colour is grass-green, so every cloud
  // in the game was lit FROM BELOW by a lawn and came out as a grey-green boulder with a shaded top
  // (plainly visible in _baseline_v129.4/06-wide.png and unchanged through wave1). And fog then
  // pulled them toward the horizon colour by altitude, so a cloud overhead and a cloud at the map
  // edge were different colours for no reason a viewer could read.
  // ART-DIRECTION §4.5: flat MeshBasicMaterial, fog:false. Unlit and unfogged is not a shortcut
  // here, it is the correct model — a cloud is a bright flat shape on a gradient, and any attempt
  // to shade it with the scene's rig will always be shaded by whatever is underneath it.
  // The top/underside split comes from vertex colour instead of a second material, so the puffs
  // still share one material and still cost nothing extra.
  //
  // v130.4 THE GREY POLYSTYRENE. §4.5 asks for #FFFFFF over #CFE0EE and this buffer cannot print
  // the top half of that, so read the arithmetic before "correcting" these two hexes back to the
  // swatch. The post stack is a CLIFF, not a curve: UnrealBloomPass's high pass is
  // smoothstep(0.86, 0.87, luma) against the sRGB-ENCODED target, and the composite adds back
  // about 0.9× of the bright pass anywhere the bright region is wider than the blur — so a cloud
  // authored one level over the threshold does not come out brighter, it comes out CLIPPED and it
  // haloes the sky around itself. That is the #EFF4FA experiment: off the screen at #FFFFF7, red
  // and green both clipped, the whole field glowing. §10.22 / F1 auto-fail a >200px² pure white on
  // top of that. And the FLOOR is the sky itself — the horizon band measures 0.81 luma, while the
  // shade tone this replaces sat at 0.746, DARKER than the sky it was drawn on. A cloud that goes
  // negative against its own background is not a cloud, it is a hole, which is exactly what the
  // critic read as grey polystyrene.
  // So the entire cloud has to live between 0.82 and 0.855 luma — eight levels — and the form
  // therefore has to come from HUE, not value: a white crown over a sky-bounced blue underside
  // (201/217/230 on screen, seven off §4.5's #CFE0EE and the closest the buffer reaches). Neutral
  // against cool at equal value still reads as a lit top. Dark against light does not read at all
  // when the dark end is below the sky.
  //
  // v130.6 …AND THE HUE BUDGET WAS SPENT ON THE WRONG HUE. A crown authored to sit warm measured
  // 229/217/200 — cream, twenty-nine levels of red over blue — and fourteen of them strung round
  // the compass tint the ENTIRE WIDTH of the sky in 06-wide and 01-meadow, which is a warm accent
  // the size of the frame against §8.5's "one per frame, not more than three". §2.1 authors the
  // pair neutral-to-cool (#FFFFFF over #CFE0EE), so the swing now runs neutral-white crown over
  // blue belly. That HALVES the red-to-blue separation — 29 levels against the cream crown's 58 —
  // and the belly is left carrying all of it, which is the trade and it is worth making: a lit top
  // that is neutral IS the swatch, and the form it buys by going warm is bought with the frame's
  // only warm accent. Do not buy it back by tilting the crown COOL either: a cool crown over a
  // warmer belly inverts the light and the cloud reads as a hole again.
  // THIS HEX LOOKS COOL AND IS NOT. Do not "correct" 214/218/224 to a grey: the grade is a warm
  // tilt applied to whatever it is handed — ×1.12 saturation about luma, then ×(1.02,1.00,0.97) —
  // so an authored neutral arrives warm and an authored warm arrives warmer (that is how
  // 229/217/200 happened; #E0D9CF is seventeen levels of red over blue on paper and lands as
  // twenty-nine). Dividing through it first is what puts 218/218/218, dead neutral, on screen.
  // AND IT CANNOT GO TO #FFFFFF, which is now measured rather than argued: authoring the top at
  // #FAFFFF — white, grade-compensated, exactly what the swatch asks for — renders ONE cloud's
  // crown as 3331 flat pixels of #FFFFF7 with every fold gone and a glow bled 30px into the sky
  // around it, and clips 1.7%/1.9% of the whole frame in R/G against F8's 2% ceiling, on a field
  // whose placement is unseeded random so the next run is the one that trips it. §10.22 is written
  // about precisely this ("clip to flat white, lose every fold, and trigger bloom"). 218 is the
  // ceiling the buffer prints, not a preference: luma 0.853, and the bloom cliff is at 0.86.
  const CLOUD_TOP=srgb(0xD6DAE0), CLOUD_BASE=srgb(0xC6D9EC);
  // toneMapped:false, and it is not optional. Exposure is 0.60 — a linear-light dial sized against
  // the IRRADIANCE the ramp's top band expects once the sun's 1.55 and the sky's 0.45 are counted
  // (see the derivation at the top of this file). An UNLIT material never receives any of that, so
  // LinearToneMapping just multiplies it by 0.6 and a cloud authored at 0.94 renders at 0.56 —
  // mid-grey. First pass at this shipped exactly that and the clouds went from grey-green rocks to
  // grey rocks. Opting out makes MeshBasicMaterial write its literal authored value, the same deal
  // the sky dome has, which is the only way a flat unlit surface can be trusted to be the colour
  // it says it is.
  const cloudMat=new THREE.MeshBasicMaterial({vertexColors:true,fog:false,toneMapped:false});
  // v130.2 §4.5 SAYS "MERGED PER GROUP: 8 DRAW CALLS, NOT 32", AND IT WAS 32. Each group hung
  // three to five separate puff meshes off a Group, all on one material, all static for ever — the
  // textbook case for welding. Welding them pays for the OTHER half of the fix: eight groups is not
  // enough sky. A 1100×620 frame at fov 58 spans 89° horizontally, so eight clouds spread evenly
  // round the compass put ~2 in shot before elevation is even considered, and the first render of
  // the camera-following field came back with ZERO clouds in 06-wide — a straight regression on the
  // very shot §8.2 is about. Fourteen merged groups cost 14 draw calls where 8 unmerged cost ~32,
  // so the sky gets 75% more content for eighteen calls BACK.
  const _weld=list=>{ // one static group -> one geometry; POSITIONS ONLY
    // The normal buffer these puffs ship with is dead weight: meshbasic_vert only pulls
    // <beginnormal_vertex> in under USE_ENVMAP, and there is no envmap here, so every normal
    // uploaded was uploaded to be ignored. Colours are painted AFTER the weld now — see below —
    // so they cannot be concatenated here either.
    let n=0; for(const g of list)n+=g.attributes.position.count;
    const pos=new Float32Array(n*3);
    let o=0;
    for(const g of list){
      pos.set(g.attributes.position.array,o*3);
      o+=g.attributes.position.count; g.dispose();
    }
    const out=new THREE.BufferGeometry();
    out.setAttribute("position",new THREE.BufferAttribute(pos,3));
    return out;
  };
  const _c=new THREE.Color();
  for(let i=0;i<14;i++){
    // …AND ALL FOURTEEN WERE THE SAME SLAB. Every group used to be 3–5 puffs of r7–14 under one
    // 1.6/0.5/1 squash, which is a single silhouette stamped out fourteen times — and fourteen
    // copies of one shape read as one prop repeated, not as weather. Scale and count come off the
    // same per-cloud draw on purpose: a cloud that is bigger but no longer just reads as the same
    // cloud standing closer. (Unseeded native Math.random — 02-world.js does not install the
    // network RNG until it loads, so nothing here is on the wire and the call count is free.)
    const h=Math.random(), size=0.80+h*1.32, lobes=3+((h*3.2)|0), R=size*5.6, parts=[];
    // v130.5 …AND VARYING THE SIZE DID NOT SAVE THEM, BECAUSE THE SHAPE WAS NEVER ABOUT SIZE.
    // The lobes were spaced a full diameter apart (`size*puffs*5.6` across `puffs` of them) so each
    // one only KISSED its neighbour, and every one was squashed to 0.45–0.70 of its own height. A
    // row of flat hexagons touching at the hips is a SLAB with a bumpy edge — that is what came
    // back in shot-06-wide, and fourteen slabs at fourteen sizes still read as one prop repeated.
    // The outline is the entire drawing here: an unlit surface has no shading of its own, and the
    // 0.855 crown over the 0.838 underside is four levels, which cannot describe a form. So overlap
    // the lobes by 40% instead of kissing them — the union scallops where they cut — and ride a
    // smaller crown row on top so the upper edge billows instead of running flat. Both are free:
    // still one merged mesh on one material, and the crown row costs ~50 triangles a cloud — 700
    // across the whole field, against a scene that draws 200,000.
    const rad=[]; let span=0;
    for(let p=0;p<lobes;p++){
      // fat in the middle, tapered at the ends — a cumulus profile instead of a sausage
      rad.push(R*(0.50+0.66*Math.sin(Math.PI*((p+0.5)/lobes)))*(0.85+Math.random()*0.30));
      if(p)span+=0.60*(rad[p-1]+rad[p]); // 0.60 of the two radii: they cut each other by 40%
    }
    let x=-span*0.5, yTop=0;               // centred, or the merged bound sphere culls off-centre
    for(let p=0;p<lobes;p++){
      if(p)x+=0.60*(rad[p-1]+rad[p]);
      const r=rad[p], fy=0.60+Math.random()*0.20;
      let geo=new THREE.IcosahedronGeometry(r,0);
      if(geo.index)geo=geo.toNonIndexed(); // the weld is flat-array concatenation; no index to fix up
      // twelve identical hexagons all facing one way read as a crystal. The X tilt costs nothing on
      // a near-sphere except which facet lands on the silhouette, which is the only thing that reads
      geo.rotateY(Math.random()*Math.PI*2); geo.rotateX((Math.random()-0.5)*0.8);
      geo.scale(1.0+Math.random()*0.25,fy,0.90+Math.random()*0.35); // squash bakes in, it is not a transform
      // THE BELLY IS THE FACE THIS GAME ACTUALLY SEES. Clouds sit at y 48–86 and the player eye is
      // at 7, so every one of them is viewed from underneath at 8–38° — a row of lobes whose bottoms
      // are RULED level presents one flat plane to that camera and reads as a slab however good the
      // top silhouette is (it did: pitched-up renders came back with a clean polygonal raft). Hang
      // them at different depths and the belly scallops from below the way the outline does side-on.
      // The ramp stays continuous through it because it is a function of height in the finished
      // cloud, so a lobe that hangs lower simply takes more of the base tone.
      const cy=r*fy*(0.62+Math.random()*0.52);
      // …and spread them in Z as hard as in X, or the cloud is a BAR: seen end-on from the eighth of
      // the compass it happens to point at, a straight row foreshortens into a diagonal streak.
      geo.translate(x,cy,(Math.random()-0.5)*R*1.5);
      if(cy+r*fy>yTop)yTop=cy+r*fy;
      parts.push(geo);
    }
    const crown=1+((lobes*0.62)|0);
    for(let p=0;p<crown;p++){
      const r=R*(0.40+Math.random()*0.26), fy=0.66+Math.random()*0.22;
      let geo=new THREE.IcosahedronGeometry(r,0);
      if(geo.index)geo=geo.toNonIndexed();
      geo.rotateY(Math.random()*Math.PI*2); geo.rotateX((Math.random()-0.5)*0.8);
      geo.scale(1.0+Math.random()*0.30,fy,0.90+Math.random()*0.30);
      // Sunk two thirds into the row it rides — what clears the base is a cap, not a ball — and
      // kept inside the middle half of the span, so it crowns the cloud instead of lengthening it.
      geo.translate((crown>1?p/(crown-1)-0.5:0)*span*0.52+(Math.random()-0.5)*R*0.35,
                    yTop-r*fy*(0.34+Math.random()*0.26),
                    (Math.random()-0.5)*R*0.9);
      parts.push(geo);
    }
    const geo=_weld(parts);
    // THE RAMP IS A FUNCTION OF THE WELDED CLOUD, NOT OF EACH PUFF, and that is the seam fix.
    // Colouring off each puff's own face normal put a hard lit/shade step exactly on that puff's
    // equator — so wherever two puffs interpenetrate, the step drew the intersection curve as a
    // straight hard diagonal across the slab, splitting every cloud in the game into two planes
    // (unmissable in any shot-05-lowsun.png before this). A colour that depends only on WHERE a
    // vertex sits in the finished cloud agrees on both sides of any intersection, so the puffs
    // weld optically as well as in the buffer. Continuous across faces too, because the
    // non-indexed duplicates share their positions — and no facets are wanted here: an unlit
    // surface has no shading of its own to fake, so a hard step is just a line, not a form.
    const pa=geo.attributes.position, cnt=pa.count, ca=new Float32Array(cnt*3);
    let lo=Infinity, hi=-Infinity;
    for(let v=0;v<cnt;v++){const y=pa.getY(v); if(y<lo)lo=y; if(y>hi)hi=y;}
    const inv=1/Math.max(0.001,hi-lo);
    for(let v=0;v<cnt;v++){
      // The underside is what a ground camera actually sees — clouds sit at y 48–86 and the player
      // eye is at 7 — so the ramp spends its first tenth flat on the base tone and finishes early,
      // leaving the crown to read as one lit mass rather than a gradient fading out at the top.
      let u=((pa.getY(v)-lo)*inv-0.10)/0.55; u=u<0?0:u>1?1:u; u=u*u*(3-2*u);
      _c.copy(CLOUD_BASE).lerp(CLOUD_TOP,u); // both already through srgb(); the lerp is in linear
      ca[v*3]=_c.r; ca[v*3+1]=_c.g; ca[v*3+2]=_c.b;
    }
    geo.setAttribute("color",new THREE.BufferAttribute(ca,3));
    const g=new THREE.Mesh(geo,cloudMat);
    g.rotation.y=(Math.random()-0.5)*1.2; // every cloud's long axis was world +x, the drift direction
    // …AND THEY WERE ALL IN ONE CORNER. Fourteen groups dropped at uniform random over a 520×320
    // rectangle still CLUSTER — that is what uniform random does at small sample sizes, and 06-wide
    // duly came back with three cloud shapes crammed into the top-left and nothing over the other
    // two thirds. A jittered ring guarantees one cloud per 26° of azimuth whichever way the camera
    // faces. The ALTITUDE band matters as much as the azimuth: the frame's top edge sits about 4°
    // above the horizontal from the wide vantage, so a cloud only lands in shot if it is under
    // roughly (cameraY + 0.07 × radius). 48–86 over radius 110–340 keeps most of the field inside
    // that wedge instead of parked directly overhead where nothing but a phone in portrait sees it.
    // (This is unseeded native Math.random — 02-world.js does not install the network RNG until it
    // loads, so nothing here is on the wire and the call count is free.)
    const a=(i+Math.random()*0.8)*Math.PI/7, rr=110+Math.random()*230;
    g.position.set(Math.cos(a)*rr,48+Math.random()*38,Math.sin(a)*rr);
    g.frustumCulled=true;
    cloudField.add(g); clouds.push(g);
  }
})();
let dustPts=null;
(function buildDust(){
  // v130.2 …AND THEY WERE STILL CONFETTI, because quieting them was treating the symptom. A mote
  // is an ADDITIVE 1-pixel splat: gl_PointSize clamps to one pixel at the low end, so distance
  // never dims one, and r128 fogs a Points material by mixing its colour TOWARD fog.color — which
  // under additive blending means a distant mote adds most of the fog colour on top of the fog and
  // resolves to a clipped white speck. Two hundred of them projected into the horizon band and read
  // as snow. Spreading them over the whole 212×125 map was the actual mistake: this is a
  // catch-the-light layer for the near field, so it now lives in a 48-unit box that rides with the
  // camera (see the sky hook below). Same 260 motes, all of them where they do their job, none of
  // them in the fog.
  // v131.11 JOHN, THIRD TIME: "can we tone down the sparkly ambient floater things?" — and the two
  // notes above are the first two attempts, so this one moves the numbers that were never moved
  // rather than re-arguing the blend mode. What actually makes a mote sparkle is that gl_PointSize
  // clamps at ONE PIXEL: past ~18 units the computed size is already sub-pixel, so sizeAttenuation
  // stops attenuating anything and every far mote is a full-brightness additive dot. You cannot fix
  // that with opacity alone; you fix it with FEWER of them, LOWER, and dimmer.
  //   count   260 -> 110   (the horizon band gets less than half as many splats projected into it)
  //   ceiling 6.6 ->  4.2  (they stay in the near field where they catch light, out of the sky)
  //   opacity 0.22 -> 0.10
  // Kept: additive, which is the whole point of a catch-the-light layer, and the 48-unit box that
  // rides the camera. Named so the next pass can turn one dial instead of hunting three literals.
  const DUST_N=110, DUST_BOX=48, DUST_LOW=0.5, DUST_HIGH=4.2;
  const N=DUST_N, pos=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    pos[i*3]=(Math.random()*2-1)*DUST_BOX;
    pos[i*3+1]=DUST_LOW+Math.random()*(DUST_HIGH-DUST_LOW);
    pos[i*3+2]=(Math.random()*2-1)*DUST_BOX;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  // v130.1 THE MOTES BECAME LITTER THE MOMENT THE FOG STOPPED BEING WHITE. Additive blending means
  // these ADD to whatever is behind them, so against a bright far field a near-white mote at 0.4
  // opacity resolves to a hard white speck — and from an elevated vantage a couple of hundred of
  // them project straight into the fog band and read as confetti scattered across the distance
  // (plainly visible in 06-wide). Warmer and quieter: they still catch the light in a close shot,
  // which is the whole point of the layer, without punching holes in the horizon.
  dustPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xffe0a0,size:0.26,transparent:true,
    opacity:0.10,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  scene.add(dustPts);
})();
// THE ATMOSPHERE RIDES WITH THE CAMERA, AND IT HAS TO DO IT FROM IN HERE.
// The per-frame hook that used to pin the sky lived in 09-main.js, and it is frozen by tools/vista.js
// (which stubs requestAnimationFrame so a shot renders from its own camera, not the loop's) — so
// anything bound there is invisible to every render this overhaul is judged on, and would also be a
// lie about what the game does. Binding it to the SCENE fixes both: r128 calls
// `scene.onBeforeRender` from WebGLRenderer.render itself, so it runs in the game, in vista.js, in
// drawcost.js and in the smoketest, whichever camera is doing the rendering.
//
// v130.3 AND IT MUST BE THE SCENE'S HOOK, NOT THE DOME'S — that distinction is the whole bug.
// This started life on skyDome.onBeforeRender, which is called from renderObject, i.e. AFTER
// projectObject has already frustum-culled and depth-sorted the whole list against LAST frame's
// matrices. Moving a sibling from there is too late for its own culling test: the clouds are
// frustumCulled (they must be, 14 of them ring the map) and were being tested at wherever the field
// stood on the previous render. In the game that is one frame of camera drift and invisible; in
// vista.js, which teleports the camera 200 units and renders exactly once, it is the difference
// between a sky with clouds in it and an empty one — the "zero clouds in 06-wide" that got chased
// as a placement problem. In this build (three.min.js, r128) the order inside render() is
// `scene.onBeforeRender` → renderList.init → projectObject, so everything moved here is culled at
// the position it will actually be drawn at.
const _sunV=new THREE.Vector3();
scene.onBeforeRender=function(r,sc,cam){
  if(!cam||!cam.isCamera)return;
  // FIRST, because the sun disc below is derived from the light vector this moves, and because
  // r128 runs this hook before renderList.init and before shadowMap.render — which is the only
  // window in the frame where moving the light still reaches this frame's shadow map. It is also
  // AFTER scene.updateMatrixWorld(), which is why aimShadow updates the light's matrices by hand.
  aimShadow(cam);
  const cx=cam.position.x, cz=cam.position.z;
  if(skyDome&&(skyDome.position.x!==cx||skyDome.position.z!==cz)){
    skyDome.position.set(cx,0,cz); skyDome.updateMatrixWorld(true);
  }
  if(cloudField.position.x!==cx||cloudField.position.z!==cz){
    cloudField.position.set(cx,0,cz); cloudField.updateMatrixWorld(true);
  }
  if(dustPts&&(dustPts.position.x!==cx||dustPts.position.z!==cz)){
    dustPts.position.set(cx,0,cz); dustPts.updateMatrixWorld(true);
  }
  // THE DISC GOES WHERE THE LIGHT COMES FROM, every frame, derived rather than authored.
  // sun.position minus sun.target.position IS the shadow direction — the same two vectors r128
  // hands to the shadow camera — so reading it here means the painted sun can never drift out of
  // agreement with the shadows again, whoever moves the light and for whatever reason. The sprite
  // hangs off the CAMERA rather than the world for the same reason the dome does: a disc parked at
  // a world point is 220 units away, so it slides behind mountains and parallaxes as you walk,
  // which reads as a lamp on a pole. At a fixed offset from the eye it reads as a sun at infinity.
  if(sunSpr&&typeof sun!=="undefined"&&sun){
    _sunV.copy(sun.position); if(sun.target)_sunV.sub(sun.target.position);
    if(_sunV.lengthSq()>1e-6){
      _sunV.normalize();
      sunSpr.position.copy(cam.position).addScaledVector(_sunV,SUN_DIST);
      sunSpr.updateMatrixWorld(true);
    }
  }
};

// ---------- post stack: bloom + grade + vignette ----------
let composer=null;
if(typeof THREE.EffectComposer!=="undefined"){
  composer=new THREE.EffectComposer(renderer);
  // v130 THE FIX. `renderer.outputEncoding=sRGBEncoding` up at the top has never once executed on
  // the shipping path. r128 decides a program's output encoding from the render target that is
  // BOUND when the material compiles, falling back to the renderer only when the target is null
  // (WebGLPrograms.getParameters). EffectComposer ping-pongs two WebGLRenderTargets and both were
  // LinearEncoding, so <encodings_fragment> compiled to LinearToLinear — a no-op — for every lit
  // material in the game. Consequence: every sRGB-tagged texture was decoded on sample and never
  // re-encoded, so all 103 atlas skins, every building texture and the ground rendered ~c^2.2
  // darker and more saturated than the flat-colour material sitting against them. Half this
  // project's palette was then hand-tuned to compensate, which is why the comment on
  // makePixelTexture below cheerfully calls the error "proper color depth".
  // Tagging the targets is the whole fix. It costs nothing — it changes which branch of
  // linearToOutputTexel the shader compiles, not how many there are.
  // DO NOT also add GammaCorrectionShader (ART-DIRECTION §10.5): that is the OTHER, mutually
  // exclusive fix and running both double-gammas the frame. The passes below are safe from it
  // because a ShaderPass's fragment shader has no <encodings_fragment> of its own, so the encode
  // happens exactly once, in the scene render, and every later pass carries it through untouched.
  composer.renderTarget1.texture.encoding=THREE.sRGBEncoding;
  composer.renderTarget2.texture.encoding=THREE.sRGBEncoding;
  composer.addPass(new THREE.RenderPass(scene,camera));
  // v130 HALF RESOLUTION, AND RETHRESHOLDED FOR AN ENCODED BUFFER.
  // UnrealBloomPass already halves whatever it is handed, so this is a quarter-area blur chain —
  // 11 passes of fill on 590x273 was the single most expensive thing in the post stack on the
  // phone and it is bloom, the one effect nobody can point at. Free money.
  // The threshold move is not taste, it is arithmetic: the pass now reads an sRGB-encoded buffer,
  // where a mid-grey sits at 0.5 instead of 0.2. 0.92 in linear was keying off snow caps and
  // canvas; 0.86 in sRGB keys off the same physical brightness the old number was aiming at.
  const bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth*0.5,innerHeight*0.5),0.30,0.45,0.86);
  composer.addPass(bloom);

  const grade=new THREE.ShaderPass({
    uniforms:{tDiffuse:{value:null}},
    vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"uniform sampler2D tDiffuse;varying vec2 vUv;void main(){"+
      "vec4 c=texture2D(tDiffuse,vUv);"+
      "float l=dot(c.rgb,vec3(0.299,0.587,0.114));"+
      // v128: the grade is where "vibrant" is actually won. 1.02 was a rounding error. This is a
      // real push, plus a TARGETED lift on greens — a global saturation boost shoves the roof reds
      // and the sky just as hard, and those were already loud enough.
      // v130: 1.30 was doing sRGB-space work against a LINEAR buffer, where the luma of a mid tone
      // sits four times lower than it looks and the same multiplier therefore pushes much harder
      // than it reads on paper. Now that the buffer is encoded, 1.12 is the same visible push.
      "c.rgb=mix(vec3(l),c.rgb,1.12);"+                       // saturation, in the space it belongs
      // v130: the targeted green lift is GONE. It existed for exactly one reason — to fight a
      // nuclear kelly-green ground that the broken pipeline made worse — and it worked by shoving
      // every green pixel in the frame, foliage and grass and moss and copper roofs alike, toward
      // one hue. That is the uniform-saturation flaw the whole overhaul is trying to avoid, and
      // against a corrected palette it over-cooks it. If the greens need work, fix the hexes.
      "c.rgb*=vec3(1.02,1.00,0.97);"+                         // a whisper of warm daylight
      "c.rgb=clamp(c.rgb,0.0,1.0);"+
      "float d=distance(vUv,vec2(0.5));"+
      // v130: the encode lifts the corners as much as it lifts everything else, so the vignette
      // that used to be a visible frame is now barely there. 0.28 restores the same apparent
      // weight — it is holding the eye on the subject, which matters more once the world is bright.
      "c.rgb*=1.0-smoothstep(0.62,0.99,d)*0.28;"+
      "gl_FragColor=c;}"
  });
  composer.addPass(grade);
}

// ---------- generated pixel character skins ----------
function _shade(hex,dl){const c=new THREE.Color(hex);c.offsetHSL(0,0,dl);return "#"+c.getHexString();}
// ============ §H A9: A SKIN MUST BE THE SAME BYTES IN EVERY PROCESS ============
// Every one of these swatches used to be drawn out of the casino, and nobody had ever run the test
// that says so. `_blocks()` picked each 2x2 texel with Math.random() and `texturedMat()` is the
// skin factory for every uniform, cloth, hide, wood and metal surface on 40 unit classes, so
// rendering the same clubman in two processes gave two different clubmen: 4,507 pixels apart, 47
// levels of channel at the worst, and a hide patch on his skirt landing mid-brown in one run and
// cream in the other. Textures are client-side, so this never desynced the sim — but §G.5 is
// absolute (appearance is a pure function of u.id), and while it stood, §H A2's torso ΔE, the
// number the whole six-age ladder is scored on, was not reproducible from one run to the next.
//
// TWO LAYERS, because the second one is a guardrail for code nobody has written yet:
//   · `_blocks` hashes (x, y, cols, sz) per texel. No stream, no order dependence, no seeding.
//   · `_tex` takes the casino away FOR THE DURATION OF THE DRAW CALLBACK, so the speckles, grain,
//     dapples and flecks every skin factory scatters on top of the weave are deterministic too —
//     including the ones in other files and the ones not written yet. A texture is minted once and
//     cached under a key: anything random inside one was always a bug, never a behaviour, so
//     there is nothing here for this to break.
//
// THE SWAP IS AROUND `draw()` AND NOTHING ELSE, AND THAT IS LOAD-BEARING. Every THREE constructor
// burns four Math.random() calls on a uuid (02-world.js:178), `_tex` builds a CanvasTexture, and
// 02-world calls texturedMat from INSIDE its seeded window — so that uuid has to keep coming out
// of whichever stream is installed or the node indices move on the wire and PROTO 26 breaks for a
// weave fix. Checked with tools/nodehash.js against the pre-change tree: 736 nodes, same hash.
function _hashStr(s){ let h=0x811c9dc5>>>0;
  for(let i=0;i<s.length;i++){h=(h^s.charCodeAt(i))>>>0; h=Math.imul(h,0x01000193)>>>0;} return h>>>0; }
function _mix32(a){ a|=0; a=Math.imul(a^(a>>>16),0x7feb352d)|0; a=Math.imul(a^(a>>>15),0x846ca68b)|0;
  return (a^(a>>>16))>>>0; }
// mulberry32, deliberately the same generator 02-world.js seeds its world with — one PRNG in the
// codebase is one PRNG to reason about.
const _TEXRND={on:0,s:0,
  seed(k){ this.s=_hashStr(String(k))|0; },
  next(){ const a=this.s=(this.s+0x6D2B79F5)|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }};
function _tex(sz,draw,seed){
  const c=document.createElement("canvas"); c.width=c.height=sz;
  // A caller that passes no seed still gets a deterministic texture, just one keyed on the shape
  // of its callback rather than on its colour; `_blocks` re-seeds from the palette it was handed,
  // which is what threads the hex back through for the callers that scatter after the weave.
  const prevRnd=Math.random, prevOn=_TEXRND.on, prevS=_TEXRND.s;
  _TEXRND.on=1; _TEXRND.seed(seed!==undefined?seed:(sz+":"+draw.toString()));
  Math.random=function(){return _TEXRND.next();};
  try{ draw(c.getContext("2d"),sz); }
  finally{ Math.random=prevRnd; _TEXRND.on=prevOn; _TEXRND.s=prevS; }
  const t=new THREE.CanvasTexture(c);
  t.encoding=THREE.sRGBEncoding;
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  t._src=c; t._sz=sz; // v128.6: the atlas blits from the source canvas — see UATLAS
  return t;
}
// ==================== v128.6: THE UNIT SKIN ATLAS ====================
// The merge in 04-units.js welds each unit's ~51 meshes down to 11 rigid clusters, but a merged
// cluster still costs ONE DRAW PER MATERIAL it contains — and a broadsword carries 26. Merging
// geometry alone lands at 41 draw calls, not 11. The materials have to collapse too, and they
// cannot collapse into vertex colours: 25 of those 51 meshes are TEXTURED, and they are every
// large surface (torso, both arms, pelvis, thighs, all four armour rows, helm, head, shield).
// The `uniform` swatch has 1-texel gold button columns on a 64-vertex cylinder and the 64x64 face
// has 3x4 pupils and 2-texel teeth on a 100-vertex lathe — reproducing those per-vertex means
// tessellating, which spends back in vertices exactly what the merge saves in draws.
//
// So: ONE atlas, ONE material, and both channels at once. The shipped three.min.js runs
// <map_fragment> then <color_fragment> in meshtoon_frag and both multiply into diffuseColor, so
// map x vertexColor x TOON_RAMP composes correctly. A textured part gets an atlas cell and white
// vertex colour; a flat part gets its hex baked to vertex colour and points at a white cell.
//
// WHY THIS IS CHEAP HERE, measured: every unit texture is 16x16 or 64x64 (power of two), every
// one is ClampToEdge + NearestFilter with no mipmaps, and NOTHING on a unit tiles — the only
// RepeatWrapping texture in the game is the terrain grass. The whole all-classes-all-ages ceiling
// is 130 textures / 110,080 texels, which fits 512x512 with room to spare.
const UATLAS={
  SIZE:1024, PAD:2, cv:null, tex:null, mat:null,
  slots:new Map(),        // source texture -> {u0,v0,us,vs}
  x:0, y:0, shelf:0,      // skyline allocator: cells are placed once and NEVER move, so UVs
  white:null,             // baked into an already-merged geometry stay valid for ever
  _init(){
    if(this.cv)return;
    this.cv=document.createElement("canvas"); this.cv.width=this.cv.height=this.SIZE;
    const g=this.cv.getContext("2d");
    g.fillStyle="#ffffff"; g.fillRect(0,0,this.SIZE,this.SIZE); // white by default: an unmapped
    this.tex=new THREE.CanvasTexture(this.cv);                  // part reads 1.0 and shows its
    this.tex.encoding=THREE.sRGBEncoding;                       // vertex colour unchanged
    this.tex.magFilter=THREE.NearestFilter; this.tex.minFilter=THREE.NearestFilter;
    this.tex.generateMipmaps=false;
    this.mat=toonMat({map:this.tex,vertexColors:true});
    this.white=this._alloc(8,(g2,x,y)=>{g2.fillStyle="#ffffff";g2.fillRect(x,y,8,8);});
  },
  _alloc(sz,paint){
    const step=sz+this.PAD*2;
    if(this.x+step>this.SIZE){this.x=0;this.y+=this.shelf;this.shelf=0;}
    if(this.y+step>this.SIZE)return this.white||{u0:0,v0:0,us:0,vs:0}; // full: fall back to white
    const px=this.x+this.PAD, py=this.y+this.PAD;
    paint(this.cv.getContext("2d"),px,py);
    this.x+=step; if(step>this.shelf)this.shelf=step;
    this.tex.needsUpdate=true;
    const S=this.SIZE;
    // v-flip: canvas y grows downward, texture v grows upward
    return {u0:px/S, v0:1-(py+sz)/S, us:sz/S, vs:sz/S};
  },
  // Copy a source skin in, with its edge pixels extended into the padding. ClampToEdge is what
  // these textures do today, so extending the edge reproduces exactly the current appearance at
  // the seam — and it means a UV that overshoots (r128 SphereGeometry poles run to +-8.3%, which
  // is ~1.3 texels on a 16x16 cell) lands on the same colour it lands on now instead of on a
  // neighbouring skin.
  slot(t){
    this._init();
    if(!t)return this.white;
    let s=this.slots.get(t);
    if(s)return s;
    const sz=t._sz||(t.image&&t.image.width)||16, src=t._src||t.image;
    if(!src)return this.white;
    s=this._alloc(sz,(g,x,y)=>{
      const P=this.PAD;
      g.drawImage(src,x-P,y-P,sz+P*2,sz+P*2);   // cheap edge-extend: oversize blit underneath…
      g.drawImage(src,x,y,sz,sz);                // …then the true pixels on top
    });
    this.slots.set(t,s);
    return s;
  },
  whiteSlot(){ this._init(); return this.white; },
  material(){ this._init(); return this.mat; }
};
// Is this material shared out of _skinCache? Materials that are NOT (every one minted by
// mat()/box()/cyl()/cone(), which cache nothing) are owned by the single mesh that used them,
// and the merge is free to dispose them — indeed it must, or it inherits the leak the v122 fix
// never covered: ~10 orphaned MeshToonMaterials per broadsword rebuild, ~20 per age-5 villager.
const _skinMats=new Set();
function isSharedMat(m){ return !m||_skinMats.has(m)||m===UATLAS.mat; }
// 2px woven noise fill. THIS WAS THE A9 FAILURE — see the long note above _tex. The texel choice is
// a hash of its own coordinates and the palette it was handed, so it does not care what ran before
// it or how many times; `salt` only exists for a caller that wants two different weaves out of one
// palette. The re-seed is the other half: every caller draws the weave FIRST and its speckles
// after, so pushing the palette into the ambient stream here is what keeps a per-hex scatter
// per-hex once _tex has taken Math.random away.
function _blocks(ctx,sz,cols,salt){
  const key=(salt||"")+"|"+sz+"|"+cols.join(",");
  if(_TEXRND.on)_TEXRND.seed(key);
  const s=_hashStr(key)|0;
  for(let y=0;y<sz;y+=2)for(let x=0;x<sz;x+=2){
    ctx.fillStyle=cols[_mix32(s^Math.imul(x+1,0x9E3779B1)^Math.imul(y+1,0x85EBCA6B))%cols.length];
    ctx.fillRect(x,y,2,2);
  }
}
const _skinCache=new Map();
function texturedMat(kind,hex){
  const key=kind+"_"+hex;
  if(_skinCache.has(key))return _skinCache.get(key);
  let t;
  if(kind==="uniform")t=_tex(16,(c,s)=>{ // parade tunic: braid rows + gold button columns
    _blocks(c,s,[_shade(hex,0),_shade(hex,0.03),_shade(hex,-0.03)]);
    // v130 U1: the buttons were ONE texel wide on a 16px swatch wrapped round a 10-segment
    // cylinder — about a third of a screen pixel at play distance, so the gold that is supposed to
    // be a whole band of the nutcracker's front simply never existed except in close-ups. Two
    // texels wide, on a two-row pitch, is the smallest thing that still resolves at 40px, and the
    // frogging bars between the columns give the coat the horizontal chest ladder (AD §6.5).
    c.fillStyle=_shade(hex,-0.14);
    for(let y=2;y<s;y+=4)c.fillRect(2,y,12,1);                          // braid rows, under the gold
    c.fillStyle="#CFB53B";
    for(let y=1;y<s;y+=2){c.fillRect(4,y,2,1);c.fillRect(10,y,2,1);}    // button columns
    for(let y=3;y<s-2;y+=4)c.fillRect(4,y,8,1);                         // frogging: the bars between them
    c.fillStyle="#EBD46A"; c.fillRect(0,0,s,2);                         // gold collar, doubled
  },key);
  else if(kind==="cloth")t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(hex,0),_shade(hex,0.03),_shade(hex,-0.03)]);
    c.fillStyle=_shade(hex,-0.08);
    for(let y=4;y<s;y+=6)c.fillRect(0,y,s,1);                 // weave rows
    c.fillStyle=_shade(hex,0.08);
    // these three scatters read as Math.random() and are not: _tex has swapped the casino out for
    // a stream _blocks just seeded from this hex, so the slubs are per-colour and identical in
    // every process. Do not "fix" them into a fixed table — the variety is the point (§H A9).
    for(let i=0;i<6;i++)c.fillRect((Math.random()*s)|0,(Math.random()*s)|0,1,1);
  },key);
  else if(kind==="metal")t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(hex,0),_shade(hex,0.05),_shade(hex,-0.05)]);
    c.fillStyle=_shade(hex,0.14);
    for(let i=0;i<3;i++){const o=(i*6+2)%s;for(let d=0;d<s;d++)c.fillRect((o+d)%s,d,1,1);} // gleam streaks
    c.fillStyle=_shade(hex,-0.16);
    for(const [rx,ry] of [[2,2],[13,2],[2,13],[13,13]])c.fillRect(rx,ry,1,1);             // rivets
  },key);
  else if(kind==="wood")t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(hex,0),_shade(hex,-0.03)]);
    c.fillStyle=_shade(hex,-0.1);
    for(let x=0;x<s;x+=5)c.fillRect(x,0,1,s);                 // plank seams
    c.fillStyle=_shade(hex,-0.06);
    for(let i=0;i<5;i++)c.fillRect((Math.random()*s)|0,(Math.random()*s)|0,1,3); // grain — seeded, see cloth
  },key);
  else if(kind==="hide")t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(hex,0),_shade(hex,0.02)]);
    c.fillStyle=_shade(hex,-0.09);
    for(let i=0;i<7;i++){const x=(Math.random()*s)|0,y=(Math.random()*s)|0;    // seeded, see cloth
      c.fillRect(x,y,2,2);c.fillRect(x+1,y+1,2,2);}           // dapples
  },key);
  else t=_tex(16,(c,s)=>{ // robe: undyed weave
    _blocks(c,s,["#e8e2d0","#ded8c4","#efe9d8"]);
    c.fillStyle="#cfc9b6"; for(let y=3;y<s;y+=5)c.fillRect(0,y,s,1);
  },key);
  const m=toonMat({map:t});
  _skinCache.set(key,m); _skinMats.add(m); return m;
}
// faces: front gets eyes; sides/back/top get hair
const SKIN_TONES=[0xe8c39e,0xd9a878,0xb98a5f,0x8a6a4a];
const HAIR_TONES=[0x3a2a1c,0x5a4632,0x8a6a3f,0x2b2b2b,0x6d3a1f];
// v130 U1 — THE FACE IS NOW A FLAT PLATE, NOT A WRAP, AND THAT CHANGES EVERYTHING ABOUT IT.
// This texture used to be laned round a nine-segment LatheGeometry, so `u` spanned the whole
// revolution and only x≈28-36 of 64 was ever pointed at the camera: the eyes at x=22 and x=35 sat
// on the CHEEK facets, raked ~50° away, and half the paint (the sideburns at x=1 and x=51) was on
// the back of the skull where nobody has ever seen it. 04-units now hangs a PlaneGeometry face
// plate on the block head's flat frontal facet, so this 64x64 maps 1:1 onto the face and every
// texel is worth the same. The old x=18…46 safe window is therefore gone — paint the full square.
//
// Colours are ART-DIRECTION §2.6 and are not free choices: the #FFFFFF tooth band with #1A1210
// immediately above it is the light-over-dark pair that reads as a bared jaw at 40px, and it is
// the ONLY pure white the game is allowed. `skin` is the wood tone; `hair` is kept in the
// signature (and the cache key) but only tints the brow/moustache now that a shako covers the
// crown — a nutcracker's head is carved and painted, not haired.
function headMaterials(skin,hair){ // block-head face plate: brows, peg nose, moustache, bared teeth
  const key="head_"+skin+"_"+hair;
  if(_skinCache.has(key))return _skinCache.get(key);
  const sk=[_shade(skin,0),_shade(skin,0.03),_shade(skin,-0.02)];
  const side=_tex(64,(c,s)=>{
    _blocks(c,s,sk);                                                     // painted wood, faintly grained
    c.fillStyle="#C2916A"; c.fillRect(0,0,s,7);                          // shadow the brim throws on the brow
    c.fillStyle="#14100E";                                               // BROWS: heavy, angled inward, the unit's whole expression
    c.fillRect(9,13,18,4); c.fillRect(9,11,10,3);
    c.fillRect(37,13,18,4); c.fillRect(45,11,10,3);
    c.fillStyle="#F4F2EC"; c.fillRect(10,19,17,11); c.fillRect(37,19,17,11);   // eye whites — huge, doll-like
    c.fillStyle="#3E6FA8"; c.fillRect(14,21,9,8); c.fillRect(41,21,9,8);
    c.fillStyle="#14100E"; c.fillRect(16,23,5,5); c.fillRect(43,23,5,5);       // pupils, 5px: still 1px at 40 screen px
    c.fillStyle="#FFFFFF"; c.fillRect(16,23,2,2); c.fillRect(43,23,2,2);       // catchlight
    c.fillStyle="#C2916A"; c.fillRect(28,20,8,18);                             // the peg nose, dead centre
    c.fillStyle="#A87954"; c.fillRect(34,20,2,18); c.fillRect(28,36,8,2);      // …with one lit edge and a shelf
    c.fillStyle="#D9584E"; c.fillRect(4,29,7,6); c.fillRect(53,29,7,6);        // cheek dots (§2.6)
    c.fillStyle="#14100E";                                               // the moustache, curled up at both ends
    c.fillRect(18,37,28,5); c.fillRect(13,34,6,5); c.fillRect(45,34,6,5); c.fillRect(11,31,4,4); c.fillRect(49,31,4,4);
    // the mouth pair sits at rows 42-55 and nowhere lower: the beard wedge in 04-units occludes
    // this plate from about row 56 down, and the first cut of it swallowed the teeth entirely.
    c.fillStyle="#1A1210"; c.fillRect(17,42,30,6);                       // §6.4 THE MOUTH: dark band…
    c.fillStyle="#FFFFFF"; c.fillRect(17,48,30,7);                       // …with the bared teeth directly under it
    c.fillStyle="#C2916A"; for(let x=21;x<47;x+=6)c.fillRect(x,48,1,7);  // tooth gaps, 1px so they mush at distance
    c.fillStyle="#C2916A"; c.fillRect(0,55,s,9);                         // jaw shelf, in shadow under the beard
  },key);
  const m=toonMat({map:side});
  _skinCache.set(key,m); _skinMats.add(m); return m;
}
// shields: team field, dark border, one of three emblems
function heraldryMat(team,seed){
  const key="her_"+team+"_"+(seed%3);
  if(_skinCache.has(key))return _skinCache.get(key);
  // the old team hexes were hard-coded here as literals, so moving TEAMCOL to the AD §2.5 pair
  // would have left every shield a shade off the coat it hangs beside. Read the source of truth.
  const base=(typeof TEAMCOL!=="undefined"&&TEAMCOL[team]!==undefined)?TEAMCOL[team]:0x2E5FD8;
  const t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(base,0),_shade(base,-0.04)]);
    c.fillStyle=_shade(base,-0.14);
    c.fillRect(0,0,s,1);c.fillRect(0,s-1,s,1);c.fillRect(0,0,1,s);c.fillRect(s-1,0,1,s);
    c.fillStyle="#f2e7c8";
    const v=seed%3;
    if(v===0){c.fillRect(7,2,2,12);c.fillRect(3,6,10,2);}          // cross
    else if(v===1){for(let i=0;i<6;i++){c.fillRect(2+i,10-i,2,2);c.fillRect(12-i,10-i,2,2);}} // chevron
    else {c.fillRect(6,5,4,6);c.fillRect(5,6,6,4);}                // roundel
  },key);
  const m=toonMat({map:t});
  _skinCache.set(key,m); _skinMats.add(m); return m;
}

// plain cached materials (skin hands, boots …)
function plainMat(hex){
  const key="plain_"+hex;
  if(_skinCache.has(key))return _skinCache.get(key);
  const m=toonMat({color:hex});
  _skinCache.set(key,m); _skinMats.add(m); return m;
}

// ---------- gentle terrain: rolling hills, deterministic, flat where you build ----------
function terrainHeight(x,z){
  let h=Math.sin(x*0.045)*Math.cos(z*0.06)*1.3
       +Math.sin(x*0.013+z*0.021)*1.9
       +Math.cos(x*0.08-z*0.05)*0.45;
  // flatten around town centers and neutral bazaars so building stays sane
  const flat=(cx,cz,r,fall)=>{
    const d=Math.hypot(x-cx,z-cz);
    return Math.min(1,Math.max(0,(d-r)/fall));
  };
  let m=1;
  m=Math.min(m,flat(TCPOS[0][0],TCPOS[0][1],28,24));
  m=Math.min(m,flat(TCPOS[1][0],TCPOS[1][1],28,24));
  // v78: the bazaars live ON the Kings Road now — flats track roadPoint(0.28/0.5/0.72)+3.2z (see 02-world BAZAAR_T)
  m=Math.min(m,flat(-77,17.46,10,12)); m=Math.min(m,flat(77,17.46,10,12)); m=Math.min(m,flat(0,15.2,10,12));
  m=Math.min(m,flat(-105,82,9,10)); m=Math.min(m,flat(98,-88,9.5,10)); m=Math.min(m,flat(-24,-104,8,10)); // ponds sit level
  m=Math.min(m,flat(0,-186,72,24)); // v82: the southern BAY — the whole doubled beach and its ocean lie dead level
  return h*m;
}
