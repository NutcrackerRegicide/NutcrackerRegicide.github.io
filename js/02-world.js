const worldDeco=[]; // distance-culled scenery
// MULTIPLAYER: world generation must be identical on every machine, so this whole
// file runs under a seeded RNG. Node order = network node index. Restored at EOF.
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
// ---------- the disc a ground decal is cut from ----------
// v130.3 A CIRCLE IS A TELL. CircleGeometry gives a fan: one ring of vertices at one radius, which
// at the segment counts this file can afford draws a legible POLYGON — the clearing patches read as
// "flat pale-green hexagons sitting on top of the lawn" because they are, at seven sides, literally
// heptagons. Two things this adds and CircleGeometry cannot:
//   · `wob` breaks the rim off the circle. The wobble is a hash of the vertex's ANGLE and the disc's
//     own centre — deterministic, not Math.random(), because everything that calls this from inside
//     the seeded window would otherwise move every node index on the wire (§10.7). Same disc every
//     time on every peer, and no two discs the same shape.
//   · `rings` subdivides radially, which is what lets a colour vary ACROSS a decal instead of only
//     around its rim. The road needs that (its modulation is a function of world position) and a
//     one-ring fan physically cannot carry it.
function _discGeo(radius,segs,rings,wob){
  const pos=[],uv=[],idx=[];
  pos.push(0,0,0); uv.push(0.5,0.5);
  const rad=[];
  for(let s=0;s<segs;s++){
    const a=s/segs*Math.PI*2;
    // two octaves, coprime, so the outline is lumpy rather than regularly scalloped
    rad.push(radius*(1+wob*(Math.sin(a*3.0+radius*5.7)*0.62+Math.sin(a*5.0-radius*11.3)*0.38)));
  }
  for(let ri=1;ri<=rings;ri++){
    const f=ri/rings;
    for(let s=0;s<segs;s++){
      const a=s/segs*Math.PI*2, r=rad[s]*f;
      pos.push(Math.cos(a)*r,0,Math.sin(a)*r);
      uv.push(0.5+Math.cos(a)*f*0.5,0.5+Math.sin(a)*f*0.5);
    }
  }
  for(let s=0;s<segs;s++){ const n=(s+1)%segs; idx.push(0,1+n,1+s); }      // the middle fan
  for(let ri=1;ri<rings;ri++){
    const a0=1+(ri-1)*segs, b0=1+ri*segs;
    for(let s=0;s<segs;s++){ const n=(s+1)%segs;
      idx.push(a0+s,b0+n,b0+s, a0+s,a0+n,b0+n); }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  return g;
}
// drape a flat decal geometry over the rolling terrain: vertex heights get baked in
// Split out from drapedDecal in v130.3 so a caller can take the GEOMETRY and weld a whole layer of
// decals into one mesh instead of minting a mesh per disc — see the clearing patches and the King's
// Road. Local space, centred on (cx,cz); the caller supplies the translation.
// v130.6 `opt.warp` reshapes the disc in the XZ plane BEFORE the heights are sampled, and the order
// is the whole reason it lives in here rather than in the caller. A decal that is draped first and
// squashed afterwards carries the terrain height of WHERE THE VERTEX USED TO BE: stretch a 3-unit
// pool to 6 across a slope and its far rim is baked half a metre off the hill it is lying on, so it
// either floats or sinks straight through. Written into the buffer as it goes, because the colour
// closures downstream read the warped position back out. See paintContactShadows.
const _warpXZ=[0,0];
function drapedGeo(radius,segs,cx,cz,off,opt){
  opt=opt||{};
  const geo=(opt.wob||opt.rings)?_discGeo(radius,segs,opt.rings||1,opt.wob||0)
                                :(()=>{const g=new THREE.CircleGeometry(radius,segs);g.rotateX(-Math.PI/2);return g;})();
  const pa=geo.attributes.position, warp=opt.warp;
  for(let i=0;i<pa.count;i++){
    let lx=pa.getX(i), lz=pa.getZ(i);
    if(warp){ warp(lx,lz,_warpXZ); lx=_warpXZ[0]; lz=_warpXZ[1]; pa.setX(i,lx); pa.setZ(i,lz); }
    pa.setY(i,terrainHeight(cx+lx,cz+lz)+off);
  }
  geo.computeVertexNormals();
  return geo;
}
function drapedDecal(radius,segs,color,cx,cz,off,tex,opt){
  const geo=drapedGeo(radius,segs,cx,cz,off,opt);
  // v130.2: an untextured decal fades on the GROUND's fog curve, not the scene's. The terrain now
  // keeps ~12% of itself out past the cull line so the horizon band is not one flat colour (see
  // buildTerrain), and a decal that stayed on the stock curve sat at pure fog.color on top of it —
  // 195 pale lily pads scattered across the deep field, which is a worse artefact than the milk it
  // replaced. A decal IS the ground; it fades with the ground. All of them share one expression, so
  // the customProgramCacheKey inside _fogClamp keeps them on ONE compiled program however many
  // materials get minted. Textured decals are skipped deliberately: those materials come out of
  // _skinCache and are shared with buildings and units, and patching a shared material would drag
  // half the game onto the ground's fog curve with them.
  const m=new THREE.Mesh(geo,tex?texturedMat(tex,color):_fogClamp(mat(color),GROUND_FOG));
  // v129.5 A DECAL IS THE GROUND. THE GROUND CATCHES SHADOWS.
  // There are ~289 of these on screen at a base — grass patches, building pads, the Town Centre's
  // dirt apron, road paving — and every one of them had receiving turned off. They sit ON the
  // terrain, so wherever one lay it punched a shadow-free hole in exactly the place a unit or a
  // building was standing. Still castShadow=false: a flat sticker on the ground has nothing to
  // cast and would only fight the surface it is lying on.
  m.position.set(cx,0,cz); m.castShadow=false; m.receiveShadow=true;
  return m;
}
// ---------- fog surgery, and the two traps that ate the first attempt at it ----------
// ART-DIRECTION §4.4 wants three fog-depth bands, and the horizon band needs geometry that is
// heavily fogged WITHOUT being erased. r128's linear fog reaches exactly 1.0 at fog.far and stays
// there forever, so anything past HIDE_D resolves to fog.color byte for byte — invisible. This
// rewrites the fog line for a single material so a chosen surface can hold a little of itself.
// TRAP 1 — REPLACE THE INCLUDE, NEVER THE EXPANSION. WebGLRenderer calls onBeforeCompile BEFORE
// WebGLProgram resolves #include directives (`t.onBeforeCompile(o,f), h=et.acquireProgram(o,l)`),
// so what arrives here is ShaderLib.toon.fragmentShader with a raw `#include <fog_fragment>` in it
// and not one character of the expanded mix line. v130.1 searched for the expansion, matched
// nothing, and shipped an unclamped ridge for a whole review cycle without erroring once —
// String.replace with no match returns the source unchanged and says nothing.
// TRAP 2 — THE PROGRAM CACHE KEY IS THE FUNCTION'S SOURCE TEXT. Material.customProgramCacheKey
// defaults to `this.onBeforeCompile.toString()`, and acquireProgram's lookup is GLOBAL. Two
// materials patched through one shared helper have byte-identical closure source, so the second
// would silently be handed the FIRST one's compiled program along with the first one's clamp.
// The key has to carry the expression, not the function.
// TRAP 3 — FOG DEPTH IS A DISTANCE, AND A FRAME HAS A VERTICAL AXIS. §4.2's rule (fog.far ===
// HIDE_D) is right and fixed the near field, but it buys the cull line's invisibility with a curve
// that saturates at 150 units in EVERY direction, and how much of the frame that eats depends
// entirely on how high the camera is. At eye level the saturated region is a thin strip on the
// horizon, exactly as intended. From the 60-unit vantage 06-wide shoots from, the ground between
// 150 and the map's far corner is a THIRD OF THE PICTURE and every pixel of it resolves to
// fog.color: the milk wall did not get fixed in v130.2, it moved up the frame. So the clamp carries
// a second term — `vDrop`, how far the fragment sits BELOW the camera in world units, which the
// vertex patch below reads straight out of viewMatrix's up row. Divided by fogDepth that is the
// sine of the angle you are looking DOWN at the ground, and it is the honest physical dial too:
// looking steeply down is looking through a shorter column of air. At eye level it is ~0.01, so the
// cull line is as hidden as §4.2 requires; from the 60-unit vantage it saturates, and the deep field
// gets twice the ground colour the near-eye shots do — which is the shot that needs it, because it
// is the shot where the deep field is a third of the frame.
// The ground's own curve, shared by the terrain, every untextured ground decal, the instanced
// foliage that grows out of it and — since v130.4 — the forest standing on it. See buildTerrain.
const GROUND_TILT="smoothstep( 0.06, 0.34, vDrop / max( fogDepth, 1.0 ) )";
// TRAP 4 — AN EXEMPTION THAT GROWS WITH DEPTH IS A FOG FACTOR THAT FALLS WITH DEPTH. Both earlier
// cuts wrote this as a WINDOW that opened somewhere out past the near field, and both shipped the
// same artefact for the same arithmetic: min() follows the stock curve up to the crossover and the
// exemption's curve after it, so wherever the exemption is still growing the ground behind is
// GREENER than the ground in front. 06-wide measured it — row-mean luminance 0.685 out on the far
// plain, 0.797 in the band at the cull line, 0.714 in the near field: a milk stripe with green on
// BOTH SIDES of it. Reversed aerial perspective reads as a rendering fault, not as air, which is
// worse than either thing the window was opened to fix. So there is no window left. The magnitude is
// flat from the camera to fogFar (where it cannot show, because stock fog is smaller than it) and
// decays to nothing by 2.5·fogFar: the ground fogs UP along the stock curve, tops out at the cull
// line, and keeps fogging further as the plain recedes to the terrain's own 349-unit corner, where
// it is fog.color exactly and the plane's edge dissolves into the sky instead of drawing a cut-out
// across the horizon (§4.3). Monotonic from the horizon to the bottom of the frame, which is the
// only test that catches this class of bug.
// AND THE MAGNITUDE IS CAPPED AT 0.10, BECAUSE F6 IS MEASURED AT THE CULL LINE. Whatever the ground
// keeps of itself at fogFar a tree standing on it now keeps too (TREE_MAT shares this expression, or
// the forest goes back to being fog-coloured cut-outs pasted on green ground), and the tree then
// VANISHES at HIDE_D — so the exemption at 150 is exactly the size of the pop. 0.10 leaves a ~2%
// screen-luminance ghost and a 0.90 fog factor, which is the literal number F6 asks for. The 0.42
// this used to reach from a high camera would have blinked out a fifth of a tree.
const GROUND_FOG="min( fogFactor, 1.0 - ( 0.05 + 0.05 * "+GROUND_TILT+" ) * ( 1.0 - smoothstep( fogFar, fogFar * 2.5, fogDepth ) ) )";
// TRAP 5 — THE MATERIAL MAY ALREADY BE PATCHED. TREE_MAT carries its outline in onBeforeCompile
// (_treeInk), and assigning over it is a silent way to delete every line in the forest — the ink is
// a shader, not a flag, so nothing errors and the trees just come back soft. Chain instead, and
// chain the cache key with it or the two patched materials collide in acquireProgram (TRAP 2). The
// ink patch has to run FIRST: it inserts its mix line ABOVE `#include <fog_fragment>` and leaves the
// include standing, which is the string this one then replaces. The other order matches nothing and
// says nothing (TRAP 1).
function _fogClamp(m,expr){
  const own=k=>Object.prototype.hasOwnProperty.call(m,k)?m[k]:null;
  const prev=own("onBeforeCompile"), prevKey=own("customProgramCacheKey");
  m.onBeforeCompile=sh=>{
    if(prev)prev.call(m,sh);
    // vDrop rides along for every clamped material whether its expression wants it or not: one
    // patch, one cache key, and a varying a fragment shader never reads costs nothing. mvPosition
    // is in scope at fog_vertex (project_vertex declares it), and it already carries instanceMatrix,
    // so the instanced foliage layers get the same number as the terrain they grow out of.
    sh.vertexShader="varying float vDrop;\n"+sh.vertexShader.replace("#include <fog_vertex>",
      "#include <fog_vertex>\n  vDrop=-dot( mvPosition.xyz, ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );");
    sh.fragmentShader="varying float vDrop;\n"+sh.fragmentShader.replace("#include <fog_fragment>",
      THREE.ShaderChunk.fog_fragment.replace("fogColor, fogFactor )","fogColor, "+expr+" )"));
  };
  m.customProgramCacheKey=()=>(prevKey?prevKey.call(m)+"|":"")+"fogclamp:"+expr;
  return m;
}
// ---------- THE TRAP THAT ALMOST SHIPPED A DIFFERENT WORLD ----------
// v130.3 EVERY THREE.JS CONSTRUCTOR DRAWS FROM THE SEEDED STREAM. Material, BufferGeometry and
// Object3D all take a uuid in their constructor, and r128's MathUtils.generateUUID is four
// Math.random() calls. Inside the window below that is not a detail, it is the wire: welding the
// 195 clearing patches into one mesh removed 195 materials and 195 meshes and 195 clones, the stream
// slid 768 draws to the left, and the map came back with 628 trees where it had 680 — same seed,
// same code path, different world, and PROTO would have had to bump for a draw-call optimisation.
// Nothing in this file said so, `node --check` was happy, and the smoketest passed, because every
// assertion it makes is about SHAPE and the shape was still legal. It was caught by hashing the node
// stream against git HEAD, which is now the only way to be sure of a change in here.
// So: the count of THREE objects built between the two lines below is as load-bearing as the count
// of Math.random() calls, and a merge that saves draw calls has to be paid for BELOW the handback.
// These two arrays are how — the decals are built here, at full price, and welded down there.
// …and PROP_FEET is the third one, for the same reason. Every static thing that stands on the ground
// writes down where its foot is; the dark under it is painted below the handback and welded into the
// patch layer, so the whole near field gets grounded (§8.9) for zero draw calls. Three numbers in an
// array carry no uuid, so a prop can add itself from anywhere, including from inside the seeded
// window (§10.7). See paintContactShadows at the foot of the file.
// v131 ONE FIELD, ASKED BY EVERYTHING THAT GROWS OUT OF IT — see the long note in buildTerrain.
// Returns roughly -1 (lush, cool, dark) … +1 (dry, warm, pale) for any world xz. FOUR SINES, no
// texture and no table: a second map would cost a texture unit, a sampler and one of the ~27 atlas
// cells this overhaul has left (§G.3), while this is eight multiplies evaluated once per vertex and
// once per instance AT BUILD TIME and never again. Periods 363 / 234 / 110 / 62 units — the two
// long ones make the region, the two short ones stop it reading as a sine.
// IT TAKES NO RANDOM AND MINTS NO OBJECT, which is what lets it be called from inside the seeded
// window (§G.4 / :170 below): buildTerrain and plantGrass both run above the handback, and a pure
// function of position moves neither the Math.random() count nor the uuid count. Verified with
// tools/nodehash.js against git HEAD — 736 nodes, identical hash.
function meadowPatch(wx,wz){
  return (Math.sin(wx*0.0173+wz*0.0111+0.7)*0.42+Math.sin(wx*0.0092-wz*0.0257+2.3)*0.30+
          Math.sin(wx*0.0461+wz*0.0338+4.1)*0.19+Math.sin(wx*0.0813-wz*0.0619+1.4)*0.12)/1.03;
}
const PATCH_PARTS=[], ROAD_PARTS=[], PROP_FEET=[];
const __realRandom=Math.random;
Math.random=mulberry32(0x20260710);
/* REGICIDE PVP — 02-world.js */
// ---------- ground & scenery ----------
(function buildTerrain(){
  const geo=new THREE.PlaneGeometry(MAP.x*2+110,MAP.z*2+200,150,120); // v82: reaches under the deepened camp hollows + the Viking bay
  const pa=geo.attributes.position;
  for(let i=0;i<pa.count;i++){
    // plane is XY; after rotation.x=-90°, local +z becomes world up and local y becomes -world z
    pa.setZ(i,terrainHeight(pa.getX(i),-pa.getY(i)));
  }
  geo.computeVertexNormals();
  // elevation tinting: crests lighten, valleys cool and darken, steep faces show dirt —
  // this is what makes the hills READ
  const colArr=new Float32Array(pa.count*3);
  for(let i=0;i<pa.count;i++){
    const wx=pa.getX(i), wz=-pa.getY(i), h=pa.getZ(i);
    const slope=Math.min(1,Math.hypot(
      terrainHeight(wx+2,wz)-terrainHeight(wx-2,wz),
      terrainHeight(wx,wz+2)-terrainHeight(wx,wz-2))*0.45);
    // v130.1 THESE ARE MULTIPLIERS ON A LINEAR ALBEDO, WHICH IS WHY THE HILLS WERE INVISIBLE.
    // They do NOT go through srgb() — that is for authored hexes; the ground's actual colour is
    // grassTex (01-engine.js), which is sRGB-tagged and decoded on sample. But a ±0.10 multiply in
    // LINEAR space is only about ±0.045 of screen value once encoded, which is roughly one JND on
    // a green — so the elevation tint was doing almost nothing and a 534×450 landscape read as a
    // flat billiard table. Opened up ~60%: enough that a crest and a valley are different values
    // in a greyscale copy, not so much that the lawn goes blotchy under the grade.
    const lift=Math.max(-1,Math.min(1,h/2.2));
    let r=1+lift*0.16, gg=1+lift*0.14, b=1+lift*0.08;
    if(lift<0){ r+=lift*0.10; b-=lift*0.08; }          // valleys: darker, cooler
    // v130.3 WHERE THE GREEN WENT — and it is not lost in the pipeline, it was never authored.
    // Eyedropper a flat lit lawn and it comes back around (100,118,48) against §2.2's grass.base
    // #6B8C33 = (107,140,51): red and blue are inside the ±8 tolerance and GREEN IS 22 SHORT. Trace
    // it backwards and the pipeline is faithful — grassTex's five base swatches (01-engine.js:450)
    // average #667A3E, which IS (102,122,63), so the render is reproducing the texture to within a
    // few levels and the texture is the thing that is 18 green low and 12 blue high against the
    // swatch. It was tuned by eye in the era §1.8 describes, when nothing on screen matched its own
    // hex, and it never got re-measured after the encode landed.
    // The texture lives in another file. The ground's vertex colour lives in this one and multiplies
    // the map in exactly the same slot, so the correction goes here: a per-channel gain that lands
    // flat lit ground on the swatch. LINEAR, because that is the space a colour attribute multiplies
    // in — the sRGB deltas above work out to (1.13, 1.34, 1.16) there. It is applied BEFORE the
    // slope lerp on purpose: those three targets are absolute multipliers chosen to make dirt out of
    // this texture, and pushing green into them would turn every steep face into moss.
    r*=1.13; gg*=1.34; b*=1.16;
    // v131 THE FIELD WAS ONE GREEN AND THE ONLY THING BREAKING IT UP WAS A PER-PIXEL DITHER.
    // grassTex is high-frequency noise, so a 534×450 lawn had variation at the TEXEL and variation
    // at the HILL (the ±0.16 elevation lift above) and nothing in between — and terrainHeight() is
    // gentle enough that almost the whole playable field sits inside one elevation band. At vista
    // range the dither averages out to a single flat value and the noise that survives reads as
    // compression mush rather than as ground. Both references get their depth from the band this
    // did not have: meadow-sized patches of drier and lusher grass, tens of units across, that the
    // eye reads as terrain before it reads any single blade.
    // FOUR SINES, NOT A TEXTURE. A second map is a texture unit, a sampler and an atlas cell (§G.3
    // is at ~103 of ~130); four sines are eight multiplies at BUILD time on 18,000 vertices and
    // cost the frame nothing at all. Periods 363 / 234 / 110 / 62 units — the two long ones make
    // the region, the two short ones stop it looking like a sine.
    // AND IT IS NOT A VALUE RAMP, IT IS A DRY/LUSH AXIS. A patch that is only darker reads as a
    // stain; §2.2's dirt.base is warmer AND yellower than grass.base, so the pale half leans that
    // way (more red, much less blue) and the dark half leans the other (cooler, greener). That is
    // the difference between "the lawn has a shadow on it" and "the lawn is two kinds of grass".
    // WHY IT IS HERE AND NOT FOUR LINES DOWN: the slope lerp below drives toward absolute dirt
    // multipliers, and modulating THOSE would make one hillside moss and the next one clay. Same
    // reason the 1.13/1.34/1.16 gain sits above it.
    // …AND THE SAME FIELD DRESSES THE GREENERY STANDING IN IT. First cut modulated the terrain
    // alone at ±0.12 and the whole-frame value spread did not move one thousandth (sd 0.197 →
    // 0.199 on 01-meadow) — because the near field is not terrain, it is fourteen thousand
    // instanced tufts, clovers and shrubs lying ON the terrain, and every one of them was still
    // taking its own tone with no idea what patch of ground it grew out of. A dry meadow with lush
    // grass standing in it is a stain; a dry meadow with dry grass in it is a meadow. So this is a
    // shared function rather than eight lines of sines here — see meadowPatch(), and the four
    // undergrowth layers below that now ask it the same question at their own scatter positions.
    const patch=meadowPatch(wx,wz);
    const dry=Math.max(0,patch), lush=Math.max(0,-patch);
    // ±0.22 linear ≈ ±0.10 screen value. Swept at 0.12 (measured: the block-16 spread of the near
    // lawn did not move at all), 0.17 and 0.22; 0.22 is the last step before the flat field starts
    // showing the sines as bands rather than as ground, which is the same cliff the 195 clearing
    // patches fell off at :271 and for the same reason — a lawn tolerates a lot of TONE and no EDGE.
    const V=1+patch*0.22;
    r*=V*(1+dry*0.15)*(1-lush*0.09);
    gg*=V*(1-dry*0.02)*(1+lush*0.04);
    b*=V*(1-dry*0.21)*(1+lush*0.07);
    // ...and the slope tint is now real dirt rather than "darker green". §2.2 puts dirt.base at
    // #7A6242 against grass at #647D3B, which as a linear ratio is (1.53, 0.60, 1.25) — MORE red
    // and blue, far less green. The old (0.80, 0.68, 0.52) just dimmed the grass, so every steep
    // face read as shadow instead of as exposed earth and the hillsides had no material change on
    // them at all.
    r=r*(1-slope)+slope*1.45; gg=gg*(1-slope)+slope*0.62; b=b*(1-slope)+slope*1.20; // slope dirt
    colArr[i*3]=r; colArr[i*3+1]=gg; colArr[i*3+2]=b;
  }
  geo.setAttribute("color",new THREE.BufferAttribute(colArr,3));
  // v130.1 THE GROUND JOINS THE RAMP. §7.2 says test this rather than assume it, because a 4-step
  // ramp across a 534×450 plane can terrace into hard polygon steps instead of shading — the quads
  // are ~3.5 world units, so a band edge is a visible facet chain, not a curve. Rendered both ways
  // at all six vantages: it does NOT terrace, because terrainHeight() is gentle enough that almost
  // the whole field sits in the ramp's top band and only the steeper faces drop, which is exactly
  // the read we want (a mid-value stage with the hills picked out). Lambert was the last big
  // surface off the shared ramp after the trees, and having 60% of the frame shade on a different
  // curve from everything standing on it is most of why §1.1 says the frame is one value.
  // v130.2 THE HORIZON BAND WAS A SHEET OF MILK AND THE MOUNTAINS WERE ONLY HALF THE REASON.
  // Landing the ridge clamp put peaks on the skyline and left a 90-row band of literally ONE COLOUR
  // underneath them: the ground from the deco cull line (150) out to the map edge (~355) is past
  // fog.far, so every pixel of it is fog.color exactly and the mountains read as floating over a
  // milk sea. §8.1 calls a picture with no content between its bands flat, and it was.
  // The ground gets its own curve past fog.far: fully fogged at the cull line the way §4.2 requires
  // (or distant trees would pop against a ground that is not fogged with them), opening to ~12% of
  // its own colour across the deep field, then closing back to 1.0 by 390 units — which is BEYOND
  // the terrain's own 355-unit corner, so the plane's edge still dissolves into the sky instead of
  // drawing a hard cut-out line across the horizon (§4.3). The result is a shallow green-grey
  // gradient where there was a flat plate: aerial perspective, which is the thing §4.4 is asking
  // for, for zero draw calls and four ALU.
  const g=new THREE.Mesh(geo,_fogClamp(toonMat({color:0xffffff,map:grassTex,vertexColors:true}),GROUND_FOG));
  g.rotation.x=-Math.PI/2; g.receiveShadow=true; scene.add(g);
  // chunky grass tufts + dirt patches for that low-poly MMO look
  // v130.1 RETINT ONLY — this loop is ON THE WIRE. It runs before placeNodes() and burns 4 randoms
  // per iteration, so deleting it, resizing it or changing its call count shifts every node index
  // downstream and forces a PROTO bump (§10.7). The hexes inside the expressions are free.
  // They were 0x7fae54 / 0x5f8a3e — the first of those is BRIGHTER than the lawn it lies on, and at
  // up to 4.5 units across, 195 of them read as spilled paint rather than as tone variation (§1.2).
  // v130.3 …AND THEY STILL READ AS SPILLED PAINT, because the retint fixed the wrong half. Two
  // things announce a ground decal and neither of them is which green it is:
  //   · SEVEN SIDES. At 4.5 units across in the near field a 7-gon is a legible HEPTAGON, and the
  //     eye finds a straight edge on a lawn instantly. 14 sides with a hashed radius (see _discGeo)
  //     is a blob: no two the same, no straight run long enough to trace.
  //   · THE VALUE STEP. The pair was authored against a lawn measuring green 118; the lawn now
  //     measures 135 (see the gain above), so the light one has to move WITH it or it goes from
  //     4 points over the grass to 17 under. These are one small step either side of the terrain's
  //     own corrected albedo (#6C8C44) — +4 levels and -14, so the darker one carries most of the
  //     variation, which is the direction §1.1 wants the histogram to grow anyway.
  // ONE MESH, NOT 195 — but the weld happens BELOW THE LINE. See weldGroundDecals at the foot of the seeded window, and the trap it names:
  // inside the seeded window a decal has to keep costing exactly the objects it always cost, so the
  // disc, the material and the mesh are all still built here and only the SCENE ADD is deferred.
  // The Math.random() order is untouched too: gx, gz, radius, tone, exactly as before (§10.7).
  for(let i=0;i<195;i++){
    const gx=(Math.random()*2-1)*MAP.x, gz=(Math.random()*2-1)*MAP.z;
    const pr=1.5+Math.random()*3, tone=Math.random()<0.5?0x72904A:0x5C7A38;
    const d=drapedDecal(pr,14,tone,gx,gz,0.04,undefined,{wob:0.30});
    PATCH_PARTS.push({geo:d.geometry,matrix:new THREE.Matrix4().makeTranslation(gx,0,gz),color:tone});
  }
  // (the old green border blocks are gone — a mountain ring at EOF frames the world now)
  // (trees now grow in FORESTS below — and every one of them is choppable)
})();

// ---------- resource nodes ----------
// v131 THE RESOURCE PILES WERE THE LAST CLASS STILL FLOATING. v130.4/.5 gave every scattered prop
// two kinds of grounding — a baked vertical ramp on the prop (_contactAO) and a painted pool on the
// ground under it (paintContactShadows) — and the boulders, logs, shrubs, ferns and grass mats all
// got both. The 56 resource nodes got NEITHER, and they are the props the player's camera spends
// the most time parked on, because a villager stands at one for thirty seconds at a time. A stone
// slab rendered one flat value from its crown to the grass line with clean lawn right up to its
// edge, which is the sticker read §8.9 names, on the one object the player is looking at.
// EVERY BYTE OF THIS IS FREE OF THE SEEDED STREAM (§G.4 / :170), which is why it can be here at all:
// _contactAO writes a BufferAttribute and a Float32Array, and neither Object3D, Material nor
// BufferGeometry is constructed — no uuid, no Math.random(), no shift in the node indices on the
// wire. Verified with tools/nodehash.js against git HEAD: 736 nodes, same hash.
// THE THREE FLOORS ARE NOT THE SAME NUMBER and that is deliberate. Gold is the map's one saturated
// warm accent (§8.5) and crushing its underside turns a nugget into a scorch mark, so it barely
// gets one; stone is already §2.4's darkest band so it can take a real one; a berry bush is
// foliage and takes the foliage floor the shrubs use.
function makeNode(type,x,z,amount){
  const g=new THREE.Group();
  if(type==="food"){
    for(let i=0;i<3;i++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(0.9-i*0.12,5,4),mat(0x3e7a35));
      s.position.set((Math.random()-0.5)*1.4,0.7+i*0.28,(Math.random()-0.5)*1.4);
      s.castShadow=true; g.add(s); _contactAO(s,s.position.y,0.54);
    }
    for(let i=0;i<7;i++){
      const b=new THREE.Mesh(new THREE.SphereGeometry(0.16,4,4),mat(0xd23c2f));
      b.position.set((Math.random()-0.5)*1.8,0.6+Math.random()*1.1,(Math.random()-0.5)*1.8);
      g.add(b);   // a berry is 0.16 across and is the accent — a ramp on it would only mud it
    }
  }else if(type==="gold"){
    for(let i=0;i<4;i++){
      const n=new THREE.Mesh(new THREE.DodecahedronGeometry(0.55+Math.random()*0.35),mat(0xe0a92e));
      n.position.set((Math.random()-0.5)*1.8,0.4,(Math.random()-0.5)*1.8);
      n.castShadow=true; g.add(n); _contactAO(n,0.4,0.72);
    }
  }else{ // stone: big grey slabs
    for(let i=0;i<5;i++){
      const n=new THREE.Mesh(new THREE.DodecahedronGeometry(0.5+Math.random()*0.5),mat(i%2?0x8d949c:0x757c85));
      n.position.set((Math.random()-0.5)*2.2,0.35+Math.random()*0.3,(Math.random()-0.5)*2.2);
      n.rotation.set(Math.random(),Math.random(),Math.random());
      n.castShadow=true; g.add(n); _contactAO(n,n.position.y,0.60);
    }
  }
  const ny=terrainHeight(x,z);
  g.position.set(x,ny,z); scene.add(g);
  const node={type,x,z,y:ny,amount:amount||(type==="food"?950:850),mesh:g,r:2.2};
  nodes.push(node); return node;
}
(function placeNodes(){
  for(const side of [-1,1]){
    // base clusters
    for(const [bx,bz] of [[140,-38],[148,32],[125,-58]])
      for(let i=0;i<3;i++)makeNode("food",side*bx+(Math.random()-0.5)*8,bz+(Math.random()-0.5)*8,380);
    for(const [gx,gz] of [[135,52],[155,-10]])
      for(let i=0;i<3;i++)makeNode("gold",side*gx+(Math.random()-0.5)*8,gz+(Math.random()-0.5)*8,300);
    // forward (contested) clusters
    for(let i=0;i<3;i++)makeNode("food",side*(65+Math.random()*20),40+(Math.random()-0.5)*27,650);
    for(let i=0;i<3;i++)makeNode("gold",side*(70+Math.random()*20),-42+(Math.random()-0.5)*25,600);
  }
  // STONE: a scarce critical mineral — exactly 5 piles on the whole map
  makeNode("stone",-148,12,500); makeNode("stone",148,-12,500);   // one near each team
  makeNode("stone",-88,-18,700); makeNode("stone",88,18,700);     // midpoints
  makeNode("stone",0,-30,900);                                    // center (clear of the bazaar)
  // center prize
  for(let i=0;i<4;i++)makeNode("gold",(Math.random()-0.5)*30,(Math.random()-0.5)*40,900);
  for(let i=0;i<5;i++)makeNode("food",(Math.random()-0.5)*35,(Math.random()-0.5)*45,950);
})();

// ---------- the Kings Road's course (shared by the road decals AND the bazaars) ----------
// Mirror-symmetric about x=0: z(t)===z(1-t), so anything placed at t and 1-t is
// EXACTLY as far from one throne as from the other.
function roadPoint(t){
  const A=TCPOS[0],B=TCPOS[1];
  return {x:A[0]+(B[0]-A[0])*t,
          z:A[1]+(B[1]-A[1])*t+Math.sin(t*Math.PI)*16+Math.sin(t*Math.PI*3)*4};
}
// ---------- neutral trade bazaars ----------
// v78: all three sit ALONG the Kings Road — a near stall for each team and the center
// prize — nudged just off the ruts so the traffic rolls past the stalls.
const BAZAAR_T=[0.28,0.5,0.72]; // road fractions: mirrored pair + dead center (the balance dial)
(function placeNeutralMarkets(){
  for(const t of BAZAAR_T){
    const rp=roadPoint(t), x=rp.x, z=rp.z+3.2;
    const g=new THREE.Group();
    const plaza=new THREE.Mesh(new THREE.CylinderGeometry(4.5,4.8,1.6,10),mat(0xd9c48f));
    plaza.position.y=-0.55; g.add(plaza); // sunk plinth: the top stays level, slopes stay hidden
    for(const [px,pz] of [[-2.4,-2.4],[2.4,-2.4],[-2.4,2.4],[2.4,2.4]]){
      const post=cyl(0.14,0.14,3,0x8a6a3f); post.position.set(px,1.5,pz); g.add(post);
    }
    // v130.1 ROOF/WALL CONTRAST — and this is the pair the wide shot actually shows.
    // The three "pale cottages" in 06-wide are these: a gold canopy at 0.72 screen value sitting on
    // a sand plinth at 0.80, a delta of 0.08 against §2.4's hard floor of 0.25, so at 46px the whole
    // stall read as one undifferentiated blob with a slightly yellower lid. (They are easy to
    // mistake for age-1 houses at that size, which is exactly the problem.)
    // Inverted rather than dimmed: the canopy takes §2.4's roof.terracotta (0.40) and the GOLD moves
    // to the trim ring, where a thin bright band against a dark roof is a stronger accent than a
    // whole gold roof ever was — and the frame keeps its one warm note (§8.5) instead of losing it.
    // Delta is now 0.40, roof darker, which is what makes a market read as a market from across the
    // map instead of as a pale smudge on the road.
    const canopy=cone(4,1.6,0xB4543A,4); canopy.position.y=3.6; canopy.rotation.y=Math.PI/4; g.add(canopy);
    const trim=cone(4.2,0.4,0xCFB53B,4); trim.position.y=2.95; trim.rotation.y=Math.PI/4; g.add(trim);
    for(let i=0;i<3;i++){
      const crate=box(0.8,0.8,0.8,0xb08a5a); crate.position.set(-1.5+i*1.5,0.65,(i%2?1.4:-1.2)); crate.rotation.y=i*0.7; g.add(crate);
    }
    const rug=box(2.6,0.06,1.7,0x8e1f1f); rug.position.set(0.4,0.28,3.2); rug.rotation.y=0.2; g.add(rug);
    const rugT=box(2.7,0.05,0.3,0xe0a92e); rugT.position.set(0.4,0.32,3.95); rugT.rotation.y=0.2; g.add(rugT);
    for(let i=0;i<2;i++){ // wares dangling from the canopy edge
      const str=cyl(0.03,0.03,0.7,0x9a8a6a,4); str.position.set(-2.2+i*4.4,2.6,2.1); g.add(str);
      const good=new THREE.Mesh(new THREE.SphereGeometry(0.24,6,5),mat(i?0xc23a3a:0xe0a92e));
      good.position.set(-2.2+i*4.4,2.15,2.1); good.castShadow=false; g.add(good);
    }
    const pot=cyl(0.35,0.25,0.7,0xa8623a,7); pot.position.set(-2.6,0.6,-1.8); g.add(pot);
    const pot2=cyl(0.28,0.2,0.55,0x8e4a2a,7); pot2.position.set(-2,0.5,-2.3); g.add(pot2);
    const lant=box(0.28,0.36,0.28,0xd9a92e); lant.position.set(2.4,2.3,2.3); lant.castShadow=false; g.add(lant);
    g.position.set(x,terrainHeight(x,z),z); scene.add(g);
    // v131.1 …AND THE THREE BAZAARS WERE THE LAST STATIC THING ON THE MAP STANDING ON CLEAN LAWN.
    // Every boulder, log, shrub, fern, grass mat, tree and resource pile writes a foot down for
    // paintContactShadows; a 9-unit sand plinth carrying a 4.5-unit canopy did not, so the one
    // structure the wide shot puts in the middle of an open meadow was a pale disc laid on green
    // with a hard rim and no dark anywhere — the sticker read §8.9 names, at the largest size it
    // occurs at outside a town.
    // 5.3 IS 1.14× THE PLINTH, NOT THE 1.8× THE NOTE AT paintContactShadows ARGUES FOR, and the
    // difference is the prop. 1.8× is what a 3-unit shrub needs so the pool is not a doormat hidden
    // under its own leaves; on a disc nine units across the same ratio paints a sixteen-unit stain
    // in the middle of the meadow. What a plinth wants is a RIM — the core stop sits under the sand
    // where nobody sees it and what shows is the tight band at the foot plus the down-sun tail,
    // which is exactly the shape a 4.4-unit canopy throws at §3.1's 50°.
    // Free of the seeded stream (§G.4 / :170): three numbers into an array carry no uuid, and the
    // geometry they turn into is built by paintContactShadows below the handback at :1840.
    PROP_FEET.push([x,z,5.3]);
    neutralMarkets.push({x,z});
  }
})();

// ==================== v130 W1: THE FOLIAGE SHADING KIT ====================
// THE 23,000 WHITE LEAVES. Every InstancedMesh in this file called setColorAt(), and every one of
// those tints was computed, uploaded, and thrown away. r128's color_fragment reads
//     #elif defined( USE_COLOR )   diffuseColor.rgb *= vColor;
// and color_pars_fragment declares `varying vec3 vColor` under USE_COLOR alone. USE_INSTANCING_COLOR
// gets a varying in the VERTEX stage and nothing to receive it in the FRAGMENT stage — verified in
// the shipped libs/three.min.js, not assumed. USE_COLOR comes from material.vertexColors and from
// nowhere else, so with vertexColors:false the instance colour was multiplied into a varying the
// fragment shader never declared, and dropped on the floor. ~23,000 blades, clovers, bushes, ferns,
// blossoms and stalks all rendered at flat material white.
// That is also why every green below had been dropped and dropped again by hand ("dropped hard",
// "read as bleached patches"): the author was chasing a brightness that was never coming from the
// hex codes at all, because the hex codes were never reaching the screen.
// Flipping vertexColors on is only HALF the fix. The flag also binds `attribute vec3 color`, and an
// unbound attribute reads (0,0,0) — the layer renders BLACK, which is a worse bug than white. So
// every base geometry gets its colour attribute here FIRST and the flag flips after.
function _unitColor(g){ // flat 1.0: pure pass-through, the per-instance tint IS the albedo
  const n=g.attributes.position.count;
  g.setAttribute("color",new THREE.BufferAttribute(new Float32Array(n*3).fill(1),3));
  return g;
}
// The same attribute with the vertical gradient baked in, pow 1.2 (ART-DIRECTION §7.4). Free
// contact AO — a blade goes dark where it meets the ground, which is the one cheap thing that stops
// twenty thousand pieces of greenery reading as stickers hovering a millimetre above the lawn
// (§1.4). Driven off the geometry's own Y extent, not uv.y, because the shrub icosahedron and the
// open-ended fern cone carry no bottom-to-top UV.
// v130.1 THE RANGE MOVED DOWN A BAND: 0.55→1.15 became 0.42→0.95. Two reasons, and the second is
// the one that shows. The tips were multiplying a §2.3 undergrowth tone (0.28–0.36) by 1.15 while
// _skyward pins the blade normals at the ramp's TOP cell, so every blade rendered a clear band
// LIGHTER than the lawn it grows out of — twenty thousand pale strips standing on a mid-green
// field, which is why they read as scattered posts rather than as grass (§8.8). Ending the ramp
// just UNDER 1.0 settles the mass into the lawn instead of on top of it. And the contact end at
// 0.55 was not dark enough to be a seam; at 0.42 there is a real shadow where a stem meets the
// ground, which is the cheapest grounding in the game (§1.4) and the p05 end of the histogram §1.1
// says the frame does not have. Same one multiply per vertex, same zero draw calls.
// v130.2 AND DOWN A BAND AGAIN: 0.42→0.95 becomes 0.30→0.80, because 0.95 was still not under the
// lawn. A blade tip measured out at HSL L 0.45 against a 0.33 field — brighter than the ground it
// grows in — so half the greenery read as pale cardboard signage standing in a lawn and the other
// half as black slivers, which is the exact "green glass shards" complaint. The tip has to end
// BELOW the terrain's own lit value, not just below 1.0, because _skyward hands every blade the
// ramp's top cell while most of the ground is a band under it. 0.30 at the contact is the other
// half: with the root now the WIDEST part of the blade (see _tuftGeo) there is real dark mass down
// where the stem meets the dirt, which is the closest thing to a contact shadow that costs nothing
// (§8.9). Still one multiply per vertex, still zero draw calls.
function _groundedColor(g){
  const p=g.attributes.position, n=p.count;
  let lo=Infinity,hi=-Infinity;
  for(let i=0;i<n;i++){const y=p.getY(i);if(y<lo)lo=y;if(y>hi)hi=y;}
  if(hi-lo<1e-4)return _unitColor(g); // a disc lying flat on the ground has no tip to lighten
  const a=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const v=0.30+0.50*Math.pow((p.getY(i)-lo)/(hi-lo),1.2);
    a[i*3]=a[i*3+1]=a[i*3+2]=v;
  }
  g.setAttribute("color",new THREE.BufferAttribute(a,3));
  return g;
}
// v130.4 …AND THE SAME TRICK FOR A PROP THAT IS NOT A BLADE OF GRASS. §7.4 asks for baked contact AO
// on static props and the boulders and deadfall never got it: a stone rendered one flat value from
// its crown to the grass line, which is the read that makes the foreground float (§8.9). Turning the
// shadow map on for them is right and is done, but §3.1 fixes the sun at 50°, so a one-unit boulder
// throws a 0.85-unit shadow and it throws it AWAY from the default camera — measured against a
// caster-off render it moves 0.016% of the frame. The grounding has to be painted, and painted it
// works at every camera angle and at every hour.
// TWO THINGS THIS HAS TO DO THAT _groundedColor DOES NOT:
//   · MEASURE THE RAMP IN WORLD SPACE. These props are randomly rotated in all three axes, and a
//     ramp baked down local +y comes out pointing wherever the die landed — the dark side ends up on
//     top of a third of the boulders. Reading the mesh's own matrix costs one row of it and no
//     objects at all (Matrix4 and Euler carry no uuid — only Object3D, BufferGeometry, Material and
//     Texture draw from the stream, which is the whole trap at the top of this file).
//   · START AT THE GROUND, NOT AT THE GEOMETRY'S BOTTOM. A boulder is sunk into the terrain; the
//     vertices below the grass line are invisible and would eat the entire ramp if they anchored it.
// 0.62 at the contact, not _groundedColor's 0.30: stone is already §2.4's darkest band and a blade of
// grass is not. Anything lower turns a boulder into a hole.
function _contactAO(m,lift,lo){
  m.updateMatrix();
  const e=m.matrix.elements, p=m.geometry.attributes.position, n=p.count;
  let hi=-Infinity;
  const yw=new Float32Array(n);
  for(let i=0;i<n;i++){
    yw[i]=e[1]*p.getX(i)+e[5]*p.getY(i)+e[9]*p.getZ(i);
    if(yw[i]>hi)hi=yw[i];
  }
  const span=Math.max(1e-3,hi+lift);
  const a=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const v=lo+(1-lo)*Math.pow(Math.max(0,Math.min(1,(yw[i]+lift)/span)),1.2);
    a[i*3]=a[i*3+1]=a[i*3+2]=v;
  }
  m.geometry.setAttribute("color",new THREE.BufferAttribute(a,3));
  m.material.vertexColors=true;                 // the attribute goes on FIRST — §10.8
  return m;
}
// THE ONE TRICK THAT MAKES STYLISED GRASS WORK — lifted to file scope in v130 because two layers
// growing through each other were doing two different things with it (see plantGrass below).
// A blade is a vertical plane, so its normal points sideways — edge-on to a sun that is almost
// overhead. Under a toon ramp that is not a slightly darker green, it is a hard drop into the
// BOTTOM cell, and thousands of blades render as thousands of near-black slivers scattered over a
// bright lawn. Point every blade normal at the sky instead: the grass then takes the same light as
// the ground it grows from, reads as one lit surface, and the silhouette still does the shape work.
// …but only PART of the way. Snapping the normal fully to +Y hands every blade the maximum the sun
// has to give, which is just the opposite failure: 20,000 pieces of greenery all pinned to the
// ramp's top cell, rendering as pale mint confetti. Blending toward the sky keeps them firmly in
// the lit bands while leaving enough of the real normal that a leaning blade still shades
// differently from an upright one.
const SKY_BLEND=0.45; // tuned by eye against renders: 1.0 blows out, 0.7 still reads mint, 0.45 sits in the lawn
function _skyward(g){
  const n=g.attributes.normal, v=new THREE.Vector3();
  for(let i=0;i<n.count;i++){
    v.fromBufferAttribute(n,i);
    v.set(v.x*(1-SKY_BLEND),v.y*(1-SKY_BLEND)+SKY_BLEND,v.z*(1-SKY_BLEND)).normalize();
    n.setXYZ(i,v.x,v.y,v.z);
  }
  n.needsUpdate=true; return g;
}
// v130.2 A BLADE OF GRASS IS NOT A PLANEGEOMETRY. Every greenery layer in this file scattered a
// single flat rectangle per instance, and at 2x in the foreground that is exactly what they read
// as: hard-edged vertical cards with no taper, no root, and a dead straight bottom edge slicing
// into the ground. Worse, a single plane has ONE facing — stand it edge-on to the camera and it is
// a one-pixel sliver, so half of any patch vanished and the other half stamped like signage. The
// critic's word was "green glass shards stuck in a lawn" and it was the right word.
// Three fixes live in this one function, and they are the cheapest three in the overhaul because
// the geometry is shared by an InstancedMesh — the whole change costs two extra triangles per
// instance and NOT ONE draw call (§9.2: instanced foliage runs 10,240 tris to the call).
//   · TWO PLANES CROSSED AT 90°, so there is no angle you can stand at where a tuft is edge-on.
//   · TAPER. Each blade runs from a wide root to a near-point tip, so the silhouette is a leaf
//     rather than a domino, and the widest part of the mass sits where _groundedColor is darkest —
//     the root flare and the contact AO reinforce each other instead of fighting.
//   · A LEAN, baked per blade and alternating, so the two planes splay outward from the base
//     instead of standing as a perfect cross. A tuft with a splay reads as growth; a perfect cross
//     reads as a signpost.
// The base is sunk `sink` below y=0 as well: the hard bottom edge is what was making a visible
// seam with the terrain, and burying it is free where a contact decal would be a draw call.
function _tuftGeo(w,h,sink){
  const tipW=w*0.16, lean=w*0.55;              // near-point tip; the splay is a fraction of the root
  const pos=[], nor=[], uv=[], idx=[];
  for(let k=0;k<2;k++){
    const a=k*Math.PI/2+0.35;                  // 0° and 90°, rolled off-axis so a tuft is never square-on
    const dx=Math.cos(a), dz=Math.sin(a);
    const off=(k?-1:1)*lean;                   // alternate the splay so the pair opens out
    const nx=-dz, nz=dx;                       // in-plane normal; _skyward tilts it toward the sun after
    const v=[[-dx*w*0.5,-sink,-dz*w*0.5],[dx*w*0.5,-sink,dz*w*0.5],
             [dx*(off+tipW*0.5),h-sink,dz*(off+tipW*0.5)],[dx*(off-tipW*0.5),h-sink,dz*(off-tipW*0.5)]];
    const b=k*4;
    for(const p of v){pos.push(p[0],p[1],p[2]);nor.push(nx,0,nz);}
    uv.push(0,0, 1,0, 1,1, 0,1);               // unused today, but every other geo in the file has them
    idx.push(b,b+1,b+2,b,b+2,b+3);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  return g;
}
// THE GREENS, RE-AUTHORED. With the tint finally reaching the fragment, every hand-darkened tone in
// this file was suddenly authoring the colour it claimed to, and the world went to mud. These are
// ART-DIRECTION §2.3 verbatim where the spec names a role, and same-family interpolations where a
// layer wants more than three steps of variety. All authored sRGB — they get decoded on the way
// into the instance buffer, see the note at setColorAt.
// The point of the numbers: foliage albedo lands at 0.19–0.36 screen value while fog.color sits at
// 0.80. That ~45-point gap is the entire depth effect — dark masses stamping against bright haze.
const FOL={
  a:0x5E8232, b:0x4C6E2A, c:0x6F9038,   // §2.3 undergrowth.a/b/c — the lawn, 0.33 / 0.28 / 0.36
  ab:0x55782E, ac:0x668935,             // two in-betweens so the big blade layer has five steps
  leaf:0x47702C, leafMid:0x3F6429,      // §2.3 broadleaf.base — the shrub and fern mass
  needle:0x38562A,                      // §2.3 conifer.base, 0.26 — the darkest thing that grows
  warm:0xE8B54A, cool:0xD66E8C,         // §2.3 blossom.warm / blossom.cool
  cream:0xE8DCBE, violet:0xA87ACB, amber:0xE0913F // restrained neighbours; the old set was neon
};

// ---------- sparse grass: scattered patches of small clumped blades ----------
(function plantGrass(){
  const mats=[]; const dummy=new THREE.Object3D(); const col=new THREE.Color();
  // v130 W1: this layer is ON THE WIRE — it runs inside the seeded window and burns 7 randoms per
  // blade, and plantForests() draws from the same stream, so every node index downstream of here
  // moves if the CALL COUNT moves. Retinting is free (the constants inside an existing expression
  // are not the stream); adding a jitter would not be. Four tones in, four tones out.
  const tones=[FOL.a,FOL.b,FOL.c,FOL.ab];
  const PATCHES=310;
  for(let p=0;p<PATCHES;p++){
    const cx=(Math.random()*2-1)*MAP.x, cz=(Math.random()*2-1)*MAP.z;
    const blades=6+((Math.random()*7)|0);
    for(let b=0;b<blades;b++){
      // v130.2 THE CLUMP RADIUS WAS THE WHOLE PROBLEM WITH THE LAYOUT. 6–13 blades spread over a
      // 1.6-unit disc land about a unit apart, which is far enough that every one of them stands
      // ALONE — §8.8 asks for clumps with hard defined edges and this was scatter. At 0.55 the same
      // blade count overlaps into one mat with a readable outline, and the patch reads as a tuft of
      // grass rather than as litter. It is a constant inside an existing Math.random(), so the call
      // count — and every node index downstream on the wire — is untouched (§10.7).
      const a=Math.random()*Math.PI*2, r=Math.random()*0.55;
      const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r;
      dummy.position.set(x,terrainHeight(x,z),z);
      dummy.rotation.y=Math.random()*Math.PI;
      dummy.rotation.z=(Math.random()-0.5)*0.3;
      const sc=0.55+Math.random()*0.5; dummy.scale.set(sc,sc,sc);
      dummy.updateMatrix();
      col.setHex(tones[(Math.random()*tones.length)|0]).offsetHSL(0,0,(Math.random()-0.5)*0.04);
      mats.push([dummy.matrix.clone(),col.clone()]);
    }
  }
  // v130.2: was PlaneGeometry(0.22,0.5) translated up by half its height — one flat card with a
  // dead straight bottom edge. See _tuftGeo: crossed, tapered, root-flared, and sunk 0.04 so the
  // bottom edge is under the dirt instead of drawing a line across it.
  const bladeGeo=_tuftGeo(0.30,0.52,0.04);
  // v130 W1: this layer used to snap its normals HARD to +Y while the v128 undergrowth blended 45%,
  // and it was the only lit grass in the game still on Lambert while its neighbours were on the toon
  // ramp. Two normal treatments and two lighting models inside a metre of each other — the v34
  // blades sat a full band brighter than the v128 ones they grow through. One helper, one ramp now.
  _groundedColor(_skyward(bladeGeo));
  const inst=new THREE.InstancedMesh(bladeGeo,
    _fogClamp(toonMat({side:THREE.DoubleSide,vertexColors:true}),GROUND_FOG),mats.length);
  // ...and the tint goes in LINEAR. setColorAt writes raw into the instance buffer with no decode,
  // and since v130 the frame is sRGB-encoded on the way out, so an authored hex handed over as-is
  // gets encoded a second time and comes back a full band pale. (01-engine.js:195 lists these
  // layers by name as needing exactly this.)
  for(let i=0;i<mats.length;i++){inst.setMatrixAt(i,mats[i][0]);inst.setColorAt(i,mats[i][1].convertSRGBToLinear());}
  inst.instanceMatrix.needsUpdate=true;
  if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  // v130.4 THE GREENERY CATCHES SHADOW NOW, and this is the biggest single piece of §3.8 still
  // opted out: "everything that stands on the ground receives", and the layer that covers the near
  // field is the one that did not. A tree shadow used to cross a lawn and stop at every tuft — the
  // ground went dark and twenty thousand blades standing in it stayed fully lit, so the shadow read
  // as a stain UNDER the grass instead of as shade ON it, and the near field went on floating (§8.9)
  // however many casters were added. Casting stays off (that is the expensive half, and §9.4 gates
  // it behind ?gfx=high); receiving is a per-object uniform bool in r128, not a program define — no
  // new program, no new draw call, and BasicShadowMap does not put receivers in the shadow pass the
  // way VSM would. Measured: zero change in draw calls.
  inst.castShadow=false; inst.receiveShadow=true;
  inst.frustumCulled=false; // v128: see the note in undergrowth() — this layer was half-invisible too
  scene.add(inst);
})();

// ---------- FORESTS: the wood economy ----------
// v114 THE GREAT WOOD. Two problems with the v34 tree: it stood 5.5 units tall next to a
// 4.43-unit nutcracker (a "forest" you could see over), and it was a GROUP OF THREE MESHES —
// so a map flush with trees meant thousands of draw calls. Both are fixed here:
//   · trees now stand ~13 units — three times a soldier, tall enough to ride a knight under
//   · every tree is ONE vertex-coloured mesh built from a handful of pre-merged geometries,
//     so a tree costs a single draw call and the whole forest shares one material
// Every tree is still a real, choppable wood node — John's call over an instanced backdrop.
// v130.1 THE COLOURS GO IN LINEAR. This is the bug that made the forest paler than the lawn.
// A vertex-colour attribute multiplies diffuseColor in the fragment shader exactly the way
// material.color does, so it needs exactly the same sRGB->linear decode that toonMat() applies at
// 01-engine.js:204 — and it never got one, because this merge predates the encode fix by two
// years. Once the frame started encoding on output, every hex baked in here came back at
// c^(1/2.2): #358825 (0.39) rendered as #7BA364 (0.56). The map's dominant object class went pale
// desaturated sage, LIGHTER than the ground it stands on, which inverts the one rule §0 says
// governs every other rule. srgb() is the door and this is one of the three routes 01-engine.js
// names as still needing it.
// `color` may also be a FUNCTION (x,y,z,nx,ny,nz)->hex, evaluated per vertex AFTER the matrix is
// applied. That is how the mountain ridge gets a lit and a shaded facet out of one cone without
// minting a second material or a second draw call — the ridge is 82% fogged, so the ramp's own
// terminator is crushed to nothing there and the fold has to live in the albedo.
// v130.2 W2 TWO OPTIONAL EXTRAS, BOTH PAID FOR IN VERTICES RATHER THAN DRAW CALLS.
//   opt.shell = w   append a baked ink outline, w world units thick (see below)
//   part.round      blend that part's normals toward a sphere centred on {x,y,z} by k (0..1)
// Both default off, so the mountain ridge and anything else calling this keeps the old behaviour
// byte for byte.
function _mergeColored(parts,opt){ // parts: [{geo, matrix, color, round}] -> one vertex-coloured BufferGeometry
  // (r128 ships BufferGeometryUtils as a separate file the game doesn't load, so merge by hand)
  opt=opt||{};
  let n=0;
  const bufs=parts.map(p=>{
    const g=(p.geo.index?p.geo.toNonIndexed():p.geo.clone());
    // applyMatrix4 transforms the NORMALS too (via the normal matrix), so the cones keep the
    // smooth shading ConeGeometry gave them. Recomputing normals here flat-shades every facet
    // and the canopy reads as pale mint instead of forest green.
    g.applyMatrix4(p.matrix);
    const at=n; n+=g.attributes.position.count;
    return {g,at,round:p.round,c:(typeof p.color==="function"?p.color:srgb(p.color))};
  });
  const w=opt.shell?1:0;
  const pos=new Float32Array((w?n*2:n)*3), nor=new Float32Array((w?n*2:n)*3), col=new Float32Array((w?n*2:n)*3);
  const ink=w?new Float32Array(n*2):null;   // 0 = body vertex, 1 = shell vertex; read by TREE_MAT's patch
  let o=0;
  const _tmp=new THREE.Color();
  for(const {g,c} of bufs){
    const k=g.attributes.position.count;
    pos.set(g.attributes.position.array,o*3);
    nor.set(g.attributes.normal.array,o*3);
    if(typeof c==="function"){
      const P=g.attributes.position, N=g.attributes.normal;
      for(let i=0;i<k;i++){
        const h=c(P.getX(i),P.getY(i),P.getZ(i),N.getX(i),N.getY(i),N.getZ(i));
        _tmp.setHex(h).convertSRGBToLinear();
        col[(o+i)*3]=_tmp.r;col[(o+i)*3+1]=_tmp.g;col[(o+i)*3+2]=_tmp.b;
      }
    }else for(let i=0;i<k;i++){col[(o+i)*3]=c.r;col[(o+i)*3+1]=c.g;col[(o+i)*3+2]=c.b;}
    o+=k;
  }
  // ---------- the baked ink shell: an outline for ZERO draw calls ----------
  // v128.1 tried to outline the forest with inkOutline() and the `v114 draw budget` assertion went
  // red inside a second, exactly as designed — a hull CHILD makes a tree two meshes and doubles a
  // thousand-mesh forest. The note left at makeTree() said the right fix was to weld the hull into
  // the merged buffer instead. This is that fix.
  // WHY REVERSING THE WINDING IS THE WHOLE TRICK. An inverted hull is normally a second mesh with
  // side:BackSide, and side is a MATERIAL property — unavailable when the point is that body and
  // line share one material and one draw call. But BackSide only means "keep the triangles facing
  // away from the camera", and the winding order decides which those are. Flipping vertex 1 and 2
  // of every shell triangle culls the near half of the shell and leaves the far half, which the
  // body then covers everywhere except the ring around its own silhouette. Same picture, no flag.
  // v130.3 THE LINE IS NO LONGER BAKED — NOT ITS WIDTH AND NOT ITS COLOUR. Both were wrong, and
  // the note that used to sit here ("it cannot carry §2.7's warm #1E1A16, an unlit constant needs a
  // shader of its own") talked itself out of the fix by assuming a shader of its own means a
  // material of its own. It does not: onBeforeCompile on the ONE tree material reaches both halves
  // of the buffer, and a per-vertex flag says which half a fragment came from. See _treeInk below.
  //   · WIDTH. A world-unit offset makes the line's screen weight a function of range, which is the
  //     one thing §7.6 forbids: 0.12 units is 1.5 CSS px on a tree 45 away, 22 px on one at 3, so
  //     the near field wore a heavy black rind and the far field wore nothing. The shell vertices
  //     are now left sitting exactly on the body and pushed in the VERTEX SHADER by the same
  //     px·dist·2/bufH·tanHalfFov conversion inkMaterial uses (01-engine.js:277) — constant CSS
  //     pixels at any distance, on any buffer, which is what makes a drawn line read as drawn.
  //   · COLOUR. Pure black is not in the palette anywhere (§2.6 says never #000000, §2.7 says the
  //     ink is warm #1E1A16), and against a warm frame a black rind reads as a hole rather than as
  //     a line. The shell keeps its (0,0,0) vertex colour so that if the patch ever fails to match
  //     the shader falls back to the old black line rather than to a bright one.
  // THE OFFSET DIRECTION HAS TO BE WELDED FIRST, AND STILL DOES. A cone's base rim carries two normals at one
  // point — the flank's, pointing out, and the cap's, pointing straight down — so pushing each
  // vertex along its own normal tears the shell open along every hard edge, and the line breaks
  // precisely at the bottom edge of each canopy tier, which is the edge doing the most work.
  // Averaging every normal that shares a position closes it, for one hash pass at build time.
  if(w){
    const key=new Array(n), acc=new Map();
    for(let i=0;i<n;i++){
      const k2=Math.round(pos[i*3]*1e4)+","+Math.round(pos[i*3+1]*1e4)+","+Math.round(pos[i*3+2]*1e4);
      key[i]=k2;
      let a=acc.get(k2); if(!a){a=[0,0,0];acc.set(k2,a);}
      a[0]+=nor[i*3];a[1]+=nor[i*3+1];a[2]+=nor[i*3+2];
    }
    for(let i=0;i<n;i++){
      const a=acc.get(key[i]);
      let x=a[0],y=a[1],z=a[2];
      const L=Math.sqrt(x*x+y*y+z*z);
      // a fully opposed pair (the two faces of a flat sheet) cancels to nothing — fall back to the
      // vertex's own normal rather than collapsing the shell onto the body
      if(L<1e-6){x=nor[i*3];y=nor[i*3+1];z=nor[i*3+2];}else{x/=L;y/=L;z/=L;}
      const j=n+i;
      // the shell sits ON the body — the push is a per-frame job now (see _treeInk), and the welded
      // direction rides along in the normal so the vertex shader has it without a second attribute
      pos[j*3]=pos[i*3]; pos[j*3+1]=pos[i*3+1]; pos[j*3+2]=pos[i*3+2];
      nor[j*3]=x;nor[j*3+1]=y;nor[j*3+2]=z;         // col stays at the (0,0,0) the array was born with
      ink[j]=1;
    }
    for(let t=n;t<n*2;t+=3){                        // reverse each triangle: swap its 2nd and 3rd vertex
      const a=(t+1)*3, b=(t+2)*3;
      for(let c2=0;c2<3;c2++){
        let s=pos[a+c2]; pos[a+c2]=pos[b+c2]; pos[b+c2]=s;
        s=nor[a+c2]; nor[a+c2]=nor[b+c2]; nor[b+c2]=s;
      }
    }
  }
  // ---------- spherical normal blend, body only ----------
  // A stack of cones shades like a stack of cones: every point on one flank has the SAME dotNL, so
  // a tier is one flat band of colour top to bottom and the canopy has no darkening toward its own
  // base (§1.5's third complaint, and the one the ramp alone cannot fix). Leaning the normals
  // toward a sphere centred in the middle of the canopy mass makes the whole crown shade as one
  // ball — lit cap, terminator, dark underside — while the silhouette stays the tiered conifer.
  // It runs AFTER the shell so the hull is still built from the true surface direction: a hull
  // pushed along faked normals is not a hull, it is a lava lamp.
  for(const {at,g,round:rd} of bufs){
    if(!rd)continue;
    const k=g.attributes.position.count, kk=rd.k===undefined?0.7:rd.k;
    for(let i=at;i<at+k;i++){
      let dx=pos[i*3]-rd.x, dy=pos[i*3+1]-rd.y, dz=pos[i*3+2]-rd.z;
      const d=Math.sqrt(dx*dx+dy*dy+dz*dz); if(d<1e-6)continue;
      dx/=d;dy/=d;dz/=d;
      let x=nor[i*3]*(1-kk)+dx*kk, y=nor[i*3+1]*(1-kk)+dy*kk, z=nor[i*3+2]*(1-kk)+dz*kk;
      const L=Math.sqrt(x*x+y*y+z*z); if(L<1e-6)continue;
      nor[i*3]=x/L;nor[i*3+1]=y/L;nor[i*3+2]=z/L;
    }
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute("position",new THREE.BufferAttribute(pos,3));
  out.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  out.setAttribute("color",new THREE.BufferAttribute(col,3));
  if(w)out.setAttribute("aInk",new THREE.BufferAttribute(ink,1));
  out.computeBoundingSphere();
  // the shell now leaves the buffer at body width and grows in the vertex shader, so the bounds no
  // longer contain it. Half a unit covers the widest the line ever gets (1.6 CSS px at the cull
  // line is ~0.45 world units); without it a tree on the frustum edge loses its outline first.
  if(w&&out.boundingSphere)out.boundingSphere.radius+=0.5;
  return out;
}
// ---------- the tree line: §7.6's screen-space hull, on one material and zero draw calls ----------
// Two patches on the ONE tree material, both keyed off the aInk attribute _mergeColored welds in.
// VERTEX — push the shell along its welded normal by inkPx CSS pixels' worth of view space. This is
// inkMaterial's conversion (01-engine.js:277) with the same units and the same reason: dividing by
// the CSS buffer height rather than by the device buffer keeps the weight identical on a phone at
// pixel ratio 0.7 and on a desktop at 1, and dividing by nothing at all is what made the line a
// slab in the near field and a hairline at range.
// FRAGMENT — replace the shell's colour with §2.7's warm near-black. It goes in AT THE FOG LINE,
// which is after <tonemapping_fragment> and <encodings_fragment>, so the constant written here is
// literal sRGB and lands on screen as authored — the same reason the sky dome can carry
// scene.fog.color byte for byte (§4.3). Writing it before the encode would put it through
// exposure 0.50 and it would render at half the value it says.
// TRAP — the two traps at the top of this file both apply. Replace the INCLUDE, not the expansion;
// and give the material its own customProgramCacheKey, because acquireProgram's lookup is global
// and the default key is the closure's source text.
const _INK_PUSH={value:0.0};
function _treeInk(m,px){
  const c=new THREE.Color(0x1E1A16);          // §2.7 ink — warm near-black, never #000000
  m.onBeforeCompile=sh=>{
    sh.uniforms.inkPush=_INK_PUSH;
    sh.vertexShader="attribute float aInk;\nvarying float vInk;\nuniform float inkPush;\n"+
      sh.vertexShader.replace("#include <project_vertex>",
        "#include <project_vertex>\n"+
        "  vInk=aInk;\n"+
        "  float inkW=aInk*inkPush*max(-mvPosition.z,1.0);\n"+
        "  mvPosition.xyz+=normalize(transformedNormal)*inkW;\n"+
        // …and a hair TOWARD the camera with it. The old shell stood 0.12 world units proud of the
        // body in 3D, which is why it beat the tree behind it at a silhouette; a shell that only
        // moves sideways on screen sits at its body's own depth and loses that tie, and the line
        // came back stitched — solid against sky, dashed wherever two canopies overlap. This is the
        // same job polygonOffset does for inkMaterial (§7.6 forbids removing it there), scaled with
        // distance so the bias is constant in SCREEN terms and never opens a gap of its own.
        "  mvPosition.z+=inkW*1.5;\n"+
        "  gl_Position=projectionMatrix*mvPosition;");
    sh.fragmentShader="varying float vInk;\n"+
      sh.fragmentShader.replace("#include <fog_fragment>",
        "  gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3("+c.r.toFixed(5)+","+c.g.toFixed(5)+","+c.b.toFixed(5)+"),vInk);\n"+
        "#include <fog_fragment>");
  };
  m.customProgramCacheKey=()=>"treeink";
  // The line has to be re-derived whenever the buffer or the fov moves, exactly like inkMaterial's:
  // a resize or the battery saver's pixel-ratio change silently rescales every outline in the game
  // otherwise. 01-engine.js owns the door (window.__syncInk) and calls it from the resize path, the
  // saver and 06-input; wrap it rather than adding a second listener nobody will remember to fire.
  // …and it runs under the smoketest's no-op renderer too, which is `{setSize,setPixelRatio,render,
  // shadowMap,domElement}` and nothing else. Reaching for getDrawingBufferSize there threw at LOAD
  // time and took all fourteen files down with one message and no line number. Everything the buffer
  // can tell us is optional; the fallback is the vista buffer's own height, which is the size every
  // render in _art/ is judged at anyway.
  const sync=()=>{
    let cssH=620, t=0.5543;
    try{
      const sz=renderer.getDrawingBufferSize(new THREE.Vector2());
      const dpr=Math.max(0.01,renderer.getPixelRatio?renderer.getPixelRatio():1);
      cssH=Math.max(1,sz.y/dpr);
    }catch(_){}
    try{ t=Math.tan(camera.fov*Math.PI/360); }catch(_){}
    _INK_PUSH.value=px*(2.0/cssH)*t;
  };
  const prev=window.__syncInk;
  window.__syncInk=function(){ if(prev)prev.apply(this,arguments); try{sync();}catch(_){} };
  sync();
  return m;
}
// v130.1 THE ONE LINE. ART-DIRECTION §7.1 calls this "the single largest look change available for
// one line in the entire codebase" and it was right. The forest is the map's dominant object class
// and it was the last big one still off the shared ramp: ~1,000 Lambert trees smoothly shading
// through a continuous gradient in a world where everything else banded, which is why §1.5 says the
// canopies read as green stamps rather than trees. Toon gives every tier a lit face and a shade
// face with a hard terminator between them, on the SAME four light levels as the ground, the
// buildings and the units — which is what makes a world read as one drawing rather than a pile of
// separately-shaded objects.
// The merged geometry carries position/normal/color and no uv; MeshToonMaterial is fine with that,
// because the gradient map is indexed by dotNL, not by uv.
// v130.3 …and the material carries the LINE as well as the body now — see _treeInk. The width
// constant moved from world units to CSS pixels and the colour from black to §2.7's ink, but the
// bargain is unchanged: one material, one draw call, the outline paid for in vertices.
const TREE_MAT=toonMat({vertexColors:true});
// v130.2 THE SHADOW PASS DRAWS THE OTHER SIDE, AND THE BAKED SHELL IS ON IT.
// r128 picks the depth material's side from a lookup — a FrontSide material casts from its BACK
// faces, so the shadow map normally stores the FAR surface of a tree and nothing on the tree can
// ever shadow itself. The ink shell inverts that: its triangles are reverse-wound, so the faces the
// shadow pass keeps are the ones on the NEAR side, half a line-width in FRONT of the trunk. With
// trees now receiving shadow (below) every lit surface of every tree would have tested against a
// depth 0.12 units closer than itself and the whole forest would have gone into shadow — a black
// map, from one flag, with nothing in the diff to point at. Casting from the front faces instead
// puts the stored depth back on the surface that is actually facing the light, and leaves the
// shell's far half — which is behind the body — contributing nothing.
TREE_MAT.shadowSide=THREE.FrontSide;
// …and the shell no longer sits half a line-width in FRONT of the trunk in that depth pass either:
// its vertices are coincident with the body's now and only the main pass pushes them apart, so what
// the shadow map stores is the surface, full stop. The FrontSide flag stays because the reasoning
// above still holds for the far half of the hull.
// The line's weight, in CSS PIXELS — §7.6's 1.6, which is what the old 0.12 world units measured on
// a mid-field tree 45 away and nowhere else. What is bought here is that it measures 1.6 at three
// units too, instead of 22. The conversion runs in _treeInk's vertex patch.
// MEASURED at the base-fight vantage, trees isolated by hiding them and diffing renderer.info:
// 81 draw calls / 15,900 tris with the shell, 81 draw calls / 7,950 tris without. Zero calls, +7,950
// triangles on a ~210k frame — the v114 trade, made again.
// ?ink= still works on it: the geometry is built at load, after 01-engine.js has read the query, so
// ?ink=0 builds the forest with no shell at all rather than a collapsed one — which is also the
// cleanest A/B this file has for what the outline is costing.
const TREE_INK=1.6*(typeof window!=="undefined"&&window.__noInk?0:
  (typeof window!=="undefined"&&window.__inkScale!==undefined?window.__inkScale:1));
if(TREE_INK>0)_treeInk(TREE_MAT,TREE_INK);
// v130.4 THE WOOD FOGS WITH THE GROUND IT GROWS OUT OF, and it has to, because the ground is not on
// the stock curve. A conifer at 150–190 units was resolving to fog.color byte for byte while the
// plain behind it still held a fifth of its own green, so the far stands rendered as pale cut-outs
// pasted over a greener field — §4.3's stated failure mode, arrived at from the other side: it is
// not the sky and the fog disagreeing, it is two things at the same DEPTH disagreeing about how much
// air is in front of them. Sharing the expression is the whole fix and it is free: same string, so
// the clamp is one more program off the same cache key, and the ink patch survives because
// _fogClamp chains now (TRAP 5). It also fixes the pop: the tree and the ground it stands on now
// fade at exactly the same rate, so what blinks out at HIDE_D is a 2%-contrast ghost (§4.2, F6).
_fogClamp(TREE_MAT,GROUND_FOG);
const TREE_GEOS=[], STUMP_GEOS=[], TREE_H=[];
// ONE dial for how tall the wood stands, the way OXSCALE is one dial for the cart. At 1.30 the
// average tree is ~13.3 units against a 4.43-unit nutcracker — three times a soldier's height.
const TREE_SCALE=1.30;
// v131.1 THE 680 TREES WERE THE ONE PROP CLASS WITH A POOL UNDER IT AND NOTHING ON IT.
// v130.4/.5 gave every scattered prop on this map BOTH halves of §7.4's grounding — a baked vertical
// ramp on the prop (_contactAO) and a painted pool on the ground beneath it (paintContactShadows) —
// and v131 finished the job for the 56 resource piles. The wood got exactly half: nodes[] has fed
// paintContactShadows since the pool layer landed, so there has always been dark grass at a trunk,
// and the trunk itself has always rendered ONE flat bark value from the first branch to the grass
// line. That is the read §8.9 names and it is on the most numerous object on the map — a dark pool
// with a flat-lit post standing in the middle of it reads as a tree photographed against a shadow,
// not as a tree standing in one. It is also the exact thing the Valheim reference gets its depth
// from: heavy occlusion in the metre where a trunk meets the litter.
// WHY NOT _contactAO, WHICH ALREADY DOES THIS. That helper reads a MESH — its matrix, its geometry,
// its material — and a tree is none of those yet at this point in the file. TREE_GEOS are eight
// shared buffers built before any tree exists, and the whole v114 bargain is that a tree is one mesh
// on one shared material, so per-mesh anything is off the table. _mergeColored already takes a
// per-vertex colour FUNCTION (it is how the mountain ridge gets a lit and a shaded facet out of one
// cone), and it is evaluated after the matrix, so local y IS height above the grass line. The ramp
// therefore goes into the ALBEDO of the eight shared geometries: one multiply per bole vertex, at
// boot, on eight geometries — and every tree on the map, at any scale and any rotation, inherits it.
// Zero draw calls, zero triangles, zero atlas cells, and it scales WITH the tree because makeTree
// scales the geometry (a 12-unit conifer gets a taller root shadow than a sapling, which is right).
//
// ============ THE TWO THINGS THAT MAKE THIS SAFE INSIDE THE SEEDED WINDOW (§G.4 / :170) ============
//   · IT MINTS NOTHING. A closure is not an Object3D, a BufferGeometry, a Material or a Texture, so
//     it takes no uuid and therefore no four draws off the stream. Taking the FUNCTION branch in
//     _mergeColored also skips one `srgb()` call per bole — and `new THREE.Color` carries no uuid
//     either (r128's Color is three floats), so that is a zero too, in both directions.
//   · IT DRAWS NO RANDOM. The ramp is a pure function of the vertex's own y.
// Verified rather than reasoned: tools/nodehash.js before and after — 736 nodes / 680 wood,
// all=a0e4532bfa20051c, byte for byte.
//
// THE MULTIPLY IS DONE IN LINEAR AND THE BYTES ARE WRITTEN BACK IN sRGB, which is the one place this
// could quietly ship at half strength. _mergeColored decodes whatever hex it is handed
// (`setHex(h).convertSRGBToLinear()`), so scaling the bytes by v scales the ALBEDO by v^2.2 — 0.62
// authored would land as 0.35 and turn every trunk base into the hole §7.4 warns about. Raising v to
// 1/2.2 first makes the linear factor exactly v, which is the space _contactAO and _groundedColor
// both do their arithmetic in, so all three groundings on this map are finally the same number.
// 0.62 at the contact is _contactAO's stone floor and it is here for the same reason: bark is
// already §2.3's second-darkest thing that grows, and anything below it stops being a shadow.
const BOLE_AO_H=1.9, BOLE_AO_LO=0.62;
function _boleAO(hex){
  const r0=(hex>>16)&255, g0=(hex>>8)&255, b0=hex&255;
  return function(x,y){
    const t=Math.max(0,Math.min(1,y/BOLE_AO_H));
    // same pow 1.2 curve as _groundedColor and _contactAO: the dark holds low and lets go quickly,
    // which is what an occlusion falloff looks like and what a linear ramp does not
    const s=Math.pow(BOLE_AO_LO+(1-BOLE_AO_LO)*Math.pow(t,1.2),1/2.2);
    return ((r0*s)&255)<<16 | ((g0*s)&255)<<8 | ((b0*s)&255);
  };
}
(function buildTreeGeometries(){ // eight silhouettes, built once, shared by every tree on the map
  // v130.1 THE SILHOUETTE RULE, RE-AUTHORED. §2.3's hard constraint is that foliage albedo lands at
  // 18–36% screen value while fog.color sits at 80% — that ~45-point gap IS the depth effect, dark
  // masses stamping against bright haze, and it is the thing the forest shots did not have. The old
  // hexes were authored against the broken pipeline (a needle at 0x355f2b was RENDERING at 0x7BA364,
  // 0.56) and were then judged to be about right, so they encode two errors at once.
  // These are §2.3 verbatim: conifer.base #38562A for the body of the canopy with one deeper and
  // one lighter neighbour for stand-to-stand variety, and bark.base #5A422C / bark.shadow #3E2D1E
  // for the boles. They go through srgb() in _mergeColored above, so what is written here is what
  // lands on screen.
  const BARK=[0x5A422C,0x4E3925,0x63492F], NEEDLE=[0x38562A,0x2F4A24,0x40602E,0x33512B];
  // §2.3 broadleaf.base and one neighbour either side. A round crown that took the conifer greens
  // would be a differently-shaped version of the same tree; the whole point of a second species is
  // that it is a second COLOUR MASS as well as a second silhouette, and at 40px the mass is what
  // survives. Warmer and a shade lighter than the needles, which is also what a broadleaf is.
  const BROAD=[0x47702C,0x3F6429,0x4E7A31];
  const M=(x,y,z,sx,sy,sz)=>new THREE.Matrix4().compose(
    new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(sx===undefined?1:sx,sy===undefined?1:sy,sz===undefined?1:sz));
  // v131 EIGHT SILHOUETTES THAT WERE ONE SILHOUETTE. The loop below has always said "eight", and
  // all eight were the same object: a 6-sided bole under three or four stacked 7-sided cones,
  // differing only in a metre of height and which of four greens they drew. 06-wide is 680 of them
  // and reads as a stamped texture, which is the single biggest thing between this forest and the
  // canopy variety the reference gets its depth from. FOUR FORMS now share the eight slots:
  //   · SPRUCE  (0,3,6) — the tiered cone, unchanged; it is the right shape and it is the majority.
  //   · BROADLEAF (1,4) — a short thick bole under a cluster of faceted balls. Different mass,
  //     different colour family, and the one form that breaks up a skyline of triangles.
  //   · SPIRE   (2)     — tall, narrow, steep: the tree that pokes out of the top of a stand.
  //   · CROWN   (5,7)   — a bare bole carrying its whole canopy in the top fifth, umbrella-pine
  //     fashion. This is the form that puts SKY between the trunks in a wood, which is most of why
  //     a real stand reads as depth and a field of cones reads as a wall.
  //
  // ================= THE CONSTRAINT THAT SHAPES ALL OF THIS =================
  // THIS LOOP RUNS INSIDE THE SEEDED WINDOW (§G.4, and the trap written out in full at :170). Both
  // counts are load-bearing, not just one: FOUR Math.random() calls per variant, and exactly
  // 1+`tiers` geometry constructions per tree plus 2 per stump — because r128 mints a uuid in every
  // BufferGeometry constructor and a uuid is four more draws off the same stream. Change either and
  // every node index on the wire slides, the map comes back with a different number of trees, and
  // PROTO has to bump for a shape change. So:
  //   · the four randoms are drawn UP FRONT, unconditionally, before any form decides anything.
  //     Reading them inside a branch is how this gets broken by the next person, quietly.
  //   · every form emits exactly `tiers` canopy parts. A ball, a cone and a flattened disc-cone are
  //     one BufferGeometry each, so the forms are free to differ as long as they count the same.
  // Verified, not assumed: tools/nodehash.js against git HEAD, 736 nodes / 680 wood, same hash.
  for(let v=0;v<8;v++){
    // four draws, in the original order, whatever the form below does with them
    const q1=Math.random(), q2=Math.random(), q3=Math.random(), q4=Math.random();
    const form=(v===1||v===4)?"broad":(v===2?"spire":((v===5||v===7)?"crown":"spruce"));
    // a broadleaf carries its mass low on a stout trunk; a spire and a crown are mostly trunk
    const hK=form==="broad"?0.74:(form==="spire"?1.30:(form==="crown"?1.24:1.0));
    const h=(4.2+q1*1.9)*TREE_SCALE*hK; // the bole (was a 1.8-2.7 stick)
    const rT=(0.34+q2*0.1)*TREE_SCALE*(form==="broad"?1.35:1.0), rB=rT*1.45;
    const bark=BARK[v%BARK.length], needle=(form==="broad"?BROAD[v%BROAD.length]:NEEDLE[v%NEEDLE.length]);
    const parts=[{geo:new THREE.CylinderGeometry(rT,rB,h,6),matrix:M(0,h/2,0),color:_boleAO(bark)}];
    // three tiers of canopy, each narrower and shorter than the one below
    const tiers=3+(v%2);
    // where the canopy starts up the bole — the crown forms hold theirs in the top fifth, which is
    // the whole trick: it is the SKY BETWEEN THE TRUNKS that makes a stand read as depth
    const base=h*(form==="crown"?0.90:(form==="broad"?0.58:0.62));
    let r=(2.6+q3*0.5)*TREE_SCALE, ch=(3.4+q4*0.7)*TREE_SCALE, y=base+ch*0.5;
    const cone=[];
    if(form==="broad"){
      // a round crown out of `tiers` faceted balls: one big one and a ring of smaller ones pushed
      // off-centre, so the outline is lumpy rather than a circle. IcosahedronGeometry(_,0) is 20
      // triangles — the same primitive and the same triangle order of magnitude as a 7-sided cone,
      // which is why this costs the frame nothing (see the shrub layer, which is the same ball).
      const R0=r*0.92;
      y=base+R0*0.72;
      for(let t=0;t<tiers;t++){
        const c=new THREE.Color(needle); c.offsetHSL(0,0,t*0.026);
        const a=t*2.399+v;                                   // golden-angle, so no two lobes stack
        const k=t===0?1.0:0.66+0.10*((t*7)%3);
        cone.push({geo:new THREE.IcosahedronGeometry(R0*k,0),
          matrix:M(t===0?0:Math.cos(a)*R0*0.62,y+(t===0?0:R0*0.42),t===0?0:Math.sin(a)*R0*0.62,1,0.86,1),
          color:c.getHex()});
      }
      y+=R0*0.62; ch=R0*0.9;
    }else if(form==="crown"){
      // umbrella pine: flattened wide discs stacked in the top fifth, widest at the BOTTOM of the
      // crown, so the silhouette is a parasol on a pole instead of a christmas tree
      r*=1.06; ch*=0.42; y=base+ch*0.5;
      for(let t=0;t<tiers;t++){
        const c=new THREE.Color(needle); c.offsetHSL(0,0,t*0.034);
        cone.push({geo:new THREE.ConeGeometry(r,ch,7),matrix:M(0,y,0),color:c.getHex()});
        y+=ch*0.62; r*=0.80; ch*=0.94;
      }
    }else{
      // spruce, and the spire — the spire is the same construction pulled in and stretched up, so
      // it keeps the tiered read that says "conifer" while occupying a completely different box
      if(form==="spire"){ r*=0.62; ch*=1.34; y=base+ch*0.5; }
      for(let t=0;t<tiers;t++){
        // upper tiers catch more light. Opened up from 0.022 because the palette moved down a band:
        // the same absolute lightness step is a bigger RELATIVE step on a 0.26 base than on a 0.39
        // one, but the tiers still have to be legible at the 40-60px a mid-field tree occupies, and
        // three tiers at 0.022 apart were inside the ramp's own band width — invisible.
        const c=new THREE.Color(needle); c.offsetHSL(0,0,t*0.030);
        cone.push({geo:new THREE.ConeGeometry(r,ch,7),matrix:M(0,y,0),color:c.getHex()});
        y+=ch*(form==="spire"?0.40:0.46); r*=form==="spire"?0.80:0.74; ch*=form==="spire"?0.86:0.82;
      }
    }
    const top=y+ch*0.5;
    // ONE centre for the whole crown, not one per tier. Per-tier spheres would shade each cone as
    // its own little ball and hand the tree three separate terminators to read at 40px; a single
    // centre at the middle of the canopy mass gives it ONE, so the crown is a lit shoulder over a
    // dark underside — which is the "dark mass" §2.3 is asking for. Tier-to-tier separation is
    // already carried by the 0.030 lightness step in the albedo above and by the overhang itself.
    for(const p of cone)p.round={x:0,y:(base+top)*0.5,z:0,k:0.7};
    parts.push.apply(parts,cone);
    TREE_GEOS.push(_mergeColored(parts,{shell:TREE_INK}));
    TREE_H.push(top);
    // the stump left when the tree is felled — same bole, cut off at the knees.
    // It gets the line too: a felled stand is a dozen pale sawn discs in a clearing and without an
    // outline they read as litter. (§4 of the work plan calls this out by name — miss the stumps
    // and half the forest loses its line the moment the wood economy starts.)
    // the stump takes the same ramp — it is nothing BUT the metre the ramp covers, so a felled tree
    // sits in its own dark instead of becoming a pale disc floating in the clearing the tree left.
    // The sawn top keeps its flat pale hex: it is the accent that says "this was cut", it faces the
    // sky, and an occlusion ramp has no business on an upward face.
    STUMP_GEOS.push(_mergeColored([
      {geo:new THREE.CylinderGeometry(rB*0.94,rB,h*0.2,6),matrix:M(0,h*0.1,0),color:_boleAO(bark)},
      {geo:new THREE.CylinderGeometry(rB*0.9,rB*0.9,0.12,6),matrix:M(0,h*0.2,0),color:0xc2b191}], // pale sawn top
      {shell:TREE_INK}));
  }
})();
function makeTree(x,z){
  const v=(Math.random()*TREE_GEOS.length)|0;
  const m=new THREE.Mesh(TREE_GEOS[v],TREE_MAT);
  const sc=0.86+Math.random()*0.34;             // no two trees quite the same height
  const ny=terrainHeight(x,z);
  m.position.set(x,ny,z); m.rotation.y=Math.random()*6.28; m.scale.setScalar(sc);
  // v130.2 THE WOOD CATCHES SHADOW NOW (§3.8: everything standing on the ground receives).
  // This was the last big class still opted out, and it is the one where it shows most, because a
  // stand is a hundred trees standing in each other's light: with it off, a tree deep inside a wood
  // was lit exactly as brightly as one on the sunlit edge and the whole stand read as one flat green
  // field. It is also free in r128 — receiveShadow is a per-object uniform bool in
  // lights_pars_begin, not a program define, so the forest still compiles to the one program it
  // already had. Measured: no change in draw calls, no change in programs.
  m.castShadow=true; m.receiveShadow=true;
  // v130.2 …AND THE OUTLINE FINALLY LANDED. v128.1 left a note here saying a hull CHILD breaks the
  // `v114 draw budget` assertion (a tree must be ONE mesh) and that the right fix was to weld the
  // hull into the merged buffer instead. That is now done, up in _mergeColored's `shell` — so the
  // tree is still one mesh, its geometry is still the shared TREE_GEOS entry the assertion checks
  // identity against, and the line costs vertices instead of draw calls. Nothing to add here.
  scene.add(m); worldDeco.push(m);
  const node={type:"wood",x,z,y:ny,amount:140,mesh:m,r:1.5,gv:v,th:TREE_H[v]*sc,canopy:null,trunk:null};
  nodes.push(node);
  return node;
}
function depleteNode(n){
  if(n.type==="wood"&&n.gv!==undefined){ // felled: swap the whole tree for its stump
    n.mesh.geometry=STUMP_GEOS[n.gv]; n.mesh.castShadow=false;
    // …and the ten metres of shade the tree was throwing goes with it. The painted pool is welded
    // into one static buffer with 1,400 others, so it cannot be hidden — it gets repainted in place.
    fellPool(n);
  }else if(n.type==="wood"&&n.canopy){   // (legacy shape — kept so old saves/tests don't crash)
    for(const c of n.canopy)c.visible=false;
    n.trunk.scale.y=0.22; n.trunk.position.y=n.th*0.11;
  }else n.mesh.visible=false;
}
// ---------- planting: the map runs flush with forest, minus the ground the game needs ----------
// Clear lanes matter more than coverage: a wood node blocks building placement (validFor
// refuses anything within r+3 of a live node), so the base yards, the King's Road and the
// bazaar plazas stay open or you couldn't build, march or trade.
const TREE_CLEAR_BASE=52;   // both town-centre yards — room for a full build-out
const TREE_CLEAR_ROAD=21;   // the King's Road corridor stays marchable
const TREE_CLEAR_BAZAAR=15; // trade plazas
const TREE_CLEAR_NODE=8;    // don't bury the stone/gold/berry nodes
// dist2() lives in 04-units.js, which loads AFTER this file — separate <script> tags don't
// share hoisting, so world generation needs its own squared-distance helper.
const _d2=(ax,az,bx,bz)=>{const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz;};
// v114b FORESTS, NOT WOODLAND PASTURE. The first pass planted a jittered grid — one tree every
// 11.5 units over the whole map. From the ground it read as forest, but from above it was uniform
// scrub with no character: no stands to fight through, no meadows to fight in, and wood was
// underfoot everywhere instead of being somewhere you GO. Trees are now grown from a field of
// forest STANDS: density falls off from each stand's centre, so the map gets real woods with open
// country between them, plus a thin scatter of lone trees so the meadows aren't sterile.
const TREE_STANDS=[];
(function plantForests(){
  const ROADPTS=[]; for(let i=0;i<=60;i++)ROADPTS.push(roadPoint(i/60));
  const clearOf=(x,z)=>{
    for(const t of TCPOS)if(_d2(x,z,t[0],t[1])<TREE_CLEAR_BASE*TREE_CLEAR_BASE)return false;
    for(const p of ROADPTS)if(_d2(x,z,p.x,p.z)<TREE_CLEAR_ROAD*TREE_CLEAR_ROAD)return false;
    for(const m of neutralMarkets)if(_d2(x,z,m.x,m.z)<TREE_CLEAR_BAZAAR*TREE_CLEAR_BAZAAR)return false;
    for(const n of nodes)if(n.type!=="wood"&&_d2(x,z,n.x,n.z)<TREE_CLEAR_NODE*TREE_CLEAR_NODE)return false;
    return true;
  };
  // Every stand is placed ONCE and mirrored through the map's centre, (x,z) -> (-x,-z) — the same
  // 180° symmetry the two thrones sit on, so neither team can ever draw the better wood.
  const stand=(x,z,r)=>{TREE_STANDS.push({x,z,r},{x:-x,z:-z,r});};
  stand(148,48,31); stand(122,-58,28);   // THE HOME WOODS: timber inside every team's reach
  // three stands sit deliberately ON the v113 flanking lanes (07-ai's LANE_Z = 0, ±46, ±88 — keep
  // these in step if those move), so a band that swings wide moves through real cover
  stand(64,46,30); stand(120,88,26); stand(18,-88,29);
  // ...and the rest of the wild wood wherever it fits, no two stands sitting on top of each other
  let guard=0;
  while(TREE_STANDS.length<30&&guard++<6000){
    const x=6+Math.random()*(MAP.x-36), z=(Math.random()*2-1)*(MAP.z-28), r=23+Math.random()*21;
    if(!clearOf(x,z))continue;
    let clash=false;
    // 0.8 keeps stands genuinely separate — at 0.42 they merged back into one blurred sheet
    for(const s of TREE_STANDS)if(_d2(x,z,s.x,s.z)<Math.pow(r+s.r,2)*0.8){clash=true;break;}
    if(!clash)stand(x,z,r);
  }
  const STEP=7.4, EDGE=4, LONE=0.03; // 3% of open country carries a lone tree — meadows stay open
  for(let gx=-MAP.x+EDGE;gx<=MAP.x-EDGE;gx+=STEP){
    for(let gz=-MAP.z+EDGE;gz<=MAP.z-EDGE;gz+=STEP){
      const x=gx+(Math.random()-0.5)*STEP*0.9, z=gz+(Math.random()-0.5)*STEP*0.9;
      if(Math.abs(x)>MAP.x-EDGE||Math.abs(z)>MAP.z-EDGE)continue;
      if(!clearOf(x,z))continue;
      let dens=0;
      for(const s of TREE_STANDS){
        const dd=Math.sqrt(_d2(x,z,s.x,s.z));
        if(dd<s.r)dens=Math.max(dens,1-Math.pow(dd/s.r,3.2)); // solid to the heart, ragged only at the eaves
      }
      dens=Math.min(1,dens*1.45+LONE);
      if(Math.random()>dens)continue;
      makeTree(x,z);
    }
  }
})();

// ==================== SCENIC LAYER (v34) ====================
// Everything below is cosmetic, castShadow-free, and distance-culled via worldDeco.
// keep the mountain frame OUT of the creep camp pockets — each camp sits in a carved nook
function nearCamp(x,z,pad){
  for(const C of CAMPS){const dx=x-C.x,dz=z-C.z;if(dx*dx+dz*dz<(C.r+pad)*(C.r+pad))return true;}
  return false;
}
// v130.1 THE HORIZON BAND — the third fog depth band, which did not exist.
// ART-DIRECTION §4.4 wants every wide shot to contain three bands: a saturated near subject, a
// desaturating mid mass, and a horizon ridge reading as a flat silhouette. The world was BUILT with
// a ridge — three rings, ~290 cones — and none of it was ever on screen. Two reasons stacked:
// every cone was pushed into worldDeco, which distance-culls at HIDE_D (150) while the rings stand
// at 219–250, so they were deleted before they were ever drawn; and had they survived, fog.far of
// 150 would have painted them 100% fog colour. So a wide vista was a two-band picture — ground,
// then a featureless sheet of milk above it — which §8.1 calls flat and which is exactly what the
// 06-wide shot has looked like since v34.
// Fixing it is three changes that only work together:
//   · MERGE. ~290 individual meshes become THREE vertex-coloured ones. This is what makes the ridge
//     affordable: uncull 290 draw calls and the frame budget is gone; uncull 3 and it is free. The
//     rings are static and never touched after build, so there is nothing to lose by welding them.
//   · UNCULL. No worldDeco push. A merged ring's bounding sphere spans the map, so it is never
//     frustum-culled either — these are 3 permanent draw calls, which is precisely what §4.4 prices
//     the entire vista at.
//   · CLAMP THE FOG. min(fogFactor, 0.82) in one shader chunk. Without it the ridge renders at
//     exactly fog.color and is invisible; at 0.82 it keeps 18% of its own value and reads as a pale
//     band a few points darker than the sky — a ridge, not a wall. That number is §4.4's target and
//     it is the whole difference between "distance" and "the world ends here".
// Everything below keeps its Math.random() call count byte for byte. These rings run AFTER
// plantForests() so they are downstream of the node stream, but the seeded window is still open
// and there is no reason to spend the risk (§10.7).
// v130.2 THE CLAMP NEVER RAN, AND THE RIDGE WAS INVISIBLE FOR IT. The v130.1 version of this hook
// hand-rolled a .replace() against the EXPANDED fog line and matched nothing, so the whole horizon
// band shipped at fogFactor 1.0 — i.e. at exactly fog.color, i.e. a flat plate of sky where a
// mountain range should be. 115 contiguous scanlines of 06-wide came back >97% one colour and the
// commit comment below confidently described a ridge nobody could see. Both halves of why now live
// in _fogClamp at the top of this file; the number is unchanged, it just executes.
// v130.3 …AND THEN IT EXECUTED AND CAME BACK AS A BAG OF PAPER PARTY HATS. Three separate reasons,
// and only the first one is the fog.
//   · ONE TREATMENT, NOT ONE CEILING. `min(fogFactor, 0.82)` is a ceiling, not a treatment: the
//     rings are RECTANGLES, so the same range stands 79 units from a camera on one side of the map
//     and 230 from the other, and 0.82 only bites past the cull line. The near ring in 03-forest was
//     rendering between 45% and 100% fogged — the same rock in the same shot at 0.28 and at 0.71,
//     which is not a range, it is a scatter. The clamp now has a FLOOR as well: anything past ~90
//     units is pinned into 0.74–0.82 whatever the geometry of the rectangle happens to be, so the
//     whole horizon sits in one narrow value band. The floor fades out under 30 units so a foothill
//     you can walk up to (the inner ring stands only 6 units outside the map edge) still behaves
//     like the solid object it is instead of a ghost in your face.
//   · TINT BY DEPTH, NOT BY ARRAY. The three rings are 219/228/250 out and their cones are 8–20
//     across and jittered ±5, so they INTERLEAVE — a pale haze cone routinely stands in front of a
//     dark rock one, which is most of the "random depths" read. The palette is now a continuous ramp
//     evaluated at each peak's own footprint: two cones standing at the same depth get the same
//     colour whichever loop pushed them, and the range grades from conifer green at the front
//     through warm stone to fog-hue haze at the back the way aerial perspective actually works.
//   · A RIDGE IS A MASSIF WITH PEAKS ON IT. Cones on a flat plain are party hats no matter how they
//     are shaded, because there is nothing joining them — you read the gaps, not the line. The fix
//     is in the PROFILE, not in extra geometry: a cone with height segments and a cubic flare on its
//     lower rows leaves the apex where it was and spreads the base to ~1.9× its footprint, which
//     against a 15–21 unit spacing always reaches its neighbours. Bases overlap into one continuous
//     silhouette and the peaks rise out of it. (A second shoulder CONE would have read the same and
//     cost four draws out of the seeded stream per peak — see the uuid trap at the top of the file.
//     Same picture, same mesh count, same wire.)
const RIDGE_MAT=_fogClamp(toonMat({vertexColors:true}),
  "clamp( fogFactor, 0.74 * smoothstep( fogFar * 0.2, fogFar * 0.6, fogDepth ), 0.82 )");
// v130.5 THE SKYLINE BROKE IN THE MIDDLE OF THE COMPOSITION AND NEITHER DIAL IN mountainRing COULD
// REACH IT. A column probe of 06-wide found 191 contiguous pixels — 17% of frame width, dead centre
// — where the sky ran unbroken into the ground with no ridge value anywhere between, and the round-1
// note blamed the far ring's 30% random skip. It is not the skip. It is `nearCamp`: the Viking bay
// is a 52-unit pocket centred at (0, −169) and all THREE rings step around it, so a 113-unit swathe
// of the south horizon — the one the wide shot is pointed at — is deliberately empty. §4.4's horizon
// band is missing from exactly the part of the frame §8.2 says the eye goes to first.
// Neither prescribed lever works on that, and both are worse than useless:
//   · The flare coefficient is CUBIC and spends itself in the bottom fifth of a cone. It widens the
//     scree, not the silhouette; against a 113-unit hole it would have to reach 4× further than the
//     one at 2.1 already does and the range would read as a row of domes.
//   · Dropping the 0.3 skip changes how many loop bodies RUN, and each body draws six more randoms.
//     That is a different world on the wire, which is the one thing this file may not do.
// So the gaps get recorded where they happen (two numbers in an array, no uuid, no draw) and the
// range is closed BELOW the handback, where geometry is free again — see buildRidgePass. The bridge
// stands 72 units further out than the ring it patches, behind the camp pockets rather than in them,
// so the bay stays walkable and what closes over it is a back range seen past the mouth of a pass.
const RIDGE_GAPS=[]; let RIDGE_FAR_MESH=null;
(function mountainRing(){ // the world's frame: snow-capped peaks over green foothills
  // v128: cold blue-grey peaks are the single most desaturating thing on the horizon of a lush
  // map — they read as a storm front behind a summer meadow. Warmed toward stone-and-moss so the
  // frame belongs to the same picture as the field it surrounds.
  // v130.1: and DARKER, and FACETTED. Two separate failures.
  // Darker, because a ridge that only shows 18% of itself through the fog needs that 18% to be
  // worth something: the old 0x7d7f6e reads 0.49, and mixed 82% into a 0.82 sky it lands at 0.79 —
  // two points off the sky, i.e. nothing. These sit at 0.32–0.36 lit.
  // Facetted, because the merge cost the range its dark side. Every peak used to carry a `hide`
  // texture whose palette pulled it well under its own tint (the baseline shot measures mountain
  // faces at 0.14–0.31), and a merged vertex-coloured mesh has no texture to do that. Rather than
  // give the ridge its own atlas cell, the light/shade split is BAKED: faces turned away from the
  // sun's azimuth carry the shadow hex, so the range keeps a hard terminator at any distance and
  // at any fog factor, including 0.82 where the ramp's own terminator is crushed to nothing.
  // 0.6/0.8 is the sun vector (36,·,48) normalised into xz — the baked fold agrees with the light
  // everywhere else in the frame rather than fighting it.
  const facet=(lit,dk)=>((x,y,z,nx,ny,nz)=>(nx*0.6+nz*0.8>0.02?lit:dk));
  // v130.3 THE THREE PALETTES BECOME ONE RAMP. They are kept verbatim as the ramp's stops — the
  // authoring above is right, it was the ADDRESSING that was wrong. A cone's tint used to come from
  // the array its loop happened to be in, and since the rings interleave by more than their own
  // jitter that put a 0.50 haze cone in front of a 0.32 rock one all along the skyline. Address the
  // ramp by where the peak actually STANDS instead and the range grades continuously from front to
  // back however the cones fall.
  // `q` is the rectangle's own radius, not a circle's: the rings are 1.6× wider than deep, so
  // Euclidean distance from the middle would call the same ring "near" on its long side and "far"
  // on its short one — which is the mistake in miniature.
  const HILL=[0x3E5729,0x2A3B1C], ROCK=[0x5A5D50,0x393C33];      // foothills join the conifer family
  // HAZE — the far range. v130.2: the old pair measured out at S 0.05–0.07, i.e. a NEUTRAL grey,
  // while fog.color is a properly saturated pale blue at S 0.44. A neutral peak seen through a
  // tinted atmosphere is physically wrong and it looks it: the far range read as a sheet of dead
  // cardboard pasted behind a warm green field rather than as land dissolving into air (§1.10,
  // §8.6 — neighbouring regions must belong to one picture). Aerial perspective says the far range
  // is the fog colour, darkened; so these ARE fog's hue family, pulled down to ~0.50/0.46 value and
  // leaned a few degrees toward violet rather than cyan so the range is cool without being icy.
  // S 0.17, not the 0.24 the first pass tried: at the forest vantage the far range stands only
  // ~150 units out and shows most of itself, and at 0.24 it came back a hard cobalt wall behind a
  // green frame — the mirror image of the same mistake.
  const HAZE=[0x6C7E96,0x58697F];
  const _cA=new THREE.Color(), _cB=new THREE.Color();
  const _lerpHex=(a,b,t)=>{_cA.setHex(a);_cB.setHex(b);return _cA.lerp(_cB,t).getHex();};
  const RIDGE_STOPS=[HILL,ROCK,HAZE];
  // `jit` is the per-peak lightness break the array index used to buy by accident (three rock tones,
  // two hill tones). Same Math.random() call, spent on a continuous ±3% instead of a hard pick of
  // three, so no two neighbours land on the same value and the massif still reads as one material.
  const ridgeTint=(px,pz,jit)=>{
    const q=Math.max(Math.abs(px)/1.63,Math.abs(pz));   // rectangle radius: the rings are 1.6:1
    const u=Math.max(0,Math.min(1,(q-128)/32))*2;       // 0 at the foothills … 2 at the back range
    const i=Math.min(1,Math.floor(u)), f=u-i;
    const lit=new THREE.Color(_lerpHex(RIDGE_STOPS[i][0],RIDGE_STOPS[i+1][0],f)).offsetHSL(0,0,jit);
    const dk =new THREE.Color(_lerpHex(RIDGE_STOPS[i][1],RIDGE_STOPS[i+1][1],f)).offsetHSL(0,0,jit);
    return facet(lit.getHex(),dk.getHex());
  };
  // SNOW: was 0xe8ecf0, which measures 0.92 — over the bloom threshold, so every cap in the game
  // had a visible halo bleeding into the sky and read as one flat blown chip with every fold gone
  // (§1.10, §10.22, and F1 was only dodged because blue landed at 247 rather than 255). 0xD2D9E2
  // is 0.845, just under the 0.86 threshold, so the caps stop glowing. The SECOND tone is the other
  // half: a cone 82% fogged has no terminator left, so the fold has to be painted into the albedo
  // rather than lit into it. Split on the sun's own azimuth (36,·,48 normalised → 0.6/0.8 in xz) so
  // the baked fold agrees with the light everywhere else in the frame instead of fighting it.
  const SNOW_LIT=0xD2D9E2, SNOW_DK=0xB4BDC9;
  const snowFacet=(x,y,z,nx,ny,nz)=>(nx*0.6+nz*0.8>0.10?SNOW_LIT:SNOW_DK);
  // Spread a cone's lower rows into a shoulder, in place. The flare is cubic so it is all base and
  // nothing at the summit — at 1/3 height it is already down to a fifth of its strength — which is
  // what makes the result read as a mountain sitting in its own scree rather than as a fat cone.
  // v130.4 THE COEFFICIENTS GO UP, because the range was still breaking where the ring thins. 06-wide
  // showed sky between the bases on the sparse arcs and 02-town's near foothill read as a separate
  // green object standing in front of the massif rather than as its front shoulder — a cone with a
  // clean silhouette IS a separate object, however well it is tinted. The skirt is the only dial that
  // is free here: more cones is more geometry constructors inside the seeded window, and that is four
  // Math.random() draws each and a different world (see the uuid trap at the top of the file), so the
  // ONLY legal move is to make the cones that exist reach further. Near 0.9→1.2, far 0.8→1.3, hills
  // 1.6→2.1, i.e. base radii 2.2×r / 2.3×r / 3.1×r against a 15–21 unit spacing. The cubic keeps all
  // of it in the bottom fifth, so what grows is the ground the range stands in, not the peaks.
  // NORMALS ARE LEFT ALONE ON PURPOSE. Scaling x and z by the same factor cannot rotate a normal in
  // the xz plane, so the baked light/shade split (which is a test on nx and nz) is untouched; only
  // the y tilt is now slightly optimistic, on geometry that is 74–82% fogged and takes its terminator
  // from the albedo anyway. computeVertexNormals here would re-average the seams and cost more than
  // it bought — the same trap _mergeColored warns about for the tree canopies.
  const flare=(g,h,k)=>{
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=Math.max(0,Math.min(1,(p.getY(i)+h*0.5)/h)), f=1+k*Math.pow(1-t,3);
      p.setX(i,p.getX(i)*f); p.setZ(i,p.getZ(i)*f);
    }
    return g;
  };
  const near=[], far=[], hills=[];
  const M=(px,py,pz,ry)=>new THREE.Matrix4().compose(
    new THREE.Vector3(px,py,pz),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),ry),
    new THREE.Vector3(1,1,1));
  const ring=(ox,oz)=>{ // walk the rectangle perimeter
    const pts=[];
    const X=MAP.x+ox, Z=MAP.z+oz;
    for(let x=-X;x<=X;x+=15+Math.random()*6){pts.push([x,-Z]);pts.push([x,Z]);}
    for(let z=-Z;z<=Z;z+=15+Math.random()*6){pts.push([-X,z]);pts.push([X,z]);}
    return pts;
  };
  for(const [x,z] of ring(16,14)){ // the tall back range
    if(nearCamp(x,z,10))continue;  // the pass stays open where a camp nests
    const h=13+Math.random()*11, r=8+Math.random()*6;
    // segments 5–7 -> 7–9. Against a 5-gon a cone has exactly one lit facet and one shaded one, so
    // the whole range read as folded paper; two more facets buy it a shoulder. The constant lives
    // INSIDE the existing Math.random() expression, so the call count is untouched.
    const seg=7+((Math.random()*3)|0);
    // THE PALETTE PICK IS NOW A LIGHTNESS BREAK, and it has to be DRAWN HERE to keep its place in
    // the stream — the tint it feeds needs px/pz, which are two draws later (§10.7: the order of
    // the calls is the wire, not what they are spent on).
    const jr=Math.random();
    const px=x+(Math.random()-0.5)*7, pz=z+(Math.random()-0.5)*7;
    const ry=Math.random()*Math.PI;
    const col=ridgeTint(px,pz,(jr-0.5)*0.06);
    near.push({geo:flare(new THREE.ConeGeometry(r,h,seg,3),h,1.2),matrix:M(px,h*0.42,pz,ry),color:col});
    // v130.2 THE CAPS WERE MUSHROOM LIDS. The cap must INSCRIBE the peak it caps, and r*0.45 does
    // not: the parent cone stands with its base at -0.08h and its apex at 0.92h, so at the cap's own
    // base height (0.78h - 0.15h = 0.63h) the rock has already tapered to 0.29r — the cap was 1.55x
    // wider than the mountain under it, and every peak in the game wore a hard horizontal overhang
    // lip all the way round. Read as a lampshade, not as snow (§5.2 silhouette).
    // r*0.26 × h*0.34 puts the cap base (0.61h, rock 0.31r) comfortably inside the rock and its tip
    // (0.95h) just proud of the summit, which is where snow actually sits.
    if(h>17) // the tall ones wear snow
      near.push({geo:new THREE.ConeGeometry(r*0.26,h*0.34,seg),matrix:M(px,h*0.78,pz,ry),color:snowFacet});
  }
  for(const [x,z] of ring(38,32)){ // the FAR RANGE: taller, hazier, half-lost in the fog
    // v130.5 WHERE THE RANGE DOESN'T GET BUILT IS NOW WRITTEN DOWN, because that is where the
    // skyline breaks and neither of the two dials in this loop can reach it. See buildRidgePass at
    // the foot of the file for what happens to the list. Recording a pair of numbers in an array is
    // the only thing that can happen here: an Array literal carries no uuid, so it draws nothing
    // from the stream (§10.7) — a cone HERE would draw four and rebuild the world.
    if(Math.random()<0.3){RIDGE_GAPS.push([x,z]);continue;}
    if(nearCamp(x,z,6)){RIDGE_GAPS.push([x,z]);continue;}
    const h=22+Math.random()*14, r=13+Math.random()*7;
    const jr=Math.random();
    const px=x+(Math.random()-0.5)*10, pz=z+(Math.random()-0.5)*10;
    const ry=Math.random()*Math.PI;
    const col=ridgeTint(px,pz,(jr-0.5)*0.05);
    far.push({geo:flare(new THREE.ConeGeometry(r,h,8,3),h,1.3),matrix:M(px,h*0.42,pz,ry),color:col});
    // same overhang arithmetic as the near range: cap base at 0.76h-0.18h = 0.58h, where the rock
    // measures 0.34r, so 0.28r inscribes it and the lip is gone.
    far.push({geo:new THREE.ConeGeometry(r*0.28,h*0.36,8),matrix:M(px,h*0.76,pz,ry),color:snowFacet});
  }
  for(const [x,z] of ring(7,6)){ // green foothills in front, sparser
    if(Math.random()<0.45)continue;
    if(nearCamp(x,z,8))continue;
    const h=4.5+Math.random()*4, r=5+Math.random()*3.5;
    const jr=Math.random();
    const px=x+(Math.random()-0.5)*5, pz=z+(Math.random()-0.5)*5;
    const col=ridgeTint(px,pz,(jr-0.5)*0.06);
    // the foothills are the sparsest ring (55% of the perimeter survives) and the smallest, so their
    // flare has to work hardest: at 2.1 the skirt reaches across a skipped point as well as an
    // adjacent one, which is what turns a row of little cones into a swell of ground — and it is the
    // ring that has to stop reading as OBJECTS, because it is the one the town shots see close.
    hills.push({geo:flare(new THREE.ConeGeometry(r,h,7,3),h,2.1),matrix:M(px,h*0.4,pz,0),color:col});
  }
  // three meshes, three draw calls, an entire horizon. NOT pushed into worldDeco — the whole point
  // is that this band survives the cull line that deleted it for six versions.
  for(const parts of [near,far,hills]){
    if(!parts.length)continue;
    const m=new THREE.Mesh(_mergeColored(parts),RIDGE_MAT);
    m.castShadow=false; m.receiveShadow=false;
    scene.add(m);
    if(parts===far)RIDGE_FAR_MESH=m;   // buildRidgePass welds into this one rather than adding a fourth
  }
})();
(function kingsRoad(){ // a winding dirt road from throne to throne — the "hold the road" band's home
  // v130.1 THE ROAD WAS NEVER A ROAD. 53 discs of radius 2.1–2.9 laid 6.73 units apart cannot
  // touch each other: the widest possible pair still leaves 0.9 units of grass between them, so
  // every render containing the road showed a chain of separate brown lozenges marching away from
  // the camera. That is F10, an automatic fail, and it has been in every shot since v34.
  // The arithmetic is the whole fix: consecutive discs overlap when the radius clears half the
  // spacing, 3.37. At 4.2–5.4 they overlap by 1.5–3 units and weld into one continuous ribbon with
  // a scalloped edge, which is what a rutted cart track looks like from above anyway.
  // N STAYS AT 52 AND THE CALL COUNT STAYS AT ONE PER SEGMENT (§10.7): the seeded window places
  // nodes[] positionally and the netcode indexes them, so a single extra Math.random() here moves
  // every node index on the wire. Radius coefficients inside an existing expression are free;
  // segment count is not a random at all.
  // Colours to §2.2 road.base / road.dark — the old pair was a pale sandy tan that sat brighter
  // than the grass, so the road read as a light stripe instead of a worn-in dark one.
  const N=52;
  // RUTS, not noise. The modulation is addressed by where the ground is, but a wash of blobs would
  // still be a brown amoeba with a pattern on it — what makes a dirt track read as a TRACK is two
  // wheel ruts running down it. roadPoint() is invertible (x is linear in t), so a vertex can ask
  // what the centreline's z is at its own x and get its offset ACROSS the track for free; the ruts
  // then follow every bend in the road rather than cutting across it. Two dark bands at ±2.35 on a
  // ~9.6-unit ribbon, plus a slow longitudinal wear so no two stretches are the same.
  // v130.4 AND IT WAS STILL THE LARGEST DEAD AREA IN THE FRAME, because the modulation was right and
  // the RANGE was nothing. Sampled across the near road in 05-lowsun: modal (143,113,68), per-channel
  // standard deviation 7.1 / 13.5 / 3.6 over 62,900 pixels — flatter than the lawn beside it, and in
  // a greyscale copy of 02-town the road and the grass are the same object. Two arithmetic reasons:
  //   · §2.2's road.base and road.dark are SIX POINTS OF VALUE APART (0.40 / 0.34), so a mix of the
  //     two spans a range narrower than the noise in the grass texture. A rut is not a lighter dirt,
  //     it is dirt in its own shade, so the ramp gets a third stop — §2.2's dirt.shadow at 0.28, the
  //     hex this palette already keeps for earth that never sees the sun. Base→dark→deep is a 12
  //     point spread and it reads at play distance.
  //   · The old ramp never REACHED either end: t swung 0.26–0.78, so the crown was a 74% mix and the
  //     rut cores an 22% one. Eleven levels of red, on a surface 200 pixels across. Now the crown
  //     sits at the top stop and the rut cores land in the third one.
  // THE VERGE IS THE OTHER HALF, and it is the answer to the scalloped edge as well. The outer ~1.8
  // units of the ribbon now darken into the third stop, so where the road meets grass there are two
  // steps rather than one hard line, and the eye stops tracing the disc arcs (a second inset PASS of
  // dark discs would have done the same thing for 53 more geometries and an inner boundary that
  // misregisters on every bend — this follows the true edge of the union for free).
  // ONE THING THIS DELIBERATELY DOES NOT DO: tint by DISC INDEX. §2.2 calls road.dark "alternating
  // segment" and alternating consecutive discs is the obvious reading, but a per-disc constant is a
  // hard colour discontinuity along a disc's own rim, which is precisely the lily-pad artefact v130.2
  // spent a round removing. The alternation is bought from three coprime sines of world position
  // instead: same read down the length of the road, no seam anywhere for the eye to catch.
  // v130.5 THE HEXES ARE PRE-DIVIDED BY WHAT THE FRAME DOES TO THEM, the same correction and for the
  // same reason as the terrain's vertex gain above. Eyedropper the shipped road and the crown stop
  // measured (152,119,74) against the authored #8A7150 = (138,113,80): red +10%, green +5%, blue
  // −7.5%. That ratio is the sun tint times the grade pass's 0.97 on blue, both of which live in
  // other files and are right for everything else in the frame — so the road cannot be fixed by
  // arguing with them, only by authoring the value that comes OUT the far end. These three are
  // §2.2's road.base / road.dark / dirt.shadow divided by that measured gain, so the render lands
  // on (138,113,80) / (116,96,63) / (87,68,51) instead of 13 blue short of all three. Re-measure
  // before touching them: they are a correction, not a palette, and if the grade moves they move.
  const _rA=new THREE.Color(0x7D6B56), _rB=new THREE.Color(0x695B44), _rC=new THREE.Color(0x4F4137);
  const _rc=new THREE.Color();
  const _A=TCPOS[0], _B=TCPOS[1];
  const _ss=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  // v130.5 AND THE BANDING WAS BEING EATEN BY ITS OWN NOISE. The snap to fifths was doing exactly
  // what the comment claimed; what it snapped was a signal the `wear` term had already scrambled.
  // The three sines summed to ±0.58 against a stop spacing of 0.40, so which of the five stops a
  // vertex landed on was decided by the noise and not by where it sat across the track: the crown
  // wandered over stops 0–2 and the rut cores over 1.2–2.0, and 57,000 road pixels came back with
  // a modal of 16% and a per-channel std of 12/10/6 — a smooth vignette, measured and rendered.
  // Three changes and the first is the one that matters:
  //   · THE NOISE GOES UNDER HALF A STOP (±0.23). It still breaks the tone across disc boundaries,
  //     which is its whole job, but it can no longer move a vertex more than one stop, so the rut
  //     decides the band and the wear only decides which side of an edge a given patch falls on.
  //   · FOUR STOPS, NOT SIX. Two thirds of a t-unit apart instead of two fifths, which is 12–18
  //     screen levels between neighbours rather than 8. A band edge you have to look for is a
  //     gradient with extra steps.
  //   · THE RUT IS A RUT, NOT A TROUGH. exp(-d²·2.6) instead of 1.15 halves the wheel track's width
  //     to ~0.9 units, so the dark core is a band the width of a cart wheel and the ground between
  //     the two of them comes back up to the crown stop — which is the read that says "two wheels
  //     went down here" rather than "the middle of this is darker".
  const roadTint=(x,y,z)=>{
    const u=Math.max(0,Math.min(1,(x-_A[0])/(_B[0]-_A[0])));
    const zc=_A[1]+(_B[1]-_A[1])*u+Math.sin(u*Math.PI)*16+Math.sin(u*Math.PI*3)*4;
    const off=Math.abs(z-zc);                       // distance ACROSS the track
    const d=off-2.30, rut=Math.exp(-d*d*2.6);       // the two wheel ruts, at a wheel's width
    const verge=_ss(3.1,4.6,off)*1.10;              // worn earth at the edges, into the third stop
    const wear=0.10*Math.sin(x*0.21+z*0.13)         // three coprime sines: the "alternating segment"
              +0.08*Math.sin(x*0.52-z*0.37)         // read, addressed by world position so it crosses
              +0.05*Math.sin(x*1.07+z*0.61);        // disc boundaries instead of drawing them
    // …AND THEN IT IS BANDED, which is the difference between a road and a stain. Everything else in
    // this world takes its shape from a hard terminator (§3.7 — the ramp exists to stop values from
    // sliding), so the road takes one too: snapping t to thirds puts the whole swing into three
    // edges instead of spending it on a gradient. It cannot be sharper than the mesh — a vertex
    // colour interpolates, so an edge is one cell wide — which is what the ring bump below is for.
    // 1.75, not 1.35: at 1.35 the deepest stop was authored and never reached — t topped out at 1.63
    // against the 1.667 the fourth stop starts at, so dirt.shadow sat in the file doing nothing and
    // the road's whole value range was two stops wide (p1→p99 luminance 0.106, measured). At 1.75 the
    // core of each wheel track drops into it for the ~0.35 units where the rut is deepest — a thin
    // darkest line down the middle of a broader dark band, which is what a wheel actually leaves.
    const t=Math.max(0,Math.min(2,0.05+1.75*rut+verge+wear));
    const q=Math.round(t*1.5)/1.5;
    return (q<=1?_rc.copy(_rA).lerp(_rB,q):_rc.copy(_rB).lerp(_rC,q-1)).getHex();
  };
  // v131.13 ONE RIBBON, NOT 53 DISCS. See the note at the head of this function: five passes
  // improved the discs and none of them could stop a union of circles from having a scalloped
  // outline, because the scallops ARE the circles. A swept quad strip has no disc boundaries in it
  // at all, and it costs ONE mesh either way — this still lands in ROAD_PARTS and is welded below.
  //
  // THE RANDOM BUDGET IS UNCHANGED AND THAT IS LOAD-BEARING. §10.7: the seeded window places
  // nodes[] positionally and the netcode indexes them, so one extra Math.random() in this function
  // moves every resource node on the wire. The half-width is drawn from exactly the same
  // `4.55+Math.random()*0.55`, once per cross-section, in the same order — 53 calls, as before.
  // The node hash (tools/townages.js) must read 3ad55989 after this change or it is wrong.
  const HW=[], CEN=[];
  for(let i=0;i<=N;i++){
    HW.push(4.55+Math.random()*0.55);            // the ONE random per segment — do not add another
    CEN.push(roadPoint(i/N));                    // the ONE course — the bazaars sit on the same curve
  }
  // Subdivide BETWEEN the cross-sections so the ribbon drapes over terrain relief instead of
  // spanning it: the spine samples are ~6.7 units apart and the terrain moves inside that.
  const SUB=4, M=N*SUB;
  const pos=[], idx=[];
  const _p=(t)=>{ const q=Math.max(0,Math.min(1,t)); return roadPoint(q); };
  for(let j=0;j<=M;j++){
    const t=j/M;
    // the tangent, from a short central difference on the real spine
    const e=0.0009, p0=_p(t-e), p1=_p(t+e);
    let tx=p1.x-p0.x, tz=p1.z-p0.z;
    const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
    const nx=-tz, nz=tx;                          // the across-track normal
    const c=_p(t);
    // half-width lerped between the two nearest sampled cross-sections, so the edge keeps the
    // same gentle breathing the discs had without any of them being individually legible
    const f=t*N, i0=Math.min(N,Math.floor(f)), i1=Math.min(N,i0+1), fr=f-i0;
    let hw=HW[i0]+(HW[i1]-HW[i0])*fr;
    // …AND THE VERGE IS WHERE A RIBBON CAN GO WRONG IN THE OTHER DIRECTION. The first cut used a
    // single small wobble on the half-width and came back as a brown strip with two straight
    // parallel edges — which fixes "a bunch of circles" and replaces it with "a paved road", on a
    // dirt cart track. What a worn verge actually is: the edge wanders because the traffic did.
    // So each side is hashed off ITS OWN world position (not the spine's, or both edges would
    // wander in lockstep and the ribbon would just snake), three coprime sines, ±0.82 on a ~4.8
    // half-width = ±17%. Deterministic by construction — no Math.random here, §10.7.
    for(const sgn of [-1,1]){
      const ex=c.x+nx*sgn*hw, ez=c.z+nz*sgn*hw;      // the nominal edge, then perturb it
      const wob=0.42*Math.sin(ex*0.63+ez*0.41)
               +0.26*Math.sin(ex*1.31-ez*0.87)
               +0.14*Math.sin(ex*2.90+ez*2.10);
      const w=hw+wob;
      const px=c.x+nx*sgn*w, pz=c.z+nz*sgn*w;
      pos.push(px,terrainHeight(px,pz)+0.06,pz);
    }
  }
  for(let j=0;j<M;j++){
    const o=j*2;
    idx.push(o,o+1,o+2, o+1,o+3,o+2);
  }
  const rgeo=new THREE.BufferGeometry();
  rgeo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  rgeo.setIndex(idx);
  rgeo.computeVertexNormals();
  // identity matrix: the ribbon is already authored in world coordinates
  ROAD_PARTS.push({geo:rgeo,matrix:new THREE.Matrix4(),color:roadTint});
})();
(function ponds(){ // still water, sandy rims, reeds and cattails
  for(const [px,pz,pr] of [[-105,82,6.5],[98,-88,7],[-24,-104,5.5]]){
    const y=terrainHeight(px,pz);
    const rim=new THREE.Mesh(new THREE.CircleGeometry(pr+1.3,10),mat(0xcbb488));
    rim.rotation.x=-Math.PI/2; rim.position.set(px,y+0.04,pz); rim.castShadow=false; scene.add(rim); worldDeco.push(rim);
    const water=new THREE.Mesh(new THREE.CircleGeometry(pr,10),
      new THREE.MeshLambertMaterial({color:0x4a7a9c}));
    water.rotation.x=-Math.PI/2; water.position.set(px,y+0.09,pz); water.castShadow=false; scene.add(water); worldDeco.push(water);
    for(let i=0;i<2;i++){ // lily pads
      const pad=new THREE.Mesh(new THREE.CircleGeometry(0.55,6),mat(0x5f8a3e));
      pad.rotation.x=-Math.PI/2;
      pad.position.set(px+(Math.random()-0.5)*pr,y+0.12,pz+(Math.random()-0.5)*pr);
      pad.castShadow=false; scene.add(pad); worldDeco.push(pad);
    }
    for(let i=0;i<9;i++){ // reeds and cattails around the bank
      const a=Math.random()*Math.PI*2, rr=pr+0.5+Math.random()*1.2;
      const rx=px+Math.cos(a)*rr, rz=pz+Math.sin(a)*rr;
      const reed=cyl(0.045,0.06,1.0+Math.random()*0.6,0x4a6a30,4);
      reed.position.set(rx,terrainHeight(rx,rz)+0.55,rz);
      reed.rotation.z=(Math.random()-0.5)*0.25; reed.castShadow=false; scene.add(reed); worldDeco.push(reed);
      if(i%3===0){const tail=cyl(0.09,0.09,0.3,0x6b4a2b,4);
        tail.position.set(rx,terrainHeight(rx,rz)+1.35,rz); tail.castShadow=false; scene.add(tail); worldDeco.push(tail);}
    }
  }
})();
(function wildflowers(){ // instanced blossoms in drifts — nearly free
  // v130 W1: also on the wire (seeded window), also retint-only — the tone count stays at four so
  // the single Math.random() that picks one stays a single Math.random().
  const tones=[FOL.cool,FOL.cream,FOL.violet,FOL.warm];
  const items=[]; const dummy=new THREE.Object3D(); const col=new THREE.Color();
  for(let p=0;p<16;p++){
    const cx=(Math.random()*2-1)*(MAP.x-24), cz=(Math.random()*2-1)*(MAP.z-20);
    for(let f=0;f<8;f++){
      const a=Math.random()*Math.PI*2, r=Math.random()*3.2;
      const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r;
      dummy.position.set(x,terrainHeight(x,z)+0.16,z);
      dummy.rotation.x=-Math.PI/2+((Math.random()-0.5)*0.4);
      const sc=0.7+Math.random()*0.6; dummy.scale.set(sc,sc,sc);
      dummy.updateMatrix();
      col.setHex(tones[(Math.random()*tones.length)|0]);
      items.push([dummy.matrix.clone(),col.clone()]);
    }
  }
  // a petal disc lies flat and faces the sky, so no gradient and no skyward blend — just the unit
  // attribute the vertexColors flag demands, or the whole drift renders black (§10.8)
  const geo=_unitColor(new THREE.CircleGeometry(0.2,5));
  const inst=new THREE.InstancedMesh(geo,_fogClamp(toonMat({side:THREE.DoubleSide,vertexColors:true}),GROUND_FOG),items.length);
  for(let i=0;i<items.length;i++){inst.setMatrixAt(i,items[i][0]);inst.setColorAt(i,items[i][1].convertSRGBToLinear());}
  inst.instanceMatrix.needsUpdate=true;
  if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  inst.castShadow=false; inst.receiveShadow=true;  // §3.8: a blossom lying in a tree's shade is in shade
  inst.frustumCulled=false; scene.add(inst); // v128: same culling trap
})();
(function rocksAndLogs(){ // boulder clusters and mossy deadfall
  for(let c=0;c<8;c++){
    const cx=(Math.random()*2-1)*(MAP.x-30), cz=(Math.random()*2-1)*(MAP.z-24);
    const n=2+((Math.random()*2)|0);
    for(let i=0;i<n;i++){
      // v130.1 §2.4 stone.base / stone.shadow. 0x8d949c is a cold pale blue-grey — at 0.58 it sat
      // BRIGHTER than the lawn and read as a scatter of pale pebbles dropped on the field, and its
      // temperature belonged to the storm-front mountains v128 already warmed away from. Warm grey,
      // one band down, and a boulder is a dark mass in the lower third the way §8.3 wants.
      const b=new THREE.Mesh(new THREE.DodecahedronGeometry(0.5+Math.random()*0.7),
        mat(i%2?0x827E72:0x5C594F));
      const bx=cx+(Math.random()-0.5)*3, bz=cz+(Math.random()-0.5)*3;
      b.position.set(bx,terrainHeight(bx,bz)+0.3,bz);
      b.rotation.set(Math.random(),Math.random(),Math.random());
      // v130.4 A BOULDER SITTING ON GRASS WITH NO DARK UNDER IT IS A STICKER. §8.9 wants contact
      // shadows wherever a thing meets the ground and the near field had NONE: 05-lowsun measured
      // 3.2% of visible ground in shadow and zero of it in the front half of the frame, because the
      // only casters out here were trees and the trees are all at the edges. These are the props the
      // eye is closest to, so they are the ones whose grounding is missed. The half-rate shadow pass
      // (renderer.shadowMap.autoUpdate=false, refreshed on even frames) takes ~20 boulders and 6 logs
      // amortised to ~13 submissions a frame, and none of it lands in renderer.info.render.calls —
      // r128 resets the counter after shadowMap.render(), so §9.3's budget is untouched (§9.1).
      // The INSTANCED layers stay off: 14,000 tufts is a different order of cost and §9.4 gates that
      // behind ?gfx=high.
      // v130.5 …AND THE SHADOW MAP NEVER DELIVERED IT. The caster flag above is right and it still
      // renders nothing the player can see: §3.1 fixes the sun at (120,168,80) relative to its
      // target, so every shadow on this map lies toward −x−z, and five of the six vista cameras look
      // that way too. The shadow of a boulder is BEHIND the boulder from every angle the game is
      // played at. A shadow-toggle diff banded by frame height measured the bottom 30% of 05-lowsun
      // at 0.00% and of 02-town at 0.40% — not thin, absent. So the dark at the foot gets PAINTED on
      // the ground as well as on the prop, and painted it is there at every hour and every angle.
      b.castShadow=true; b.receiveShadow=true;
      _contactAO(b,0.3,0.62);                    // 0.3 is the lift in the position above — the grass line
      PROP_FEET.push([bx,bz,2.0]);               // and the ground remembers it is standing there
      scene.add(b); worldDeco.push(b);
    }
  }
  for(let i=0;i<6;i++){
    const lx=(Math.random()*2-1)*(MAP.x-36), lz=(Math.random()*2-1)*(MAP.z-28);
    const log=cyl(0.32,0.38,2.4+Math.random()*1.2,0x6b4a2b,6);
    log.rotation.z=Math.PI/2; log.rotation.y=Math.random()*Math.PI;
    log.position.set(lx,terrainHeight(lx,lz)+0.34,lz);
    // …and a log lying across a lawn is the single best contact shadow on the map: it is long, it is
    // low, and its shadow runs sideways out of it where the eye is already looking (§8.9).
    log.castShadow=true; log.receiveShadow=true;
    _contactAO(log,0.34,0.58);                   // a log is thin: the ramp is 0.7 units top to bottom
    PROP_FEET.push([lx,lz,2.9]);                 // a log is long: its pool is the widest on the map
    scene.add(log); worldDeco.push(log);
    const moss=drapedDecal(0.5,6,0x5f8a3e,lx+0.6,lz+0.4,0.06);
    scene.add(moss); worldDeco.push(moss);
  }
})();
// ---------- creep camp grounds (v77): six wild nooks bumped out past the border ----------
(function creepCampGrounds(){
  for(const C of CAMPS){
    if(C.boss)continue; // the raid shore gets its own scene below
    // worn earth: a big trampled dirt disc, then a darker inner ring
    scene.add(drapedDecal(C.r-1.5,16,0x8a7454,C.x,C.z,0.05,"hide"));
    scene.add(drapedDecal(4.2,10,0x6f5a40,C.x,C.z,0.07));
    // fire pit at the heart — the chest will appear here
    const y=terrainHeight(C.x,C.z);
    const g=new THREE.Group();
    for(let i=0;i<5;i++){const st=new THREE.Mesh(new THREE.DodecahedronGeometry(0.28+Math.random()*0.14),mat(0x757c85));
      const a=i/5*Math.PI*2; st.position.set(Math.cos(a)*0.85,0.2,Math.sin(a)*0.85); st.castShadow=false; g.add(st);}
    const ember=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,0.16,8),mat(0x3a2a1c)); ember.position.y=0.1; ember.castShadow=false; g.add(ember);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.9,6),new THREE.MeshBasicMaterial({color:0xe0762e})); flame.position.y=0.6; g.add(flame);
    const flame2=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.55,5),new THREE.MeshBasicMaterial({color:0xffd24a})); flame2.position.y=0.75; g.add(flame2);
    // gnawed bones and a skull post — fair warning
    for(let i=0;i<7;i++){const bx=C.x+(Math.random()-0.5)*C.r*1.4,bz=C.z+(Math.random()-0.5)*C.r*1.4;
      const bone=cyl(0.07,0.07,0.7+Math.random()*0.4,0xe8e4d8,4);
      bone.rotation.z=Math.PI/2; bone.rotation.y=Math.random()*Math.PI;
      bone.position.set(bx-C.x,terrainHeight(bx,bz)-y+0.12,bz-C.z); bone.castShadow=false; g.add(bone);}
    const post=cyl(0.12,0.14,2.2,0x6b4a2b,5); post.position.set(3.2,1.1,-2.6); post.castShadow=false; g.add(post);
    const skull=new THREE.Mesh(new THREE.SphereGeometry(0.3,6,5),mat(0xe8e4d8)); skull.position.set(3.2,2.35,-2.6); skull.castShadow=false; g.add(skull);
    // a rough palisade arc on the OUTWARD side — frames the hollow against the peaks
    const away=Math.atan2(C.x,C.z); // direction from map center, roughly outward
    for(let k=-7;k<=7;k++){
      const a=away+k*0.11, rr=C.r-0.8;
      const sx=Math.sin(a)*rr, sz=Math.cos(a)*rr;
      const stake=cyl(0.16,0.22,2.6+Math.random()*0.8,0x5a4028,5);
      stake.position.set(sx,terrainHeight(C.x+sx,C.z+sz)-y+1.2,sz);
      stake.rotation.x=(Math.random()-0.5)*0.14; stake.rotation.z=(Math.random()-0.5)*0.14;
      stake.castShadow=false; g.add(stake);
    }
    g.position.set(C.x,y,C.z); scene.add(g);
    worldDeco.push(g);
  }
})();
// ---------- THE SOUTHERN SHORE (v79): the raid boss camp — beach, ocean, wrecked longship ----------
(function raidShore(){
  const C=CAMPS.find(c=>c.boss); if(!C)return;
  const y=terrainHeight(C.x,C.z);
  // SAND: a broad pale strand filling the pocket, streaked with lighter drifts
  scene.add(drapedDecal(C.r-1,18,0xd9c48f,C.x,C.z,0.05,"hide"));
  for(let i=0;i<6;i++){
    const a=Math.random()*Math.PI*2, rr=Math.random()*(C.r-6);
    scene.add(drapedDecal(2.5+Math.random()*3.5,8,Math.random()<0.5?0xe2d0a2:0xcbb488,
      C.x+Math.cos(a)*rr,C.z+Math.sin(a)*rr,0.07));
  }
  // OCEAN: still water south of the strand, with foam lines lapping the sand
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(C.r*4.2,50),
    new THREE.MeshLambertMaterial({color:0x4a7a9c}));
  sea.rotation.x=-Math.PI/2; sea.position.set(C.x,0.09,C.z-C.r-12); sea.castShadow=false; sea.receiveShadow=false; scene.add(sea);
  const deep=new THREE.Mesh(new THREE.PlaneGeometry(C.r*4.8,28),
    new THREE.MeshLambertMaterial({color:0x3a6584}));
  deep.rotation.x=-Math.PI/2; deep.position.set(C.x,0.07,C.z-C.r-36); deep.castShadow=false; scene.add(deep);
  for(let i=0;i<3;i++){ // foam arcs where the tide dies
    const foam=new THREE.Mesh(new THREE.TorusGeometry(C.r*0.62+i*9,0.32,4,30,Math.PI*0.85),
      new THREE.MeshBasicMaterial({color:0xe8ecf0,transparent:true,opacity:0.5-i*0.12}));
    foam.rotation.x=-Math.PI/2; foam.rotation.z=Math.PI*1.08;
    foam.position.set(C.x,0.12,C.z-C.r+6); foam.castShadow=false; scene.add(foam); worldDeco.push(foam);
  }
  // THE WRECK: a massive beached longship, keeled over into the sand
  const W=new THREE.Group();
  const oakD=texturedMat("wood",0x4e3a26), oakL=texturedMat("wood",0x6b4a2b);
  // hull: stacked, narrowing strakes — clinker-built the blocky way
  for(let s=0;s<4;s++){
    const half=new THREE.Mesh(new THREE.BoxGeometry(3.6-s*0.5,0.75,20-s*1.6),s%2?oakL:oakD);
    half.position.y=1.1+s*0.62; half.castShadow=true; W.add(half);
  }
  const keel=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.8,22),oakD); keel.position.y=0.55; keel.castShadow=false; W.add(keel);
  // the BREACH: the hull torn open amidships — ribs jut from the wound
  const hole=new THREE.Mesh(new THREE.BoxGeometry(3.9,1.5,4.2),plainMat(0x1c1410));
  hole.position.set(0,1.7,2.5); W.add(hole);
  for(let i=0;i<4;i++){const rib=new THREE.Mesh(new THREE.BoxGeometry(0.18,1.8+Math.random()*0.7,0.22),oakD);
    rib.position.set((i%2?1.5:-1.5),2.3,1.2+i*0.9); rib.rotation.z=(i%2?1:-1)*(0.5+Math.random()*0.3); rib.castShadow=false; W.add(rib);}
  // dragon prow rearing at the bow
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.5,3.4,6),oakD);
  neck.position.set(0,3.4,9.4); neck.rotation.x=0.5; neck.castShadow=true; W.add(neck);
  const dhead=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,1.3),oakD); dhead.position.set(0,4.9,10.1); W.add(dhead);
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.22,0.9),oakL); jaw.position.set(0,4.55,10.5); W.add(jaw);
  for(const s of [-1,1]){const horn=cone(0.1,0.55,0xe8e4d8,4); horn.position.set(s*0.25,5.4,9.8); horn.rotation.z=s*0.4; horn.castShadow=false; W.add(horn);}
  const stern=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.44,2.6,6),oakD);
  stern.position.set(0,3.1,-9.6); stern.rotation.x=-0.55; stern.castShadow=false; W.add(stern);
  // snapped mast, fallen across the gunwale, dragging its tattered sail
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.34,11,7),oakL);
  mast.position.set(2.6,3.6,-1); mast.rotation.z=1.15; mast.rotation.x=0.25; mast.castShadow=true; W.add(mast);
  const stump=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.36,2.2,7),oakL);
  stump.position.set(0,3.2,-1); stump.castShadow=false; W.add(stump);
  const sail=new THREE.Mesh(new THREE.PlaneGeometry(6.5,4.2,4,3),
    new THREE.MeshLambertMaterial({color:0xb8b2a0,side:THREE.DoubleSide}));
  {const pa=sail.geometry.attributes.position; // wind-torn: ragged, draped verts
   for(let i=0;i<pa.count;i++){pa.setZ(i,Math.sin(i*1.7)*0.5);if(pa.getY(i)<-1.4&&(i%3===0))pa.setY(i,pa.getY(i)+0.9);}
   sail.geometry.computeVertexNormals();}
  sail.position.set(4.6,2.6,-1); sail.rotation.set(0.5,0.5,0.9); sail.castShadow=false; W.add(sail);
  // red-and-white war shields down the surviving gunwale
  for(let i=0;i<5;i++){
    const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.14,10),plainMat(i%2?0x8e1f1f:0xd8d2c2));
    sh.rotation.z=Math.PI/2; sh.rotation.y=0.12; sh.position.set(-1.95,2.6,-6.5+i*2.6); sh.castShadow=false; W.add(sh);
    const bossN=new THREE.Mesh(new THREE.SphereGeometry(0.12,5,4),plainMat(0x9aa2ad)); bossN.position.set(-2.08,2.6,-6.5+i*2.6); bossN.castShadow=false; W.add(bossN);
  }
  W.scale.setScalar(1.6); // the wreck grows with its bay — still a colossus on the widened sand
  W.position.set(C.x-7,y,C.z-6);
  W.rotation.y=0.55; W.rotation.z=0.16; // driven ashore at an angle, keeled to port
  scene.add(W); worldDeco.push(W);
  // flotsam: oars, barrels, driftwood, a cold fire ring where the chests will drop
  for(let i=0;i<8;i++){
    const oar=new THREE.Group();
    const shaft=cyl(0.07,0.07,3.4,0x6b4a2b,5); shaft.rotation.z=Math.PI/2; oar.add(shaft);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.05,0.4),oakL); blade.position.x=1.9; oar.add(blade);
    const ox=C.x+(Math.random()-0.5)*C.r*1.6, oz=C.z+(Math.random()-0.5)*C.r*1.1;
    oar.position.set(ox,terrainHeight(ox,oz)+0.15,oz); oar.rotation.y=Math.random()*Math.PI;
    oar.traverse(o=>o.castShadow=false); scene.add(oar); worldDeco.push(oar);
  }
  for(let i=0;i<6;i++){
    const bx=C.x+(Math.random()-0.5)*C.r*1.5, bz=C.z+(Math.random()-0.5)*C.r;
    const bar=cyl(0.42,0.5,0.9,0x7a5230,8); bar.position.set(bx,terrainHeight(bx,bz)+0.45,bz);
    bar.rotation.z=(Math.random()<0.5)?Math.PI/2:0; bar.castShadow=false; scene.add(bar); worldDeco.push(bar);
  }
  const ring=drapedDecal(2.2,8,0x6f5a40,C.x,C.z,0.07); scene.add(ring); // the fire ring — treasure drops here
})();
// ---------- THE TOWN BOARDS (v87): a quest board beside each throne ----------
// Deterministic placement (same spot on host and guest): just outside the TC
// footprint, on the road-facing side, clear of the farm ring's favorite arcs.
(function(){
  for(const team of [BLUE,RED]){
    const sgn=team===BLUE?1:-1; // face inward, toward the Kings Road
    const bx=TCPOS[team][0]+sgn*13, bz=TCPOS[team][1]-8;
    const g=new THREE.Group();
    const postL=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.17,3.1,6),texturedMat("wood",0x6b4a2b));
    postL.position.set(-1.05,1.55,0); postL.castShadow=true; g.add(postL);
    const postR=postL.clone(); postR.position.x=1.05; g.add(postR);
    const plank=new THREE.Mesh(new THREE.BoxGeometry(2.9,1.7,0.16),texturedMat("wood",0x8a6a3f));
    plank.position.y=2.25; plank.castShadow=true; g.add(plank);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(3.3,0.14,0.9),texturedMat("wood",0x5a4632));
    roof.position.y=3.25; roof.rotation.x=0.18; roof.castShadow=false; g.add(roof);
    for(let i=0;i<3;i++){ // pinned parchments — the quests themselves
      const p=new THREE.Mesh(new THREE.PlaneGeometry(0.62,0.78),
        new THREE.MeshLambertMaterial({color:i===1?0xf0e6c8:0xe6d9b0,side:THREE.DoubleSide}));
      p.position.set(-0.85+i*0.85,2.25+(i%2?0.08:-0.06),0.1); p.rotation.z=(i-1)*0.07; p.castShadow=false; g.add(p);
    }
    const seal=new THREE.Mesh(new THREE.CircleGeometry(0.09,8),
      new THREE.MeshBasicMaterial({color:team===BLUE?0x3d6ef2:0xd94a3d}));
    seal.position.set(0,2.55,0.11); g.add(seal);
    g.position.set(bx,terrainHeight(bx,bz),bz);
    g.rotation.y=sgn>0?Math.PI/2:-Math.PI/2; // parchment face toward the town's heart
    scene.add(g); worldDeco.push(g);
    townBoards.push({team,x:bx,z:bz,mesh:g});
  }
})();
// world gen done — hand Math.random back to the casino
Math.random=__realRandom;

// ---------- weld more parts into a mesh that has already been merged ----------
// The alternative is a fourth mesh, and a fourth mesh is a fourth draw call for something that
// shares a material, never moves and is never culled separately — §9.2's exact definition of a call
// spent for nothing. _mergeColored hands back a non-indexed position/normal/color buffer and that is
// all these have, so appending is three typed-array copies and a swap. Only ever call this BELOW the
// handback: it mints a geometry, and a geometry is four draws out of the seeded stream.
function _appendGeo(mesh,parts){
  const add=_mergeColored(parts), old=mesh.geometry, g=new THREE.BufferGeometry();
  for(const k of ["position","normal","color"]){
    const A=old.attributes[k].array, B=add.attributes[k].array;
    const out=new Float32Array(A.length+B.length);
    out.set(A,0); out.set(B,A.length);
    g.setAttribute(k,new THREE.BufferAttribute(out,3));
  }
  mesh.geometry=g; old.dispose(); add.dispose();
}
// ---------- THE PASS RIDGE: close the skyline over the camp pockets ----------
// See the note above mountainRing for why the hole is there and why nothing inside that function can
// patch it. Every point the far ring stepped over got written to RIDGE_GAPS; each one now gets a peak
// standing 72 units further out, which is past the deepest camp (the Viking bay reaches z −221) and
// past the terrain plane's own corner at 225, so these rise from BEHIND the horizon line rather than
// standing on the beach. That is the read §4.4 wants out of the third band anyway: not another range
// you could walk to, a silhouette closing the frame.
// Everything here is a hash of the point's own coordinates rather than Math.random(), so the bridge
// is byte-identical on every peer without borrowing a single draw from either stream — and it lands
// below the handback, where a ConeGeometry is free.
// It welds into the far range's own mesh, so the entire fix is ZERO draw calls and ~2k triangles.
(function buildRidgePass(){
  if(!RIDGE_FAR_MESH||!RIDGE_GAPS.length)return;
  const X=MAP.x+38, Z=MAP.z+32, OUT=72;
  // ridgeTint's stops, evaluated where the far RING stands and not where the bridge does: 81% of the
  // way from ROCK to HAZE, which is what a peak at |z| 157 is handed. Pure HAZE (the first cut) came
  // back two levels paler than the range either side of it, and a skyline that changes value in the
  // middle is a seam whether or not there is still a hole under it. The fold is the same sun azimuth
  // (0.6/0.8 in xz) the rest of the range bakes, so the terminator agrees across the join.
  const HZ_LIT=0x687889, HZ_DK=0x526071;
  const facet=(x,y,z,nx,ny,nz)=>(nx*0.6+nz*0.8>0.02?HZ_LIT:HZ_DK);
  const snow=(x,y,z,nx,ny,nz)=>(nx*0.6+nz*0.8>0.10?0xD2D9E2:0xB4BDC9);
  const hash=(a,b,k)=>{const s=Math.sin(a*12.9898+b*78.233+k*37.719)*43758.5453;return s-Math.floor(s);};
  const flare=(g,h,k)=>{ // same cubic skirt as the ring: all base, nothing at the summit
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=Math.max(0,Math.min(1,(p.getY(i)+h*0.5)/h)), f=1+k*Math.pow(1-t,3);
      p.setX(i,p.getX(i)*f); p.setZ(i,p.getZ(i)*f);
    }
    return g;
  };
  const M=(px,py,pz,ry)=>new THREE.Matrix4().compose(
    new THREE.Vector3(px,py,pz),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),ry),
    new THREE.Vector3(1,1,1));
  const parts=[];
  for(const [gx,gz] of RIDGE_GAPS){
    // push the peak straight out along whichever edge of the rectangle it sits on. A corner point is
    // on both, and gets pushed diagonally, which is right — that is where the corner camps are.
    let px=gx+(Math.abs(gx)>=X-1?Math.sign(gx)*OUT:0);
    let pz=gz+(Math.abs(gz)>=Z-1?Math.sign(gz)*OUT:0);
    let guard=0;
    while(nearCamp(px,pz,4)&&guard++<6){px*=1.06; pz*=1.06;} // never stand a mountain in a camp's hollow
    const j=hash(gx,gz,1);
    // taller than the ring it stands behind (33–48 against 22–36): it is a third further away and has
    // to clear both the ring's own peaks and the terrain edge to show at all
    const h=33+j*15, r=15+hash(gx,gz,2)*9;
    px+=(hash(gx,gz,3)-0.5)*12; pz+=(hash(gx,gz,4)-0.5)*12;
    parts.push({geo:flare(new THREE.ConeGeometry(r,h,8,3),h,1.9),
                matrix:M(px,h*0.42,pz,hash(gx,gz,5)*Math.PI),color:facet});
    // a cap only on the tall ones, same inscribing arithmetic as the ring (base 0.58h sits inside
    // 0.34r of rock), so the back range keeps the snow line the rest of the skyline reads on
    if(h>36)parts.push({geo:new THREE.ConeGeometry(r*0.28,h*0.36,8),matrix:M(px,h*0.76,pz,0),color:snow});
  }
  if(parts.length)_appendGeo(RIDGE_FAR_MESH,parts);
})();

// ---------- THE WELD, on the far side of the handback ----------
// The two flattest, most numerous, least interesting layers in the game — 195 clearing patches and
// 53 road segments — were 248 separate meshes, none of them ever moving, none of them referenced by
// anything, and the patches not even distance-culled. That is up to 248 draw calls and 248 frustum
// tests for two things whose whole job is to lie still and be ground. Welded, they are two.
// It happens HERE and not where they are built for the reason at the top of the file: _mergeColored
// mints a BufferGeometry per part and one more for the result, and every one of those is four draws
// out of the seeded stream. Above the line that would move every node index in the world; below it,
// the stream is the casino's again and the merge is free.
// The colour is a vertex attribute so the two layers keep their per-disc tone and the road keeps its
// per-VERTEX ruts, and both stay on the GROUND's fog curve — a decal is the ground, it fades with
// the ground (see drapedDecal). receiveShadow stays on for the same reason it went on in v129.5.
// v130.5 THE WELD MOVED TO THE FOOT OF THE FILE, and nothing else about it changed. The undergrowth
// runs after this point and its shrubs are half of what the contact pools are for, so the patch
// layer cannot be sealed until they have all written their feet down. Order of scene.add is nothing
// to opaque geometry; the only rule this block has ever had is "below the handback", and it still is.

// =============================================================================================
// v128 THE UNDERGROWTH — density, variety, and not one byte of it on the wire
// =============================================================================================
// WHY THIS LIVES DOWN HERE, BELOW THE LINE, WITH ITS OWN GENERATOR:
// everything between `Math.random=mulberry32(...)` and the line above draws from ONE seeded
// stream, and `nodes` — every tree, every ore vein — is built from it. Add or remove a single
// Math.random() call anywhere in that window and every subsequent draw shifts, which moves every
// node position and every node INDEX. That is not a cosmetic problem: the netcode indexes nodes
// by position in a deterministic world build, so a shifted stream means a v127 peer and a v128
// peer disagree about which tree is tree 300 — same bytes, different world. It is precisely why
// v114 had to bump PROTO when the forest was replanted.
// So the undergrowth runs AFTER the handback and draws from its own `sow`. The seeded world is
// untouched, every peer still grows identical foliage, and PROTO stays 26.
//
// It is also all InstancedMesh. The host in John's field logs was at 10–19 fps against ~1,800
// draw calls, so "more foliage" had to mean more INSTANCES, not more objects: the six layers
// below add ~14,000 pieces of greenery for six draw calls and six materials.
(function undergrowth(){
  const sow=mulberry32(0x5EEDF00D);          // its own stream, deterministic across peers
  const R=()=>sow(), RR=(a,b)=>a+sow()*(b-a);
  const dummy=new THREE.Object3D(), col=new THREE.Color();
  // shared toon material per layer — one draw call each.
  // v130 W1: vertexColors:false was the whole bug. Every setColorAt() below fed a varying the
  // fragment shader never declared, so all six layers rendered flat material white. See the
  // shading kit above _unitColor() — and note the flag is only safe because every geometry handed
  // to scatter() has been through _unitColor/_groundedColor first.
  const leafMat=()=>_fogClamp(toonMat({side:THREE.DoubleSide,vertexColors:true}),GROUND_FOG);
  const skyward=_skyward; // moved to file scope in v130 so plantGrass shades its blades identically

  function scatter(geo,count,place,opts){
    opts=opts||{};
    const inst=new THREE.InstancedMesh(geo,leafMat(),count);
    for(let i=0;i<count;i++){
      place(i,dummy,col);
      dummy.updateMatrix();
      inst.setMatrixAt(i,dummy.matrix);
      // v130 W1: every place() authors and jitters in sRGB, because that is where hue and lightness
      // mean what the eye thinks they mean. The instance buffer wants LINEAR — setColorAt does no
      // decode of its own and the frame is sRGB-encoded on output since v130, so a raw hex gets
      // encoded twice and the whole layer comes back a band pale. Convert once, here, for all six.
      inst.setColorAt(i,col.convertSRGBToLinear());
    }
    inst.instanceMatrix.needsUpdate=true;
    if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
    inst.castShadow=!!opts.shadow; inst.receiveShadow=true;   // §3.8, and free — see plantGrass
    // r128's InstancedMesh does NOT fold the instance matrices into its bounding sphere — the
    // sphere is the BASE geometry's, sitting at the object's origin. So a layer of 9,000 blades
    // spread over a 400-unit map is frustum-tested as a single 1-unit plane at world (0,0,0) and
    // the entire layer blinks out the moment the camera looks away from the middle of the map.
    // That is why the first render of this block showed almost nothing. One draw call each is far
    // too cheap to be worth culling anyway.
    inst.frustumCulled=false;
    scene.add(inst);
    return inst;
  }
  // keep the undergrowth off the roads, the plazas and the two thrones — a lawn growing through
  // the Town Centre's flagstones is the one thing that would read as a bug rather than a garden
  // NOTE the hand-rolled distance: `dist2()` lives in 04-units.js, which loads AFTER this file,
  // and separate <script> tags do not hoist across each other. There is a comment saying exactly
  // this ~400 lines up, and calling dist2 here still threw `dist2 is not defined` at load —
  // silently, because the whole IIFE died and simply produced no foliage at all.
  // The Kings Road CURVES — roadPoint() carries two sine terms — so the straight z-band this used
  // to test missed the bends, and `v114 clear lanes` duly reported undergrowth growing through the
  // highway. Walk the actual polyline instead.
  const ROAD=[]; for(let i=0;i<=40;i++)ROAD.push(roadPoint(i/40));
  const clear=(x,z)=>{
    for(const t of TCPOS){const dx=x-t[0],dz=z-t[1];if(dx*dx+dz*dz<34*34)return false;}
    for(const r of ROAD){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<9*9)return false;}
    return true;
  };
  const spot=(spread)=>{ // rejection-sample a legal patch centre
    for(let k=0;k<24;k++){
      const x=(R()*2-1)*(MAP.x-spread), z=(R()*2-1)*(MAP.z-spread);
      if(clear(x,z))return [x,z];
    }
    return null;
  };

  // ---- 1. TUFTED GRASS: the big one. Tall, leaning, in drifts, in FOUR greens ----
  // The v34 layer was 310 patches of 6-12 blades at 0.22×0.5 — about 2,700 slivers spread over a
  // 400×400 map, which is to say invisible. These are twice the size, five times as many, and
  // clumped hard enough to read as undergrowth rather than stubble.
  {
    // v128 dropped these hard "because skyward normals render them a band brighter". They didn't —
    // they rendered WHITE, at every hex. Back to §2.3 undergrowth.a/b/c plus two in-betweens.
    const TONES=[FOL.a,FOL.b,FOL.c,FOL.ab,FOL.ac];
    const blades=[];
    for(let p=0;p<900;p++){
      const c=spot(6); if(!c)continue;
      const n=7+((R()*10)|0);
      const tone=TONES[(R()*TONES.length)|0];
      for(let b=0;b<n;b++){
        // v130.2 THIS IS THE LAYER THE CRITIC WAS ACTUALLY LOOKING AT. 7–16 blades over a 2.1-unit
        // disc is one blade every ~1.1 units — scatter, not a clump, and at 1.05 units tall these
        // are the biggest pieces of greenery in the near field, so they dominated the foreground of
        // three shots as isolated posts (§8.8). r*0.85 pulls the same blade count into a mat about
        // a metre across with a defined outer edge. This stream is `sow`, its own generator, which
        // is why the counts here were always free to move where plantGrass's are not.
        const a=R()*Math.PI*2, r=R()*0.85;
        blades.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,tone]);
      }
      // a mat of blades is a prop like any other and it is the one that stands in the emptiest part
      // of the map — the bottom third of 05-lowsun is road, bare lawn and exactly one of these, and
      // it was the only thing in that band with nothing under it. ONE pool per MAT, not per blade.
      PROP_FEET.push([c[0],c[1],1.35]);
    }
    // was PlaneGeometry(0.34,1.05) — one flat card, edge-on half the time. See _tuftGeo.
    const g=_groundedColor(skyward(_tuftGeo(0.46,1.05,0.06)));
    scatter(g,blades.length,(i,d,c)=>{
      const [x,z,tone]=blades[i];
      d.position.set(x,terrainHeight(x,z),z);
      d.rotation.set((R()-0.5)*0.12,R()*Math.PI,(R()-0.5)*0.38); // the lean is what sells it
      const s=0.7+R()*0.75; d.scale.set(s,s*(0.8+R()*0.5),s);
      // v131 …and the tone now knows which patch of meadow it is standing in. The terrain carries a
      // dry/lush field (meadowPatch) and this is the layer that covers most of it, so a tuft that
      // ignored it put lush grass in a dry patch and killed the whole effect at exactly the range
      // the effect is for. Lightness AND saturation, because dry grass is paler and greyer, not
      // just paler. Free: it is one sine chain per instance at build time, no random, no object.
      const mp=meadowPatch(x,z);
      c.setHex(tone).offsetHSL(0,(R()-0.5)*0.07-mp*0.045,(R()-0.5)*0.09+mp*0.075);
    });
  }
  // ---- 2. CLOVER MATS: flat rosettes that fill the ground plane between the blades ----
  {
    const pts=[];
    for(let p=0;p<420;p++){
      const c=spot(5); if(!c)continue;
      const n=5+((R()*7)|0);
      for(let b=0;b<n;b++){const a=R()*Math.PI*2,r=R()*1.7;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}
    }
    const g=_unitColor(new THREE.CircleGeometry(0.3,6)); g.rotateX(-Math.PI/2); // smaller: big flat discs caught full sun and read as bleached patches
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z]=pts[i];
      d.position.set(x,terrainHeight(x,z)+0.05,z);
      d.rotation.set(0,R()*Math.PI,0);
      const s=0.7+R()*0.8; d.scale.set(s,1,s);
      // a rosette lies flat and faces straight up, so it takes the most light of anything down
      // here — hold it at the DARK end of §2.3 or it bleaches back into the ground plane
      const mp=meadowPatch(x,z);   // the rosettes lie flat ON the field, so they follow it hardest
      c.setHex(R()<0.5?FOL.b:FOL.ab).offsetHSL(0,(R()-0.5)*0.06-mp*0.05,(R()-0.5)*0.07+mp*0.085);
    });
  }
  // ---- 3. BUSHES: rounded low-poly shrubs, the mid-height layer the map never had ----
  {
    const pts=[];
    for(let p=0;p<210;p++){
      const c=spot(10); if(!c)continue;
      const n=1+((R()*3)|0);
      for(let b=0;b<n;b++){const a=R()*Math.PI*2,r=R()*2.6;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}
    }
    // v130.5 the shrub layer is the biggest mass standing in the near field and it was the biggest
    // thing floating on it. It gets a painted pool at each foot like every other prop — see
    // paintContactShadows. The pool is welded into the ground decals, so 420 shrubs cost 0 calls.
    for(const p of pts)PROP_FEET.push([p[0],p[1],2.55]);
    const g=_groundedColor(new THREE.IcosahedronGeometry(1.0,0));
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z]=pts[i];
      d.position.set(x,terrainHeight(x,z)+0.62,z);
      d.rotation.set(R()*0.5,R()*Math.PI,R()*0.5);
      d.scale.set(0.85+R()*0.9,0.62+R()*0.5,0.85+R()*0.9); // squashed: shrubs, not boulders
      // the shrubs are MASS, so they get the darkest greens the spec allows — broadleaf and
      // conifer base rather than lawn tones. §8.3 wants a dark anchor in the lower third of the
      // frame and this layer is the only thing between the grass and the tree line that can be it.
      // a shrub is woody mass and does not brown off with the lawn — a third of the swing, so a
      // dry patch still reads as ONE place rather than as green blobs on beige
      const mp=meadowPatch(x,z);
      c.setHex([FOL.leaf,FOL.needle,FOL.leafMid,FOL.b][(R()*4)|0]).offsetHSL(0,(R()-0.5)*0.05-mp*0.018,(R()-0.5)*0.06+mp*0.028);
    },{shadow:true});
  }
  // ---- 4. FERNS: tall thin fans that break the silhouette at the forest edge ----
  {
    const pts=[];
    for(let p=0;p<260;p++){
      const c=spot(6); if(!c)continue;
      const n=3+((R()*4)|0);
      for(let b=0;b<n;b++){const a=R()*Math.PI*2,r=R()*1.5;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}
      PROP_FEET.push([c[0],c[1],1.9]);   // one pool per stand, not per frond — see paintContactShadows
    }
    const g=_groundedColor(skyward(new THREE.ConeGeometry(0.55,1.5,4,1,true))); g.translate(0,0.75,0);
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z]=pts[i];
      d.position.set(x,terrainHeight(x,z),z);
      d.rotation.set((R()-0.5)*0.2,R()*Math.PI,(R()-0.5)*0.2);
      const s=0.7+R()*0.7; d.scale.set(s*1.15,s,s*1.15);
      // ferns grow at the eaves of the wood, so they sit between the shrub mass and the lawn
      c.setHex([FOL.leaf,FOL.leafMid,FOL.needle][(R()*3)|0]).offsetHSL(0,(R()-0.5)*0.05,(R()-0.5)*0.06);
    });
  }
  // ---- 5. BLOSSOM DRIFTS: five hues, in beds, at a size you can actually see ----
  // (the v34 wildflower layer is still there; this sits alongside it and does the heavy lifting)
  {
    // v130 W1: the old five were neon — 0xff5d7a / 0xffd93d / 0xb56cf0 / 0xff9a3d are all pinned
    // channels, and 0xf7f4ea is a near-white that §10.22 reserves for unit teeth. They were picked
    // to be visible against a lawn that was rendering white; against §2.3's greens they scream.
    // §8.5 allows one warm accent per frame and at most three: these are §2.3's two blossoms plus
    // three restrained neighbours so a drift still has variety without owning the shot.
    // v130.1 …AND THEN THERE WERE TOO MANY OF THEM. §8.5 allows ONE warm accent per frame and at
    // most three; 150 beds of five hues scattered map-wide is neither, and at 2× on the meadow shot
    // they read exactly as the critic put it — white, pink and orange squares dropped on a lawn,
    // §1.2's "spilled paint" in a new form. Three changes, all cheap because this layer is one
    // instanced draw call and lives BELOW the RNG handback on its own mulberry32 stream (no wire
    // exposure, unlike plantGrass): 70 beds instead of 150 so a drift is an event rather than a
    // texture; a petal disc of 0.22 instead of 0.30, which stops a single blossom being a
    // legible SQUARE at play distance; and FOL.cream is gone — a near-white on a lawn reads as
    // litter, not as a flower, and §10.22 reserves that value for teeth anyway. The two §2.3
    // blossoms carry it, with the softer violet and amber for variety.
    const TONES=[FOL.warm,FOL.cool,FOL.violet,FOL.amber];
    const pts=[];
    for(let p=0;p<70;p++){
      const c=spot(8); if(!c)continue;
      const tone=TONES[(R()*TONES.length)|0];
      const n=9+((R()*14)|0);
      for(let b=0;b<n;b++){const a=R()*Math.PI*2,r=R()*3.4;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,tone]);}
    }
    const g=_unitColor(new THREE.CircleGeometry(0.22,5)); g.rotateX(-Math.PI/2); // a petal is flat: no tip, no gradient
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z,tone]=pts[i];
      d.position.set(x,terrainHeight(x,z)+0.3,z);
      d.rotation.set((R()-0.5)*0.5,R()*Math.PI,(R()-0.5)*0.5);
      const s=0.8+R()*0.7; d.scale.set(s,s,s);
      c.setHex(tone).offsetHSL(0,0,(R()-0.5)*0.05);
    });
  }
  // ---- 6. STALKS: a few thousand single tall blades, scattered map-wide, no clumping ----
  // Clumped foliage leaves bald ground between the drifts. This is the thin wash over everything
  // that stops the lawn ever looking empty, and at one draw call it is effectively free.
  {
    const pts=[];
    for(let i=0;i<3200;i++){
      const x=(R()*2-1)*MAP.x, z=(R()*2-1)*MAP.z;
      if(clear(x,z))pts.push([x,z]);
    }
    // v130.2: the wash is deliberately unclumped, which makes IT the layer where a single flat card
    // is most exposed — 3,200 lone rectangles at 1–3 units apart across open lawn is precisely the
    // "isolated posts" read, and no amount of clumping elsewhere fixes it. A tuft instead of a card
    // means even the unclumped wash is a little clump of its own.
    const g=_groundedColor(skyward(_tuftGeo(0.27,0.8,0.04)));
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z]=pts[i];
      d.position.set(x,terrainHeight(x,z),z);
      d.rotation.set(0,R()*Math.PI,(R()-0.5)*0.3);
      const s=0.7+R()*0.8; d.scale.set(s,s,s);
      // the wash IS the lawn (§2.3 a/b/c exactly) — so it takes the lawn's dry/lush field at full weight
      const mp=meadowPatch(x,z);
      c.setHex([FOL.a,FOL.b,FOL.c][(R()*3)|0]).offsetHSL(0,(R()-0.5)*0.06-mp*0.045,(R()-0.5)*0.08+mp*0.075);
    });
  }
})();

// =============================================================================================
// v130.5 THE CONTACT SHADOWS — §8.9, painted, because the shadow map cannot deliver them
// =============================================================================================
// "Contact shadows visible where trunks and boots meet ground — this is what stops the world
// floating." The world had none. A shadow-toggle render diff, banded by frame height, measured the
// bottom 30% of 05-lowsun at 0.00% and 02-town at 0.40%, and what little the mid band had was
// conifer canopies self-shading, not ground. The round-1 fix (castShadow on boulders and deadfall)
// landed exactly as written and moved the picture by nothing, for two reasons that are both about
// the RIG rather than about the flags:
//   · THE SUN IS BEHIND THE CAMERA. §3.1 fixes it at (120,168,80) from its target, so every shadow
//     in the game lies toward −x−z; the standard vantages look that way too. A cast shadow is always
//     behind the thing that casts it and the only shadow the player ever sees is a self-shadow.
//   · TWENTY BOULDERS IS NOT A DENSITY. Fifty props over a 534×450 map is one every 4,800 m².
// So the dark under a prop is albedo, not lighting. That is §7.4's rule for static props ("baked
// contact AO") applied to the GROUND rather than to the prop, and it holds at every camera angle,
// at every hour, on hardware with the shadow map switched off entirely, and on the phone build.
// EVERY ONE OF THEM IS FREE. They are draped discs, so they weld into the clearing-patch layer that
// was already going to be one mesh — 1,300 pools, +0 draw calls, and the patch mesh is not distance
// culled so nothing pops. Below the handback, so no geometry is drawn from the seeded stream (§10.7).
// THE THREE STOPS ARE PRE-DIVIDED BY WHAT THE FRAME DOES TO THEM, the same measured correction the
// road and the terrain carry: the rim is authored to render at the lawn's own value so the pool has
// no edge to find, the core at §2.2's grass.shadow, which is the hex this palette keeps for exactly
// this — "bottom ramp band / cast shadow".
// THE FIRST CUT OF THIS WAS INVISIBLE AND THE COLOURS WERE NOT WHY. Rendered with the three stops
// swapped for magenta/cyan/yellow, the pools turned out to be exactly where they should be and
// entirely UNDER their own props: a shrub is 3.5 units across and the pool was 3.3, so all that
// showed was a one-pixel crescent on the camera side. A contact shadow has to be WIDER than the
// thing standing in it or it is a doormat. These are ~1.8× the prop's own footprint, which is also
// about where a 50° sun would actually put the penumbra.
// v130.6 A CONCENTRIC DISC IS AN AMBIENT-OCCLUSION SMUDGE, NOT A CAST SHADOW. Round 2 painted the
// pools and they landed: 01-meadow's bottom band went 0.00% → 12.61% and the world stopped floating.
// What it did not buy was any sense of WHERE THE LIGHT IS. A ring is the same ring whichever way the
// sun points, so the near field of 05-lowsun and 02-town still carried zero directional information
// below the treeline — every prop sat in a symmetric halo, which is what a lightbulb directly
// overhead would draw. So the pool becomes a TEARDROP: same area, same three stops, dragged out
// along the sun's own ground vector and pinched to a tail at the far end.
// THE DIRECTION IS READ, NOT COPIED. `_SUN_OFF` (01-engine.js:262) is the one vector §3.1 calls
// canon and the shadow map already uses it; writing (120,80) out again here would work today and
// point the painted shadows one way and the cast ones the other the first time somebody tunes the
// rig by a few degrees. Its ground projection, negated, is the direction a shadow LIES in.
// AND THE UP-SUN HALF IS THE HALF THE CAMERA IS ON, which is the trap in doing this. §3.1 puts the
// sun behind the camera on five of the six vantages, so the tail is largely BEHIND the prop that
// throws it and the crescent on the near side is most of what the player ever sees — leave that
// crescent a big symmetric halo and the pool still reads as a lightbulb overhead however long the
// tail is. It gets PULLED IN to 0.78 instead: the dark itself keeps its absolute reach (0.78 of a
// 0.78-scaled half is the same 0.61·rr the old 0.64 of a full one was) and it is the pale MID/RIM
// skirt around it that loses a third of its radius. Tight dark at the contact, mass down-sun —
// which is what a contact shadow looks like from up-sun, and it costs no area: the half the tail
// gains is the half the skirt gives up, so the lawn carries the same amount of paint as before.
// v131.2 …AND A POOL IS STILL NOT A SHADOW, BECAUSE ITS LENGTH CAME OFF THE WRONG NUMBER.
// The round-2 teardrop is sized on the prop's FOOTPRINT (`r`), and for the undergrowth that is very
// nearly right — a shrub is about as wide as it is tall, so 1.85 footprints of tail is roughly the
// metre a 50° sun would actually throw. For a TREE it is nonsense. A 12-unit conifer got rr≈3.2 and
// a 5.9-unit tail; §3.1's sun throws that tree 10.3 units. Measured at the 05-lowsun vantage the
// trunks met the grass at full value (lawn Y 125–128, the pool under the nearest stand Y 71–88 and
// entirely hidden UNDER its own canopy) — the whole reason "roughly forty conifers throw nothing"
// survived a round in which the pools were landing correctly and could be measured landing.
// A shadow's length is a function of the caster's HEIGHT and the sun's ELEVATION and of nothing
// else. `COT` is that, read off the same _SUN_OFF the shadow map uses, so the painted length and
// the cast length are the same number and stay the same number if anyone re-aims the rig.
// AND IT IS THE TREES OR IT IS NOTHING. Everything else on this map is roughly as tall as it is
// wide, so `max(footprint tail, height tail)` leaves 1,300 of the 1,400 pools byte-for-byte where
// they were and only opens out the ~700 that stand 7–16 units in the air. That is deliberate: a
// grass mat with a two-metre spike of shade coming out of it is the sticker read again, upside down.
(function paintContactShadows(){
  // v131.2 THE RIM IS NO LONGER A HAIR OVER THE LAWN. #709443 was authored to "have no edge to
  // find" and at a 3-unit disc that was invisible either way; on a ten-unit tail the outer third of
  // every tree shadow is rim, and a rim four levels ABOVE the terrain's own #6C8C44 paints the tip
  // of every shadow in the wood as a pale streak pointing away from the sun. Just under, so the
  // tail gives up into the lawn from the dark side.
  // …AND THE FOURTH STOP IS THE OCCLUSION, WHICH IS A DIFFERENT THING FROM THE SHADOW.
  // The three stops above are a cast shadow: they carry §2.2's own grass.lit:grass.shadow ratio
  // (0.39:0.22 = 1.77, and the pool renders at 1.77 — Y 151.6 lawn against Y 85.6 core). What they
  // do NOT carry is the other half of what grounds a prop, the one Valheim gets most of its depth
  // from: the dark right AT the contact, where the litter is occluded from the whole sky and not
  // just from the sun. That is why a trunk in 05-lowsun still met the grass at full value with a
  // correct shadow lying behind it — the shadow was pointing away from the camera and the crescent
  // on the near side is a CAST-shadow value, which is far too light to read as a foot.
  // It is free: rings:3 already put a vertex loop at d≈0.33 for every long pool, so this is a hex,
  // not a triangle. Measured at 2.1× the lawn, which is where the real shadow map's own terminator
  // lands (2.6× at 01-meadow) — so the darkest paint on the ground agrees with the darkest light.
  const GRASS=[0x334A1A,0x3F5A22,0x577132,0x6A8A41];
  // A SHADOW IS THE COLOUR OF WHAT IT FALLS ON. The undergrowth is kept 9 units off the King's Road
  // by `clear()`, but boulders and logs are scattered with a bare Math.random() and a few of them
  // stand ON the paving — where a lawn-green pool over brown is exactly the artefact §8.7 names,
  // undergrowth growing through the highway, and the longer tail below drags more of it out there.
  // Same stops divided the same way, off road.base instead of off the lawn: 0.78 and 0.56 of
  // the rim, which is where §2.2's dirt.shadow lands anyway.
  const PAVED=[0x3E3722,0x4E4529,0x6B563C,0x8A7150];
  const RPTS=[]; for(let i=0;i<=52;i++)RPTS.push(roadPoint(i/52));   // the ribbon's own 53 centres
  const roadD2=(px,pz)=>{let m=1e9;for(const p of RPTS){const dx=px-p.x,dz=pz-p.z,d=dx*dx+dz*dz;if(d<m)m=d;}return m;};
  const PAVE_R=4.6;   // the discs are 4.55–5.1 and overlap: this is the half-width of the ribbon
  // ux,uz: downhill along the light. nx,nz: across it. A 50° sun would throw a shadow about 0.86×
  // the caster's height, which for a shrub is most of a pool radius — 1.85 out and 0.45 of a pinch
  // is that, rounded to what reads at 40px rather than to what a protractor says.
  const SL=Math.hypot(_SUN_OFF.x,_SUN_OFF.z)||1;
  const ux=-_SUN_OFF.x/SL, uz=-_SUN_OFF.z/SL, nx=-uz, nz=ux;
  // the same vector's run over its rise: how many units of ground ONE unit of height throws.
  // 144.2/168 = 0.858 at §3.1's 50°. Derived, never written down — see the note above.
  const COT=SL/Math.max(1e-3,_SUN_OFF.y);
  const NEAR=0.78, FAR=1.85, WIDE=0.92, PINCH=0.45;
  // trees are the case §8.9 names first, and they are the only prop class that does not have to be
  // written down — nodes[] already knows where every trunk on the map stands. The pool grows with
  // the tree: `th` is the built height, so a 14-unit conifer sits in more shade than a sapling.
  // The fourth slot is the caster's HEIGHT and it is optional: PROP_FEET entries that never wrote
  // one get 0 and come out of the arithmetic below completely unchanged.
  const feet=PROP_FEET.map(f=>[f[0],f[1],f[2],f[3]||0,null]);
  // v131 …and the other 56 entries in the same array were being skipped. `nodes` holds the berry
  // bushes, the gold veins and the five stone piles as well as the trees, and the `type==="wood"`
  // filter walked straight past them — so the one class of prop a villager stands at for thirty
  // seconds had clean lawn right up to its edge on every shot. The radii are the pile's own spread
  // (makeNode scatters food over ±1.4, gold over ±1.8, stone over ±2.2) times the ~1.8 the note
  // above measured: a pool narrower than the thing standing in it is a doormat.
  const NODE_R={food:2.55,gold:2.75,stone:3.30};
  for(const n of nodes){
    const wood=n.type==="wood";
    // the node itself rides along in the fifth slot so the weld below can write the vertex range
    // back onto it — a felled tree has to be able to take its own shadow away again. See fellPool().
    feet.push([n.x,n.z,wood?1.6+(n.th||9)*0.13:(NODE_R[n.type]||2.5),wood?(n.th||9):0,wood?n:null]);
  }
  for(let i=0;i<feet.length;i++){
    const [x,z,r,h,node]=feet[i];
    // the wobble hash wants a per-pool phase or 1,300 discs share one outline; the radius is what
    // _discGeo hashes on, so a 10% jitter off the position is enough to make no two the same
    const rr=r*(0.9+0.2*(Math.sin(x*7.13+z*3.71)*0.5+0.5));
    // …and here is where a pool becomes a shadow. `reach` is world units of tail; `K` is that same
    // length expressed in the pool radii `along` wants, so nothing downstream has to change shape.
    // max(), not h*COT, because the footprint tail is still the right answer for anything low and
    // wide — a fallen log throws a shadow off its LENGTH, not off the 0.7 units it stands.
    const reach=Math.max(rr*FAR,h*COT), K=reach/rr;
    // A LONG TAIL HAS TO COME TO A POINT OR IT IS A RUNWAY. The 0.45 pinch is what a 1.85 tail wants;
    // at 3.3 it leaves a 6-unit-wide slab lying down-sun of every conifer with a squared-off end,
    // which reads as a painted stripe far louder than the disc it replaced. Capped at 0.90 so the
    // tip is always a few decimetres of width rather than a degenerate triangle.
    const pinch=Math.min(0.90,PINCH+Math.max(0,K-FAR)*0.16);
    // The stretch and its inverse have to be written twice — once forward for the rim, once backward
    // for the value stops — and they have to agree to the digit. If they drift, the geometry is a
    // teardrop with concentric rings painted inside it, which is a worse tell than the disc was:
    // a round core in a pointed decal reads as a decal.
    const along=t=>t>0?K:NEAR, wide=t=>WIDE*(1-pinch*Math.min(1,Math.max(0,t/rr)));
    // the per-vertex paving test only runs for the handful of pools that can possibly reach the
    // ribbon — everything else takes the lawn triple and never walks the polyline again
    const onPave=roadD2(x,z)<(PAVE_R+rr*1.34*K)*(PAVE_R+rr*1.34*K);
    // 11 sides, not 8: at this radius in the near field an octagon is a legible octagon, which is
    // the v130.3 clearing-patch tell all over again. 11 plus a 0.34 rim wobble is a blob. The stretch
    // pulls those 11 toward the long axis, so the tail is the best-resolved part of the outline.
    // THE THIRD RING IS A DRAPE FIX, NOT A SHADING ONE, and only the long ones pay for it. rings:2
    // puts one vertex loop halfway out; on a ten-unit tail that is a five-unit unsupported span and
    // the decal chords straight through any rise it crosses — half a tree's shadow buried in the
    // hill it is lying on. ~700 pools × 22 extra triangles, and the other ~1,300 stay at rings:2.
    const geo=drapedGeo(rr,11,x,z,0.085,{rings:K>2.4?3:2,wob:0.34,warp:(lx,lz,out)=>{
      const t=lx*ux+lz*uz, n=lx*nx+lz*nz, ts=t*along(t), ns=n*wide(t);
      out[0]=ts*ux+ns*nx; out[1]=ts*uz+ns*nz;
    }});
    if(node)node._poolPart=PATCH_PARTS.length;
    PATCH_PARTS.push({geo,matrix:new THREE.Matrix4().makeTranslation(x,0,z),
      color:(px,py,pz)=>{
        // undo the stretch, then measure: the stops stay circles in the pool's OWN space and come
        // out as nested teardrops in the world's, which is the only way the core keeps its shape.
        const ts=(px-x)*ux+(pz-z)*uz, ns=(px-x)*nx+(pz-z)*nz;
        const t=ts/along(ts), n=ns/wide(t);
        const d=Math.min(1,Math.hypot(t,n)/rr);
        // two stops and a rim, not a gradient: the ground everywhere else in this world takes its
        // shape from a hard terminator (§3.7) and a soft blob under a hard-edged prop reads as dirt.
        // The breaks sit OUTSIDE the prop's own footprint on purpose — the part of this the player
        // ever sees is the ring from 0.6 out, so that is where the value has to still be dark.
        // …AND THE BREAKS THEMSELVES LEAN DOWN-SUN, WHICH IS THE HALF OF THIS THAT ACTUALLY SHOWS.
        // Stretching the outline alone bought nothing, and the false-colour render is why: the stops
        // are a FRACTION of the outline, so a tail twice as long is a tail whose whole extra length
        // lands in RIM — and RIM is authored to be the lawn. First cut of this shipped the same
        // picture with a longer invisible edge on it. A cast shadow is not a halo with a point on
        // one side; it is dark along its length and gives up at the tip. `f` is how far down-sun a
        // fragment sits, and it walks both breaks out with it.
        // AND TWO RINGS IS TWO CELLS, which is why this is the lever rather than more geometry. A
        // vertex colour is only as sharp as the cell it sits in — the King's Road paid 61k triangles
        // to learn that at :1424 — and at rings:2 there are exactly three radii to paint: the centre,
        // one at ~0.5, and the rim. Sliding a break BETWEEN them changes nothing the mesh can draw.
        // Sliding it PAST the rim is what repaints the outer vertex, and the outer vertex on the
        // down-sun side is the only part of a pool that is ever out from under its own prop.
        const f=Math.min(1,Math.max(0,t/rr));
        const S=(onPave&&roadD2(px,pz)<PAVE_R*PAVE_R)?PAVED:GRASS;
        // 0.50 is not tuned, it is where the mesh has vertices: the inner loop of a rings:3 disc
        // sits at 0.33 of the wobbled radius and the middle loop at 0.66, so the break has to fall
        // between them or it repaints nothing (the same lesson the outer two stops learned the hard
        // way at rings:2). It does NOT lean down-sun with `f` the way the others do — occlusion is a
        // property of the contact, not of the light, and a deep stop that ran out along the tail
        // would put the darkest paint in the picture where the tree ISN'T.
        return d<0.50?S[0]:(d<0.78+0.16*f?S[1]:(d<0.90+0.28*f?S[2]:S[3]));
      }});
  }
})();
// ---------- THE WELD, on the far side of the handback (see the note above) ----------
// v131.2 …and it now hands each tree back the slice of the buffer its own shadow lives in.
// The moment a tree's pool became ten units long instead of three, felling one stopped being a
// cosmetic detail: a villager chops a conifer, the mesh swaps to a stump, and a ten-metre wedge of
// shade stays lying on the grass pointing away from a tree that is not there. _mergeColored walks
// `parts` in order and writes `position.count` vertices per part (toNonIndexed() first, so an
// indexed disc contributes index.count), which is enough to reconstruct every offset without
// touching the merge itself.
let _POOL_MESH=null;
(function weldGroundDecals(){
  for(const parts of [PATCH_PARTS,ROAD_PARTS]){
    if(!parts.length)continue;
    const m=new THREE.Mesh(_mergeColored(parts),_fogClamp(toonMat({vertexColors:true}),GROUND_FOG));
    m.castShadow=false; m.receiveShadow=true; scene.add(m);
    if(parts!==PATCH_PARTS)continue;
    _POOL_MESH=m;
    const at=[]; let o=0;
    for(const p of parts){
      const g=p.geo, k=g.index?g.index.count:g.attributes.position.count;
      at.push(o); o+=k;
    }
    for(const n of nodes){
      if(n._poolPart===undefined)continue;
      const g=parts[n._poolPart].geo;
      n._poolAt=at[n._poolPart];
      n._poolN=g.index?g.index.count:g.attributes.position.count;
    }
  }
})();
// The lawn the tail has to disappear into — GRASS[2] above, in the linear space the merged buffer
// is written in (_mergeColored decodes every hex it is handed).
const _POOL_LAWN=new THREE.Color(0x6A8A41).convertSRGBToLinear();
let _poolFrame=-1;
function fellPool(n){
  if(!_POOL_MESH||n._poolAt===undefined)return;
  const g=_POOL_MESH.geometry, P=g.attributes.position, C=g.attributes.color;
  const a=n._poolAt, b=a+n._poolN;
  for(let i=a;i<b;i++){
    // the stump keeps the dark it is standing in — that part of the pool is still true, and §8.9
    // wants a sawn stump grounded exactly as much as a tree was. Everything past 1.1 units is the
    // tree that is gone; it lets go over the next 1.6 so the edit has no edge of its own.
    const dx=P.getX(i)-n.x, dz=P.getZ(i)-n.z;
    const k=Math.min(1,Math.max(0,(Math.hypot(dx,dz)-1.1)/1.6));
    if(k<=0)continue;
    C.setXYZ(i,C.getX(i)+(_POOL_LAWN.r-C.getX(i))*k,
               C.getY(i)+(_POOL_LAWN.g-C.getY(i))*k,
               C.getZ(i)+(_POOL_LAWN.b-C.getZ(i))*k);
  }
  // r128 re-uploads whatever `updateRange` says ONCE per render, so two trees felled between two
  // frames have to share one range or the first one's paint never reaches the GPU — and a plain
  // needsUpdate re-uploads the whole 2.8 MB patch buffer, which is exactly the kind of thing that
  // turns up later as a stutter on a phone every time a villager finishes a tree. Union inside a
  // frame, reset on the next one; renderer.info.render.frame is the counter that knows.
  const lo=a*3, hi=b*3, ur=C.updateRange;
  const fr=(typeof renderer!=="undefined"&&renderer.info)?renderer.info.render.frame:-1;
  if(fr!==_poolFrame){ _poolFrame=fr; ur.offset=lo; ur.count=hi-lo; }
  else { const end=Math.max(ur.offset+ur.count,hi); ur.offset=Math.min(ur.offset,lo); ur.count=end-ur.offset; }
  C.needsUpdate=true;
}

// =============================================================================================
// v131 THE HOUR — a low sun that is actually low (§3.1, and the vantage that was testing nothing)
// =============================================================================================
// tools/vista.js has had a shot called "05-lowsun" since v128 and it has never once photographed a
// low sun. The tool re-parks the light for every shot with a hardcoded `sun.position.set(look.x+120,
// 168, look.z+80)` — the SAME vector, at the same elevation, in the same colour, for all six — so
// 05-lowsun came out pixel-for-pixel as lit as 01-meadow: same sun angle, same temperature, same
// shadow length. One of the six vantages the whole overhaul is judged on was a duplicate.
// This is the rig it should have been aiming, and it lives in the world file rather than in the
// tool for the reason the tool's own v129.5 note gives about the shadow box: a harness that writes
// the lighting down a second time is a harness that photographs a lie the first time somebody tunes
// the real one. One door, and the tool asks it for an hour.
//
// THE AZIMUTH IS FROZEN AND THAT IS THE WHOLE DESIGN. §3.1's (120,168,80) is canon, the shadow map
// uses it, and — the part that would break silently — paintContactShadows above BAKES its teardrops
// along its ground projection at world-build time. Swing the sun round the compass at runtime and
// every painted pool on the map points one way while every cast shadow points the other, which is
// worse than the symmetric halos v130.6 replaced. So an hour changes ELEVATION ONLY: same compass
// bearing, same |offset| (the shadow camera's near=110/far=340 is bracketed for that length and
// nothing else), sun dropped from §3.1's 49.4° to 21°. Physically that is also just what evening
// is, and it means the painted contact pool and the cast shadow lie along the same line — the pool
// is the dark at the root of a shadow that now runs 2.6× the caster's height instead of 0.86×.
//
// WHY 21° AND NOT 12°. RAMP_BANDS breaks the lit cell at dotNL 0.52 and the mid cell at 0.18. Flat
// ground takes sin(elevation), so at 49.4° the entire map sits in `lit` (0.76) and the terrain has
// no value structure at all — which is half of why §1.1 keeps calling the frame one value. At 21°
// flat ground is 0.36, squarely in `mid`, while any face tilted ~19° toward the sun crosses into
// `lit`. The hills stop being a texture and start being lit form. Below about 15° the whole field
// falls out of `mid` into the terminator band and the picture goes to mud in one step, which is the
// cliff a four-cell ramp always has and the reason this is not simply "as low as possible".
//
// THE COLOUR HAS TO MOVE WITH THE ANGLE OR IT IS JUST A DIMMER. Sun to §2.1's warm end and UP in
// intensity (the mid cell costs 43% of the directional term, so holding 1.55 would ship a grey
// overcast and call it golden hour); the hemisphere down and cooler, because at dusk the sky IS the
// fill; and the atmosphere warms with it — which is the one part that cannot be done by writing to
// scene.fog.color alone. THREE PLACES CARRY THAT COLOUR, and §4.3 is void the moment they disagree:
// scene.fog, the sky dome's horizon stop, and every ink material's private `fogColor` uniform
// (01-engine.js:416 copies it at MINT time, precisely so it cannot be reached by writing to the fog).
// Miss the third and every outlined tree in the mid-field keeps a cold blue-grey rind against a
// warm haze; miss the second and the horizon stops dissolving and becomes a cut-out again.
const HOUR_DUSK=21*Math.PI/180;          // §3.1's noon is 49.4°; this is the other end of the dial
let _HOUR0=null;
let sunHour=0;   // readable from the harness and the console: which hour the world is standing in
function setSunHour(t,tx,tz){
  if(typeof sun==="undefined"||!sun)return;
  t=Math.max(0,Math.min(1,t||0));
  // capture the boot rig ONCE, so setSunHour(0) is a byte-for-byte restore rather than a guess at
  // what the numbers used to be. Six shots run through this in one process; the fifth must not
  // leave the sixth in a half-warmed world.
  if(!_HOUR0)_HOUR0={
    sunCol:sun.color.clone(), sunI:sun.intensity,
    hemiSky:(typeof hemi!=="undefined"&&hemi)?hemi.color.clone():null,
    hemiGnd:(typeof hemi!=="undefined"&&hemi)?hemi.groundColor.clone():null,
    hemiI:(typeof hemi!=="undefined"&&hemi)?hemi.intensity:0,
    ambCol:(typeof warm!=="undefined"&&warm)?warm.color.clone():null,
    ambI:(typeof warm!=="undefined"&&warm)?warm.intensity:0,
    fog:(scene.fog?scene.fog.color.clone():new THREE.Color(0xBFD6E6)),
    skyMid:new THREE.Color(0x6FA6DC), skyTop:new THREE.Color(0x2E6FB8),
    off:(typeof _SUN_OFF!=="undefined"&&_SUN_OFF)?_SUN_OFF.clone():new THREE.Vector3(120,168,80)
  };
  const B=_HOUR0, L=B.off.length(), az=Math.atan2(B.off.z,B.off.x);
  const e=Math.asin(Math.max(-1,Math.min(1,B.off.y/L)))*(1-t)+HOUR_DUSK*t;
  const hx=Math.cos(e)*L;
  // _SUN_OFF itself moves, not just this frame's light position: aimShadow() (01-engine.js:289)
  // re-derives the light from it every frame, so writing only sun.position would hold for exactly
  // one render and snap back the instant the game loop is not frozen. Same length, same bearing.
  if(typeof _SUN_OFF!=="undefined"&&_SUN_OFF)_SUN_OFF.set(Math.cos(az)*hx,Math.sin(e)*L,Math.sin(az)*hx);
  // v131.2 …AND THE SHADOW MAP'S SNAP GRID IS BUILT OUT OF THAT VECTOR, ONCE, AT BOOT.
  // aimShadow (01-engine.js:283-285) derives a light-space basis from _SUN_OFF the moment the file
  // loads, precisely because "that offset never rotates". This function rotates it. Everything else
  // downstream re-reads _SUN_OFF every frame and was fine; the basis is the one thing cached, so
  // after an hour change the focus was being rounded to texel multiples of the NOON lattice while
  // the map was being sampled on the dusk one — i.e. the shimmer the snap exists to kill comes
  // straight back, and only at the low sun, and only while the camera is moving, which is why no
  // still frame has ever shown it. Same three lines the engine computes, re-run on the vectors
  // themselves (they are const bindings holding mutable Vector3s, so this rebinds nothing).
  try{
    if(_lz&&_lx&&_ly){
      _lz.copy(_SUN_OFF).normalize();
      _lx.set(0,1,0).cross(_lz);
      if(_lx.lengthSq()<1e-8)_lx.set(1,0,0); else _lx.normalize();   // a sun at the zenith has no bearing
      _ly.copy(_lz).cross(_lx);
    }
  }catch(_){}
  sun.color.copy(B.sunCol).lerp(new THREE.Color(0xFFC489),t);
  sun.intensity=B.sunI+(2.05-B.sunI)*t;
  if(typeof hemi!=="undefined"&&hemi){
    hemi.color.copy(B.hemiSky).lerp(new THREE.Color(0x7E9EC8),t);
    hemi.groundColor.copy(B.hemiGnd).lerp(new THREE.Color(0x5E5330),t);
    hemi.intensity=B.hemiI+(0.34-B.hemiI)*t;
  }
  if(typeof warm!=="undefined"&&warm){
    warm.color.copy(B.ambCol).lerp(new THREE.Color(0xFFD2A6),t);
    warm.intensity=B.ambI+(0.07-B.ambI)*t;
  }
  // ---- the atmosphere, all three copies of it (see the note above) ----
  const haze=B.fog.clone().lerp(new THREE.Color(0xE8C9A2),t);
  if(haze){
    if(scene.fog)scene.fog.color.copy(haze);
    if(typeof INK_MATS!=="undefined"&&INK_MATS&&INK_MATS.forEach)
      INK_MATS.forEach(m=>{if(m&&m.uniforms&&m.uniforms.fogColor)m.uniforms.fogColor.value.copy(haze);});
    if(typeof skyDome!=="undefined"&&skyDome&&skyDome.material&&skyDome.material.uniforms){
      const u=skyDome.material.uniforms;
      if(u.horizon)u.horizon.value.copy(haze);
      if(u.mid)u.mid.value.copy(B.skyMid).lerp(new THREE.Color(0xB49CC0),t);   // the mauve band an evening has
      if(u.top)u.top.value.copy(B.skyTop).lerp(new THREE.Color(0x2B5296),t);
    }
  }
  // aim it, so a caller that has just teleported a camera does not also have to know how the
  // shadow box works. tx/tz optional: with no target this is a pure hour change.
  if(sun.target&&tx!==undefined){
    sun.target.position.set(tx,0,tz===undefined?0:tz); sun.target.updateMatrixWorld();
  }
  if(sun.target)sun.position.copy(sun.target.position).add(_SUN_OFF);
  sun.updateMatrixWorld();
  if(typeof renderer!=="undefined"&&renderer&&renderer.shadowMap)renderer.shadowMap.needsUpdate=true;
  sunHour=t;
  return t;
}
// `?hour=<0..1>` so the rig can be looked at in the real game and not only through the harness —
// the same reason `?ink=` and `?gfx=` exist. It runs here, below the handback, so nothing it
// touches is on the wire; and because the bearing never moves, the contact pools baked a few lines
// up are still pointing exactly where the shadows fall.
try{
  const _h=parseFloat(new URLSearchParams(location.search).get("hour"));
  if(isFinite(_h))setSunHour(_h);
}catch(e){}
