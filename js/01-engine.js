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
scene.fog=new THREE.Fog(0xbfe4ff,104,182);
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
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
// v128 THE TOON PASS. ACESFilmic was the single biggest thing standing between this game and a
// vibrant cartoon: it rolls highlights off into pastel and pulls saturation out of exactly the
// bright greens the style lives on, AND it smears the hard steps a toon ramp works so hard to
// make. Filmic tone mapping is for photographic light on photographic shapes; these are flat
// colours on low-poly forms. Linear keeps the ramp crisp and the greens loud.
renderer.toneMapping=THREE.LinearToneMapping;
// …but linear light does not roll off, so the total energy has to be honest. hemi 0.75 + sun 1.15
// lands close to 2.0 on a surface facing the sun, and the ramp's top cell is pure white, so pale
// materials (robes, the Town Centre canvas, snow caps) clipped to flat white and lost every fold.
// Exposure is the right dial for that rather than dimming the lights: John's light values stay
// exactly as specified, and nothing about the RATIO between sky-bounce and sun changes.
renderer.toneMappingExposure=0.78;
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
function makeToonRamp(levels){
  const c=document.createElement("canvas"); c.width=levels; c.height=1;
  const ctx=c.getContext("2d");
  for(let i=0;i<levels;i++){
    // hand-tuned: shadow lifted well off black (a black shadow reads as dirt, not shade), a broad
    // bright midtone so most of the world sits in the LIT band, and a near-white top step
    const v=[0x64,0x9e,0xd2,0xff][i]||0xff;
    ctx.fillStyle="rgb("+v+","+v+","+v+")"; ctx.fillRect(i,0,1,1);
  }
  const t=new THREE.CanvasTexture(c);
  t.minFilter=t.magFilter=THREE.NearestFilter;
  t.generateMipmaps=false;
  return t;
}
const TOON_RAMP=makeToonRamp(4);

// ---------- lighting: bright, warm, and pointed ----------
// v128: a cool sky bounce against a warm sun is what makes stylised greens sing — the shadowed
// side of every leaf goes faintly blue and the lit side goes gold, which is the whole trick behind
// how a Gen-1 route looks. The old rig was a warm hemisphere over a warm sun with a warm ambient
// on top: three lights all pushing the same direction, which is why everything read dusty.
const hemi=new THREE.HemisphereLight(0xb1e1ff,0x447755,0.75); scene.add(hemi);
// A toon ramp quantises DIRECTIONAL light. Ambient bypasses that entirely — it lifts every pixel
// equally, so the bands wash together and the whole point is lost. What was 0.18 of warm ambient
// is now a whisper, just enough to keep pure-shadow faces from going flat.
const warm=new THREE.AmbientLight(0xffe8cc,0.05); scene.add(warm);
const sun=new THREE.DirectionalLight(0xfff4e0,1.15);
sun.position.set(36,90,48); sun.castShadow=true; // same ratio as (6,15,8), at the map's scale
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-70;sun.shadow.camera.right=70;   // tight box that FOLLOWS the player
sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;
sun.shadow.camera.far=340;
scene.add(sun.target);
renderer.shadowMap.autoUpdate=false; // refreshed every other frame from the game loop
scene.add(sun);

// v128: ONE factory swap converts almost the whole game. `mat`, `plainMat`, `texturedMat`,
// `headMaterials` and `heraldryMat` are where every material in 02-world, 03-buildings and
// 04-units comes from, so toon-shading the game is five edits here rather than a thousand
// downstream. Anything that reaches past these and news up a Lambert directly is deliberate
// (clouds, water, decals) and is handled where it lives.
function toonMat(o){o=o||{};o.gradientMap=TOON_RAMP;return new THREE.MeshToonMaterial(o);}
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
      fogColor:{value:new THREE.Color(0xbfe4ff)},fogNear:{value:104},fogFar:{value:182}},
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
function box(w,h,d,c){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.castShadow=true;return m;}
function cone(r,h,c,seg){const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,seg||5),mat(c));m.castShadow=true;return m;}
function cyl(rt,rb,h,c,seg){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||7),mat(c));m.castShadow=true;return m;}

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
const grassTex=makePixelTexture(96,
  ["#79ad4a","#74a846","#7fb14d","#71a444","#83b552"],
  [["#93c25c",70],["#5d8a3a",60],["#c9c877",8],["#d8705c",4],["#eaf2d6",4]]);
grassTex.repeat.set(46,30);

// ---------- sky dome + sun (bloom feeds on this) ----------
let skyDome=null;
(function buildSky(){
  const geo=new THREE.SphereGeometry(700,20,12);
  const skyMat=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:new THREE.Color(0x3d94e8)},horizon:{value:new THREE.Color(0xcdeeff)}}, // v128: summer-noon blue, not overcast
    vertexShader:"varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"uniform vec3 top;uniform vec3 horizon;varying vec3 vP;"+
      "void main(){float y=normalize(vP).y;"+
      "float h=clamp(y*1.35,0.0,1.0);"+
      "vec3 col=mix(horizon,top,h);"+
      "col=mix(col,horizon*0.72,smoothstep(0.0,-0.3,y));"+ // below-horizon falloff: no glare wall
      "gl_FragColor=vec4(col,1.0);}"
  });
  skyDome=new THREE.Mesh(geo,skyMat);
  skyDome.frustumCulled=false; // never clips into a black hole
  skyDome.renderOrder=-1;
  scene.add(skyDome);
  scene.background=null;
  const sunSpr=new THREE.Sprite(new THREE.SpriteMaterial({
    color:0xffdf9a,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,fog:false}));
  sunSpr.scale.set(70,70,1); sunSpr.position.set(150,210,100); scene.add(sunSpr);
})();

// ---------- drifting clouds + floating dust motes (the fairy-tale layer) ----------
const clouds=[];
(function buildClouds(){
  for(let i=0;i<8;i++){
    const g=new THREE.Group();
    const puffs=3+((Math.random()*3)|0);
    for(let p=0;p<puffs;p++){
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(7+Math.random()*7,0),
        new THREE.MeshLambertMaterial({color:0xfbfdff}));
      m.scale.set(1.6,0.5,1); m.position.set(p*9-puffs*4,(Math.random()-0.5)*2,(Math.random()-0.5)*6);
      g.add(m);
    }
    g.position.set((Math.random()*2-1)*260,62+Math.random()*26,(Math.random()*2-1)*160);
    scene.add(g); clouds.push(g);
  }
})();
let dustPts=null;
(function buildDust(){
  const N=260, pos=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    pos[i*3]=(Math.random()*2-1)*MAP.x; pos[i*3+1]=0.6+Math.random()*6; pos[i*3+2]=(Math.random()*2-1)*MAP.z;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  dustPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xfff0c0,size:0.35,transparent:true,
    opacity:0.4,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  scene.add(dustPts);
})();

// ---------- post stack: bloom + grade + vignette ----------
let composer=null;
if(typeof THREE.EffectComposer!=="undefined"){
  composer=new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene,camera));
  const bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.28,0.6,0.92);
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
      "c.rgb=mix(vec3(l),c.rgb,1.30);"+                       // saturation, meant this time
      "float g=clamp((c.g-max(c.r,c.b))*2.2,0.0,1.0);"+       // how GREEN is this pixel?
      "c.rgb=mix(c.rgb,c.rgb*vec3(0.94,1.10,0.90),g);"+       // …lift those, and only those
      "c.rgb*=vec3(1.03,1.01,0.97);"+                         // a whisper of warm daylight
      "c.rgb=clamp(c.rgb,0.0,1.0);"+
      "float d=distance(vUv,vec2(0.5));"+
      "c.rgb*=1.0-smoothstep(0.62,0.99,d)*0.20;"+             // vignette, lightened: bright and inviting
      "gl_FragColor=c;}"
  });
  composer.addPass(grade);
}

// ---------- generated pixel character skins ----------
function _shade(hex,dl){const c=new THREE.Color(hex);c.offsetHSL(0,0,dl);return "#"+c.getHexString();}
function _tex(sz,draw){
  const c=document.createElement("canvas"); c.width=c.height=sz;
  draw(c.getContext("2d"),sz);
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
function _blocks(ctx,sz,cols){ // 2px woven noise fill
  for(let y=0;y<sz;y+=2)for(let x=0;x<sz;x+=2){
    ctx.fillStyle=cols[(Math.random()*cols.length)|0]; ctx.fillRect(x,y,2,2);
  }
}
const _skinCache=new Map();
function texturedMat(kind,hex){
  const key=kind+"_"+hex;
  if(_skinCache.has(key))return _skinCache.get(key);
  let t;
  if(kind==="uniform")t=_tex(16,(c,s)=>{ // parade tunic: braid rows + gold button columns
    _blocks(c,s,[_shade(hex,0),_shade(hex,0.03),_shade(hex,-0.03)]);
    c.fillStyle="#d9a92e";
    for(let y=1;y<s;y+=3){c.fillRect(5,y,1,1);c.fillRect(10,y,1,1);}   // button columns
    c.fillStyle=_shade(hex,-0.12);
    for(let y=2;y<s;y+=4)c.fillRect(2,y,12,1);                          // braid rows
    c.fillStyle="#d9a92e"; c.fillRect(0,0,s,1);                         // gold collar
  });
  else if(kind==="cloth")t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(hex,0),_shade(hex,0.03),_shade(hex,-0.03)]);
    c.fillStyle=_shade(hex,-0.08);
    for(let y=4;y<s;y+=6)c.fillRect(0,y,s,1);                 // weave rows
    c.fillStyle=_shade(hex,0.08);
    for(let i=0;i<6;i++)c.fillRect((Math.random()*s)|0,(Math.random()*s)|0,1,1);
  });
  else if(kind==="metal")t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(hex,0),_shade(hex,0.05),_shade(hex,-0.05)]);
    c.fillStyle=_shade(hex,0.14);
    for(let i=0;i<3;i++){const o=(i*6+2)%s;for(let d=0;d<s;d++)c.fillRect((o+d)%s,d,1,1);} // gleam streaks
    c.fillStyle=_shade(hex,-0.16);
    for(const [rx,ry] of [[2,2],[13,2],[2,13],[13,13]])c.fillRect(rx,ry,1,1);             // rivets
  });
  else if(kind==="wood")t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(hex,0),_shade(hex,-0.03)]);
    c.fillStyle=_shade(hex,-0.1);
    for(let x=0;x<s;x+=5)c.fillRect(x,0,1,s);                 // plank seams
    c.fillStyle=_shade(hex,-0.06);
    for(let i=0;i<5;i++)c.fillRect((Math.random()*s)|0,(Math.random()*s)|0,1,3); // grain
  });
  else if(kind==="hide")t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(hex,0),_shade(hex,0.02)]);
    c.fillStyle=_shade(hex,-0.09);
    for(let i=0;i<7;i++){const x=(Math.random()*s)|0,y=(Math.random()*s)|0;
      c.fillRect(x,y,2,2);c.fillRect(x+1,y+1,2,2);}           // dapples
  });
  else t=_tex(16,(c,s)=>{ // robe: undyed weave
    _blocks(c,s,["#e8e2d0","#ded8c4","#efe9d8"]);
    c.fillStyle="#cfc9b6"; for(let y=3;y<s;y+=5)c.fillRect(0,y,s,1);
  });
  const m=toonMat({map:t});
  _skinCache.set(key,m); _skinMats.add(m); return m;
}
// faces: front gets eyes; sides/back/top get hair
const SKIN_TONES=[0xe8c39e,0xd9a878,0xb98a5f,0x8a6a4a];
const HAIR_TONES=[0x3a2a1c,0x5a4632,0x8a6a3f,0x2b2b2b,0x6d3a1f];
function headMaterials(skin,hair){ // egg-head wrap: peg nose, handlebar mustache, red mouth, white sideburns
  const key="head_"+skin+"_"+hair;
  if(_skinCache.has(key))return _skinCache.get(key);
  const sk=[_shade(skin,0.05),_shade(skin,0.08)];
  const hr=[_shade(hair,0),_shade(hair,-0.05)];
  const side=_tex(64,(c,s)=>{
    _blocks(c,s,sk);
    c.fillStyle=hr[0]; c.fillRect(0,0,s,12);                             // hair crown (lives under the hat)
    for(let x=0;x<s;x+=3){c.fillStyle=hr[(x/3|0)%2];c.fillRect(x,11,2,3);}
    // rows 14-20: bare wooden forehead peeking below the brim
    for(const x0 of [1,51]){ // fluffy white sideburns
      for(let y=22;y<46;y+=3)for(let x=x0;x<x0+12;x+=3){
        c.fillStyle=(x+y)%2?"#efece4":"#dcd8cc"; c.fillRect(x+((y%6)>2?1:0),y,3,3);}
    }
    c.fillStyle="#1c1712";                                               // brows, out in the open
    c.fillRect(22,27,7,2); c.fillRect(23,26,5,2); c.fillRect(35,27,7,2); c.fillRect(36,26,5,2);
    c.fillStyle="#f6f6f4"; c.fillRect(22,30,7,6); c.fillRect(35,30,7,6); // eyes well below the brim
    c.fillStyle="#3e7fc1"; c.fillRect(24,31,3,4); c.fillRect(37,31,3,4);
    c.fillStyle="#101010"; c.fillRect(25,32,2,2); c.fillRect(38,32,2,2);
    c.fillStyle=_shade(skin,-0.06); c.fillRect(30,31,4,11);              // peg nose
    c.fillStyle=_shade(skin,-0.14); c.fillRect(33,31,1,11); c.fillRect(30,40,4,2);
    c.fillStyle="#e2836f"; c.fillRect(15,38,5,5); c.fillRect(44,38,5,5); // blush
    c.fillStyle="#141414";                                               // a NEAT curled mustache — eye-span wide
    c.fillRect(25,44,14,3); c.fillRect(22,42,4,3); c.fillRect(38,42,4,3);
    c.fillRect(21,41,2,2); c.fillRect(41,41,2,2);
    c.fillStyle="#a32126"; c.fillRect(27,48,10,16);                      // mouth to the egg's base
    c.fillStyle="#f6f3ea";
    for(let x=28,i=0;i<3;x+=3,i++)c.fillRect(x,48,2,8);                  // upper teeth to the seam
  });
  const m=toonMat({map:side});
  _skinCache.set(key,m); _skinMats.add(m); return m;
}
// shields: team field, dark border, one of three emblems
function heraldryMat(team,seed){
  const key="her_"+team+"_"+(seed%3);
  if(_skinCache.has(key))return _skinCache.get(key);
  const base=team===0?0x3d6ef2:0xd94a3d;
  const t=_tex(16,(c,s)=>{
    _blocks(c,s,[_shade(base,0),_shade(base,-0.04)]);
    c.fillStyle=_shade(base,-0.14);
    c.fillRect(0,0,s,1);c.fillRect(0,s-1,s,1);c.fillRect(0,0,1,s);c.fillRect(s-1,0,1,s);
    c.fillStyle="#f2e7c8";
    const v=seed%3;
    if(v===0){c.fillRect(7,2,2,12);c.fillRect(3,6,10,2);}          // cross
    else if(v===1){for(let i=0;i<6;i++){c.fillRect(2+i,10-i,2,2);c.fillRect(12-i,10-i,2,2);}} // chevron
    else {c.fillRect(6,5,4,6);c.fillRect(5,6,6,4);}                // roundel
  });
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
