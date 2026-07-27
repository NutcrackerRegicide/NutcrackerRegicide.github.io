/* REGICIDE PVP — 01-engine.js */
// ---------- three setup ----------
scene=new THREE.Scene();
scene.background=new THREE.Color(0x9db8d6);
scene.fog=new THREE.Fog(0xc9d3d6,60,178); // battlefield haze: the world fades before the cull line
camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,0.1,1200); // far enough that the sky dome never clips
renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1)); // lo-fi loves 1:1 — and so does the GPU
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;   // modern filmic light on lo-fi shapes
renderer.toneMappingExposure=1.02;
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

const hemi=new THREE.HemisphereLight(0xe8e2d0,0x4a5c30,0.85); scene.add(hemi);
const warm=new THREE.AmbientLight(0xffe0b8,0.18); scene.add(warm); // golden lift
const sun=new THREE.DirectionalLight(0xffe6b8,1.0);
sun.position.set(60,90,40); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-70;sun.shadow.camera.right=70;   // tight box that FOLLOWS the player
sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;
sun.shadow.camera.far=340;
scene.add(sun.target);
renderer.shadowMap.autoUpdate=false; // refreshed every other frame from the game loop
scene.add(sun);

function mat(c){return new THREE.MeshLambertMaterial({color:c});}
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
const grassTex=makePixelTexture(96,
  ["#7a9a5e","#71925a","#6f8f57","#7f9f63","#748f5a"],
  [["#8fae74",150],["#5a7345",150],["#c9bd8a",20],["#c95b4f",7],["#e8e2d0",6]]);
grassTex.repeat.set(46,30);

// ---------- sky dome + sun (bloom feeds on this) ----------
let skyDome=null;
(function buildSky(){
  const geo=new THREE.SphereGeometry(700,20,12);
  const skyMat=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:new THREE.Color(0x6f9fd8)},horizon:{value:new THREE.Color(0xdfe4e6)}},
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
      "c.rgb=mix(vec3(l),c.rgb,1.02);"+                       // near-neutral saturation
      "c.rgb*=vec3(1.06,1.0,0.94);"+                          // warm grade
      "float d=distance(vUv,vec2(0.5));"+
      "c.rgb*=1.0-smoothstep(0.55,0.95,d)*0.32;"+             // vignette
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
  return t;
}
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
  const m=new THREE.MeshLambertMaterial({map:t});
  _skinCache.set(key,m); return m;
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
  const m=new THREE.MeshLambertMaterial({map:side});
  _skinCache.set(key,m); return m;
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
  const m=new THREE.MeshLambertMaterial({map:t});
  _skinCache.set(key,m); return m;
}

// plain cached materials (skin hands, boots …)
function plainMat(hex){
  const key="plain_"+hex;
  if(_skinCache.has(key))return _skinCache.get(key);
  const m=new THREE.MeshLambertMaterial({color:hex});
  _skinCache.set(key,m); return m;
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
