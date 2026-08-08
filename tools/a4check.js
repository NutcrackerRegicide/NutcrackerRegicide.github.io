#!/usr/bin/env node
/* REGICIDE — tools/a4check.js — §H A4, THE INTRA-AGE SEPARATION GATE.
   =================================================================
   A1 / A1b / A2 compare ONE AGE AGAINST ANOTHER. In a real match you almost never see two ages
   side by side — both teams advance together. A4 is the only gate that measures COMBAT
   readability: inside a single age, at speed, can a player tell a swordsman from a spearman from
   an archer? Misreading a pikeman as a swordsman costs a cavalry charge. A4 was specified in
   AGES §H and never built; `grep -c A4 tools/agecheck.js` returns 0.

     node tools/a4check.js              all six ages
     node tools/a4check.js 2            one age
     node tools/a4check.js 0,2,5        a subset
     TEAM=1 node tools/a4check.js       the same sweep with TEAMCOL[0] set to the red hex
     IOU=0.80 node tools/a4check.js     override the silhouette threshold (default 0.85)
     A4EXT=1  node tools/a4check.js     dump the world extents the fixed camera is sized from

   It writes `_a4/ageN_renders.png`, `_a4/ageN_silF.png` and `_a4/ageN_silQ.png` every run — the
   renders and the 40px masks the gate actually compares. LOOK AT THEM. The threshold below was
   set from those pictures and can only be argued with from those pictures.

   WHAT §H A4 SAYS, VERBATIM:
     "FAIL if any two are within ΔE00 = 8 on their whole-figure mean AND indistinguishable as 40px
      black silhouettes."
   Two measurements. A pair fails ONLY if it fails BOTH. A pair separated by colour alone, or by
   outline alone, is fine — the defect is a pair separated by neither.

   ------------------------------------------------------------------------------------------
   THE FIVE THINGS THIS FILE DOES ON PURPOSE, EACH BECAUSE SOMETHING ELSE GOT THEM WRONG
   ------------------------------------------------------------------------------------------
   1. composer.render(), NEVER renderer.render(). unitshot.js and cartshot.js took their numbers
      off a bare renderer for months and calibrated a beard at (246,242,231) that shipped at
      (255,255,247). __draw() below THROWS if composer is absent rather than falling back, because
      a silent fallback is exactly how that survived three rounds of "measured, correct".
   2. u.id IS FORCED TO 0 AND THE BODY REBUILT. makeUnit assigns `u.id=UID++`, so the Nth unit
      built in a process gets the Nth skin tone (`SKIN_TONES[u.id%4]`), the Nth flint colour and
      the Nth beard slot. A gate that builds units in roster order and then compares their mean
      colours would be measuring the order it happened to build them in. Every figure here is id 0.
   3. ONE FIXED CAMERA FOR THE WHOLE RUN, sized off the tallest body in CLS — not per-unit framing.
      Per-unit framing throws away relative size, and size is a real combat cue: a trebuchet and a
      villager are not confusable however similar their outlines. The camera constant is derived
      from every class in CLS (not just the age under test) so it does not move when you run a
      subset, and the tool asserts that no figure touches the frame edge.
   4. TWO VIEWS, AND A PAIR MUST COLLIDE IN BOTH. Head-on is the project's convention (A1b) and is
      the fairest read of a hat; three-quarter at camPitch 0.62 — the game's own default, from
      00-data.js — is what a player actually looks at. If two units are separable from EITHER
      angle, a player in a fight who sees them turn is not confused, so the pair's silhouette score
      is the MIN of the two IoUs.
   5. THE SELF-TEST RUNS EVERY TIME AND ITS RESULT IS PRINTED FIRST. One class is rendered twice,
      under two labels, through two independent makeUnit calls and two independent screenshots.
      A4 must report that pair as a collision. A control pair known to be different must NOT be
      reported. A gate that cannot fail is worse than no gate: this project has shipped a colour
      gate that let six identical silhouettes pass, a triangle delta that subtracted two different
      cameras, and a "low sun" shot lit at noon.

   ------------------------------------------------------------------------------------------
   THE IoU THRESHOLD, AND WHY IT IS NOT A1b's 0.70
   ------------------------------------------------------------------------------------------
   A1b compares HEADS. A hat is the variable part of a head, so two hats that overlap 70% really
   are one hat in two colours. A4 compares WHOLE FIGURES, and every unit in this game is the same
   nutcracker armature — one head, one barrel torso, two legs, a plinth — differing in costume and
   props. That shared armature is most of the mask no matter what, so whole-figure IoU has a much
   higher floor than head IoU. A 0.70 ceiling applied to whole figures would be unfailable, which
   is the exact failure mode this gate exists to avoid.

   THRESHOLD = 0.85, AND HERE IS THE HONEST HISTORY OF THAT NUMBER, because a perceptual threshold
   argued from arithmetic alone is how this project got three gates that measured nothing.
     0.88 was pre-registered before any number was read, from a structural argument: 0.88 means the
     symmetric difference is 12.8% of the union, which on a 40px figure (~450-800 lit px) is
     ~60-100px of outline disagreement, about the area of one held prop.
     Then the masks were WRITTEN OUT AND LOOKED AT — `_a4/ageN_silF.png`, every run — and the
     argument did not survive contact with them:
       IoU 0.87  clubman / spearman        two identical blocky columns. Neither the club nor the
                                           spear survives to 40px. Indistinguishable.
       IoU 0.83  shortsword / spearfighter separated by ONE 1px spear line and nothing else.
       IoU 0.79  villager / skirmisher     different mass at the shoulders; tellable.
       IoU 0.72  musketeer / halberdier    a musket left, a pole right; obviously two units.
     The flip sits between 0.85 and 0.87, so the gate sits at 0.85. Moving a threshold after seeing
     data is only legitimate if the move is declared and the other number is still reported: the run
     prints the pair count at 0.80 / 0.85 / 0.88 / 0.92, prints the failing list at the stricter
     0.80 as well, and writes the masks to disk so anyone can re-judge the call from the pictures.

   A SIZE GUARD SITS BESIDE IT. Normalising both masks to 40px tall deliberately removes size, the
   way A1b removes hat size — but two units of visibly different size are not confusable whatever
   their normalised outlines do. A pair only counts as a silhouette collision if it is ALSO within
   15% on raw rendered height (6px at 40px tall, which is plainly visible). Raw heights come from
   the fixed camera, so they are a true size comparison and not an artefact of framing.           */

const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_a4");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};

const W=760,H=760;                       // square: aspect 1, so the horizontal and vertical
                                         // half-extents of the frustum are equal and one margin
                                         // calculation covers both. Large on purpose — see FRAC.
const FRAC=0.86;                         // the TALLEST body in CLS fills this much of the frame.
                                         // >>> DO NOT RENDER AT 40px AND CALL IT A 40px TEST. <<<
                                         // The first cut of this file sized the frame off the
                                         // trebuchet and left the villager 31px tall, so the
                                         // "40px silhouette" was an UPSAMPLE of a 31px render:
                                         // the gate was comparing swiftshader's aliasing, not the
                                         // costume. Everything renders large here and the MASK is
                                         // box-downsampled to 40 rows with a 50% coverage rule,
                                         // which is what a rasteriser does at 40px and what a
                                         // player's screen actually shows.
const N=40;                              // §H A4 / §A3: the silhouette is judged at 40px tall
const M=N*6;                             // mask canvas width — 6x the height clears the ox cart
const IOU_T=+(process.env.IOU||0.85);    // see the header block — calibrated against the masks
const DE_T=8;                            // §H A4: the ΔE00 floor, verbatim
const SIZE_T=1.15;                       // raw-height ratio under which size stops being a cue
const MASK_T=90;                         // L1 distance from the measured chroma key (as agecheck)
const PITCH=0.62;                        // 00-data.js:553 — the game's default camPitch, radians
const YAW34=35*Math.PI/180;              // the three-quarter turn for view Q
const FOV=58;                            // 01-engine.js:59
const AGENAME=["Stone","Bronze","Iron","Classical","Medieval","Enlightenment"];
const TEAMN=+(process.env.TEAM||0);

// The six pairs the owner's own research flagged as at-risk, and how each is supposed to separate.
const AT_RISK=[
  ["clubman","spearman",      "dome vs flat-top cap + the diagonal chest strap"],
  ["shortsword","spearfighter","cheek pieces present/absent, stacked vs single shoulder guards"],
  ["broadsword","impspear",   "the horsehair tuft and the shield"],
  ["vanguard","knight",       "flat great helm vs pointed hounskull snout"],
  ["musketeer","skirmisher",  "team-colour torso vs green torso, team only at the edges"],
  ["cannon","culverin",       "barrel length"]
];

// ---------------------------------------------------------------------------- colour maths
function pixels(file){
  const raw=cp.execSync(`convert ${JSON.stringify(file)} -depth 8 -colorspace sRGB rgb:-`,{maxBuffer:1<<28});
  return {w:W,h:H,d:raw};
}
const at=(P,x,y)=>{const i=(y*P.w+x)*3;return [P.d[i],P.d[i+1],P.d[i+2]];};
const luma=c=>(0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255;
const hex=c=>"#"+c.map(v=>Math.round(v).toString(16).padStart(2,"0")).join("").toUpperCase();
function _lab(c){
  const f=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  const r=f(c[0]),g=f(c[1]),b=f(c[2]);
  let X=(r*0.4124+g*0.3576+b*0.1805)/0.95047,Y=(r*0.2126+g*0.7152+b*0.0722),
      Z=(r*0.0193+g*0.1192+b*0.9505)/1.08883;
  const k=t=>t>0.008856?Math.cbrt(t):(7.787*t+16/116);
  X=k(X);Y=k(Y);Z=k(Z);
  return [116*Y-16,500*(X-Y),200*(Y-Z)];
}
function dE00(c1,c2){
  const [L1,a1,b1]=_lab(c1),[L2,a2,b2]=_lab(c2);
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2;
  const G=0.5*(1-Math.sqrt(Math.pow(Cb,7)/(Math.pow(Cb,7)+Math.pow(25,7))));
  const A1=(1+G)*a1,A2=(1+G)*a2;
  const Cp1=Math.hypot(A1,b1),Cp2=Math.hypot(A2,b2);
  const h=(x,y)=>{if(x===0&&y===0)return 0;let t=Math.atan2(y,x)*180/Math.PI;return t<0?t+360:t;};
  const h1=h(A1,b1),h2=h(A2,b2);
  const dL=L2-L1,dC=Cp2-Cp1;
  let dh=0; if(Cp1*Cp2!==0){dh=h2-h1;if(dh>180)dh-=360;else if(dh<-180)dh+=360;}
  const dH=2*Math.sqrt(Cp1*Cp2)*Math.sin(dh*Math.PI/360);
  const Lb=(L1+L2)/2,Cbp=(Cp1+Cp2)/2;
  let hb=h1+h2;
  if(Cp1*Cp2!==0){if(Math.abs(h1-h2)>180)hb+=(h1+h2<360)?360:-360;hb/=2;}
  const T=1-0.17*Math.cos((hb-30)*Math.PI/180)+0.24*Math.cos(2*hb*Math.PI/180)
          +0.32*Math.cos((3*hb+6)*Math.PI/180)-0.20*Math.cos((4*hb-63)*Math.PI/180);
  const Sl=1+(0.015*Math.pow(Lb-50,2))/Math.sqrt(20+Math.pow(Lb-50,2));
  const Sc=1+0.045*Cbp,Sh=1+0.015*Cbp*T;
  const Rt=-2*Math.sqrt(Math.pow(Cbp,7)/(Math.pow(Cbp,7)+Math.pow(25,7)))
           *Math.sin(60*Math.exp(-Math.pow((hb-275)/25,2))*Math.PI/180);
  return Math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh));
}
// ---------------------------------------------------------------------------- mask maths
// The background is a chroma key and it is MEASURED, not assumed: the grade multiplies blue by
// 0.97 and bloom bleeds the figure outward, so the magenta that comes out is not the magenta that
// went in. Sampling the corner every frame also means the tool cannot be fooled by a post change.
function maskOf(P){
  const bg=at(P,3,3), m=new Uint8Array(P.w*P.h); let n=0;
  for(let y=0;y<P.h;y++)for(let x=0;x<P.w;x++){
    const c=at(P,x,y);
    if(Math.abs(c[0]-bg[0])+Math.abs(c[1]-bg[1])+Math.abs(c[2]-bg[2])>MASK_T){m[y*P.w+x]=1;n++;}
  }
  return {m,n,bg};
}
function bboxOf(mk,P){
  let x0=1e9,x1=-1,y0=1e9,y1=-1;
  for(let y=0;y<P.h;y++)for(let x=0;x<P.w;x++)if(mk.m[y*P.w+x]){
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
  }
  return {x0,x1,y0,y1,w:x1-x0+1,h:y1-y0+1};
}
// the 40px black silhouette. UNIFORM scale (the same factor in x as in y), so aspect ratio — a
// horizontal wolf against a vertical clubman, a wide cart against a narrow archer — survives into
// the compare; only absolute size is removed, and absolute size comes back as a raw-height ratio.
// The downsample is a BOX FILTER with a 50% coverage rule, not a point sample: a spear shaft two
// render-pixels wide has to actually cover half a destination pixel to survive to 40px, which is
// the honest version of "would a player see it".
function silhouette(P,mk,bb){
  const nw=Math.max(1,Math.round(bb.w*N/bb.h));
  if(nw>M)throw new Error("silhouette wider than the mask canvas ("+nw+" > "+M+") — raise M");
  const out=new Uint8Array(M*N), off=Math.floor((M-nw)/2);
  for(let j=0;j<N;j++){
    const y0=bb.y0+Math.floor(j*bb.h/N), y1=Math.max(y0+1,bb.y0+Math.floor((j+1)*bb.h/N));
    for(let i=0;i<nw;i++){
      const x0=bb.x0+Math.floor(i*bb.w/nw), x1=Math.max(x0+1,bb.x0+Math.floor((i+1)*bb.w/nw));
      let on=0,tot=0;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){tot++;if(mk.m[y*P.w+x])on++;}
      if(tot&&on/tot>=0.5)out[j*M+off+i]=1;
    }
  }
  out.nw=nw; return out;
}
// write a 40px mask out as a PPM so a human can LOOK at what the gate is comparing. The six
// identical shakos were caught by looking and by nothing else.
function writeMask(sil,file){
  const buf=Buffer.alloc(M*N*3);
  for(let i=0;i<M*N;i++){const v=sil[i]?0:255;buf[i*3]=v;buf[i*3+1]=v;buf[i*3+2]=v;}
  fs.writeFileSync(file,Buffer.concat([Buffer.from("P6\n"+M+" "+N+"\n255\n"),buf]));
}
const iou=(a,b)=>{let I=0,U=0;for(let i=0;i<a.length;i++){if(a[i]&&b[i])I++;if(a[i]||b[i])U++;}return U?I/U:1;};
const pad=(s,n)=>String(s).padEnd(n);
const lp =(s,n)=>String(s).padStart(n);

(async()=>{
  fs.rmSync(OUT,{recursive:true,force:true});
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}}).listen(8163);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:W,height:H}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8163/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:30000});

  // ------------------------------------------------------------------ the stage
  await page.evaluate(([PITCH,YAW34,FOV,TEAMN])=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;
    for(const u of units)u.root.visible=false;
    // Hide the world outright rather than shooting past it: anything left in frame is a second
    // surface the mask has to reject, and graded terrain sits inside the value range of a dark helm.
    for(const c of scene.children){ if(c.isLight)continue; c.visible=false; }
    scene.fog=null;
    scene.background=new THREE.Color(0xB020C0);   // the chroma key
    if(TEAMN)TEAMCOL[0]=TEAMCOL[1];               // same figure, the colour the shape gate is blind to
    window.__A4={PITCH,YAW34,FOV,D:null,CY:null};
    window.__draw=()=>{
      renderer.shadowMap.needsUpdate=true;
      if(typeof composer==="undefined"||!composer)
        throw new Error("no composer — every number this tool prints would be void (§G.6)");
      for(let i=0;i<3;i++)composer.render();
    };
    // Build one figure, at id 0, at a known place, facing a known way. Returns its WORLD extents;
    // the camera is not touched here, because pass 0 needs the extents to size the camera at all.
    window.__build=(cls,age,yaw)=>{
      if(window.__shot){window.__shot.root.visible=false;window.__shot.alive=false;}
      teamAge[0]=age;
      const u=makeUnit(0,cls,0,140,{name:"A4",bot:null,isKing:cls==="king"});
      if(!u)return null;
      // >>> THE ID. makeUnit hands out UID++ and every appearance table in 04-units.js indexes off
      // it (SKIN_TONES[u.id%4], the flint quartet, BEARD_TONES[age*3+u.id%3]). Left alone, the Nth
      // unit built in this process wears the Nth skin, and a whole-figure mean colour would be
      // reporting build order. Forced to 0 and rebuilt, exactly as §G.5 requires of the game.
      u.id=0; buildBodyFor(u);
      for(const c of scene.children)if(!c.isLight)c.visible=false;
      window.__shot=u; u.root.visible=true;
      for(const p of u.root.children)p.visible=false;
      u.body.visible=true;                        // body only: no selection ring, no health bar
      u.root.position.set(0,0,140);               // terrainHeight() reseeds per process; pin it
      u.facing=0; u.body.rotation.set(0,yaw,0);
      // >>> updateMatrixWorld BEFORE Box3, and this is not defensive coding. <<<
      // requestAnimationFrame is stubbed out above, so nothing else in the process ever updates a
      // world matrix. Box3.setFromObject reads child.matrixWorld; without this line it returns the
      // extents the body had at its PREVIOUS position — which for a fresh unit is
      // terrainHeight(0,140), a value that reseeds per process. The camera in pass 0 is sized off
      // these numbers, so a stale matrix moved the camera per run and made the whole gate
      // non-deterministic while every individual render still looked perfectly correct.
      u.root.updateMatrixWorld(true);
      // >>> GAMEPLAY OVERLAYS ARE NOT COSTUME AND MUST COME OFF BEFORE ANYTHING IS MEASURED. <<<
      // The priest carries a heal aura: a RingGeometry of radius CLS.priest.heal.rng = 16 world
      // units, MeshBasicMaterial, opacity 0.16, parented to u.body. It is a UI ring, not a robe.
      // It is 16 units where a nutcracker is 3.8, so the first cut of this file sized ONE FIXED
      // CAMERA off it and rendered every unit in the game at a third of the resolution it should
      // have had — a villager came out 36px tall and the "40px silhouette" was an upsample of a
      // 36px render. 04-units.js:1778 already excludes exactly this material from the merge, by
      // predicate rather than by name, "a filter that stays correct when someone adds another".
      // Same predicate here, and the count is reported rather than swallowed.
      window.__overlay=0;
      u.body.traverse(o=>{
        const m=o.material;
        if(o.isMesh&&m&&m.isMeshBasicMaterial&&m.transparent&&m.opacity<0.5){o.visible=false;window.__overlay++;}
      });
      // ...and the box is computed by hand over VISIBLE meshes only. THREE.Box3.setFromObject in
      // r128 ignores `visible` entirely (expandByObject never looks at it), so hiding the aura
      // above would take it out of the render and leave it in the extents — the camera would
      // still be sized off a 16-unit ring nobody can see.
      const bb=new THREE.Box3(), _t=new THREE.Box3();
      u.body.traverse(o=>{
        if(!o.isMesh||!o.visible||!o.geometry)return;
        let p=o,vis=true; while(p&&p!==u.body){if(!p.visible)vis=false;p=p.parent;}
        if(!vis)return;
        if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
        _t.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        bb.union(_t);
      });
      if(bb.isEmpty())return null;
      let m=0; const s=new Set();
      u.body.traverse(o=>{if(o.isMesh){m++;s.add(o.material);}});
      return {minY:bb.min.y,maxY:bb.max.y,minX:bb.min.x,maxX:bb.max.x,
              minZ:bb.min.z-140,maxZ:bb.max.z-140,mesh:m,mat:s.size,overlay:window.__overlay};
    };
    // ONE camera rig for the whole run. view "F" = head-on. view "Q" = the game's own default
    // camPitch (0.62 rad, 00-data.js:553) — what a player is actually looking at in a fight.
    window.__cam=(view)=>{
      const A=window.__A4, D=A.D, CY=A.CY;
      camera.fov=A.FOV; camera.aspect=window.innerWidth/window.innerHeight;
      if(view==="F")camera.position.set(0,CY,140+D);
      else camera.position.set(0,CY+D*Math.sin(A.PITCH),140+D*Math.cos(A.PITCH));
      camera.lookAt(0,CY,140);
      camera.updateProjectionMatrix();
    };
  },[PITCH,YAW34,FOV,TEAMN]);

  // ---------------------------------------------- pass 0: size the ONE camera off all of CLS
  // Over every class in CLS, not just the age under test, so the constant does not move when you
  // run a subset. Deterministic: same CLS, same number.
  const allIds=await page.evaluate(()=>Object.keys(CLS));
  let maxTop=0, maxNear=0, big="", bigH=0;
  const ext=[], overlays={};
  for(const c of allIds){
    for(const yaw of [0,YAW34]){
      const e=await page.evaluate(([c,y])=>window.__build(c,c==="villager"||c==="king"?5:(CLS[c].age||0),y),[c,yaw]);
      if(!e)continue;
      maxTop=Math.max(maxTop,e.maxY); maxNear=Math.max(maxNear,e.maxZ);
      ext.push({c,halfW:Math.max(Math.abs(e.minX),Math.abs(e.maxX)),h:e.maxY-e.minY,near:e.maxZ,top:e.maxY,ov:e.overlay});
      if(e.maxY-e.minY>bigH){bigH=e.maxY-e.minY;big=c;}
      if(e.overlay)overlays[c]=e.overlay;
    }
  }
  if(process.env.A4EXT){
    console.log("\n  world extents, tallest first (A4EXT=1):");
    for(const e of ext.slice().sort((a,c)=>c.h-a.h).slice(0,12))
      console.log("    "+pad(e.c,16)+"h "+e.h.toFixed(2).padStart(7)+"   top "+e.top.toFixed(2).padStart(7)+
                  "   halfW "+e.halfW.toFixed(2).padStart(7)+"   nearZ "+e.near.toFixed(2).padStart(7));
    console.log("  widest / nearest:");
    for(const e of ext.slice().sort((a,c)=>c.near-a.near).slice(0,5))
      console.log("    "+pad(e.c,16)+"nearZ "+e.near.toFixed(2).padStart(7)+"   halfW "+e.halfW.toFixed(2).padStart(7));
  }
  const CY=maxTop/2;
  // The frustum must hold the tallest figure (measured from the ground, since CY is half of it)
  // and the widest one. FRAC leaves the rest as margin.
  let need=maxTop/2;
  for(const e of ext)need=Math.max(need,e.halfW);
  const D=(need/FRAC)/Math.tan(FOV*Math.PI/360)+maxNear;
  await page.evaluate(([D,CY])=>{window.__A4.D=D;window.__A4.CY=CY;},[D,CY]);
  console.log("\nREGICIDE §H A4 — THE INTRA-AGE SEPARATION GATE");
  console.log("=".repeat(96));
  console.log("  render path   composer.render() x3, chroma key 0xB020C0, mask = L1 > "+MASK_T+" from the measured corner");
  console.log("  camera        ONE fixed rig for the run, sized over all "+allIds.length+" CLS ids:  fov "+FOV+
              "  dist "+D.toFixed(2)+"  aim y "+CY.toFixed(2)+
              "   (tallest body: "+big+" at "+bigH.toFixed(2)+" world units)");
  console.log("                view F = head-on;  view Q = camPitch "+PITCH+" rad ("+(PITCH*180/Math.PI).toFixed(1)+
              "°, the game default) + "+(YAW34*180/Math.PI).toFixed(0)+"° yaw");
  console.log("  determinism   u.id forced to 0 and the body rebuilt on every figure; root pinned to (0,0,140)");
  console.log("  overlays off  transparent unlit gameplay meshes hidden before measuring: "+
              (Object.keys(overlays).length?Object.entries(overlays).map(([k,v])=>k+" x"+v).join(", ")
                                           :"none")+"   (the priest's 16-unit heal ring is not a robe)");
  console.log("  team          TEAMCOL[0] = team "+TEAMN+"  (A4's musketeer/skirmisher pair is a team-colour pair; run both)");
  console.log("  thresholds    colour  ΔE00 < "+DE_T+"   silhouette  min(IoU_F, IoU_Q) > "+IOU_T.toFixed(2)+
              "   size  height ratio < "+SIZE_T);
  console.log("                FAIL = colour AND silhouette AND size, per §H A4's \"within ΔE00 8 AND indistinguishable\"");

  // ---------------------------------------------- the roster, derived from CLS.age
  const AGES=await page.evaluate(()=>{
    const r=[[],[],[],[],[],[]];
    for(const k of Object.keys(CLS)){
      if(k==="villager"||k==="king")continue;       // one id each, driven by teamAge — added to all six
      r[Math.max(0,Math.min(5,CLS[k].age||0))].push(k);
    }
    for(let a=0;a<6;a++){r[a].unshift("king");r[a].unshift("villager");}
    return r;
  });
  const WILDS=await page.evaluate(()=>Object.keys(CLS).filter(k=>CLS[k].line==="wilds"));

  // ---------------------------------------------- the shooter
  let shots=0;
  const shoot=async(cls,age,label)=>{
    const rec={cls,label:label||cls,age,views:{}};
    for(const [v,yaw] of [["F",0],["Q",YAW34]]){
      const f=path.join(OUT,"a"+age+"_"+(label||cls)+"_"+v+".png");
      const e=await page.evaluate(([c,a,y,vv])=>{const r=window.__build(c,a,y);window.__cam(vv);window.__draw();return r;},
        [cls,age,yaw,v]);
      if(!e)return null;
      await page.screenshot({path:f}); shots++;
      const P=pixels(f), mk=maskOf(P);
      if(!mk.n)throw new Error("empty mask for "+cls+" view "+v+" — the figure did not render");
      const bb=bboxOf(mk,P);
      if(bb.x0<=1||bb.y0<=1||bb.x1>=P.w-2||bb.y1>=P.h-2)
        throw new Error("FRAMING: "+cls+" view "+v+" touches the frame edge — the fixed camera is too close");
      let r=0,g=0,bl=0;
      for(let y=bb.y0;y<=bb.y1;y++)for(let x=bb.x0;x<=bb.x1;x++){
        if(!mk.m[y*P.w+x])continue; const c=at(P,x,y); r+=c[0];g+=c[1];bl+=c[2];
      }
      const sil=silhouette(P,mk,bb);
      writeMask(sil,f.replace(/\.png$/,"_sil.ppm"));
      rec.views[v]={file:f,mean:[r/mk.n,g/mk.n,bl/mk.n],sil,h:bb.h,w:bb.w,px:mk.n,mesh:e.mesh};
    }
    // §H A4 says "whole-figure mean". The gate number is the head-on render — the project's
    // canonical framing, comparable with A1/A2 — and the three-quarter mean is printed beside it.
    rec.mean=rec.views.F.mean; rec.meanQ=rec.views.Q.mean;
    rec.h=rec.views.F.h; rec.mesh=rec.views.F.mesh;
    return rec;
  };
  // a pair's three numbers
  const score=(a,c)=>{
    const de=dE00(a.mean,c.mean);
    const iF=iou(a.views.F.sil,c.views.F.sil), iQ=iou(a.views.Q.sil,c.views.Q.sil);
    const si=Math.min(iF,iQ);
    const sz=Math.max(a.h,c.h)/Math.min(a.h,c.h);
    return {de,iF,iQ,si,sz,fail:de<DE_T&&si>IOU_T&&sz<SIZE_T};
  };

  // ==========================================================================================
  // THE SELF-TEST. It runs first, every run, and its result is printed before any finding, so
  // nobody ever reads an A4 result without knowing whether the instrument was live that day.
  // ==========================================================================================
  console.log("\n"+"=".repeat(96));
  console.log("SELF-TEST — PROVING THE GATE CAN FAIL BEFORE ANY OF ITS NUMBERS ARE TRUSTED");
  console.log("=".repeat(96));
  const stA=await shoot("spearman",0,"SELFTEST_spearman_A");
  const stB=await shoot("spearman",0,"SELFTEST_spearman_B");   // same class, second build, second screenshot
  const stC=await shoot("slinger",0,"SELFTEST_control_slinger");
  const posS=score(stA,stB), negS=score(stA,stC);
  console.log("  POSITIVE  spearman rendered twice, two makeUnit calls, two screenshots");
  console.log("            ΔE00 "+posS.de.toFixed(2)+"   IoU_F "+posS.iF.toFixed(3)+"   IoU_Q "+posS.iQ.toFixed(3)+
              "   size "+posS.sz.toFixed(3)+"   ->  "+(posS.fail?"REPORTED AS A COLLISION  ✓":"NOT REPORTED  ✗ THE GATE IS DEAD"));
  console.log("  NEGATIVE  spearman vs slinger (different unit, same age, same rig family)");
  console.log("            ΔE00 "+negS.de.toFixed(2)+"   IoU_F "+negS.iF.toFixed(3)+"   IoU_Q "+negS.iQ.toFixed(3)+
              "   size "+negS.sz.toFixed(3)+"   ->  "+(negS.fail?"REPORTED  ✗ THE GATE FLAGS EVERYTHING":"NOT REPORTED  ✓"));
  const selfOK=posS.fail&&!negS.fail;
  console.log("  SELF-TEST "+(selfOK?"PASS — the instrument is live: it fires on an identity and holds on a real difference"
                                    :"*** FAIL — EVERY NUMBER BELOW IS VOID ***"));
  // The positive is also a free §H A9 determinism probe: two processes are stronger, but two
  // independent builds inside one process already catch a Math.random() in appearance.
  console.log("  (the positive is also a determinism probe: ΔE00 "+posS.de.toFixed(3)+" / IoU "+posS.iF.toFixed(4)+
              " between two independent builds of one class"+(posS.de<0.01&&posS.iF>0.999?" — bit-stable":
              " — *** NOT STABLE: appearance is not a pure function of u.id (§G.5)")+")");
  if(!selfOK){ console.log("\nABORTING: a gate that cannot fail is worse than no gate."); await b.close(); srv.close(); process.exit(2); }

  // ==========================================================================================
  // THE SWEEP
  // ==========================================================================================
  const want=(process.argv[2]||"0,1,2,3,4,5").split(",").map(s=>+s.trim()).filter(a=>a>=0&&a<=5);
  const allFails=[], allPairs=[], byAge={};
  const HIST=[0.80,0.85,0.88,0.92];
  let histSil={},histAll=0; for(const t of HIST)histSil[t]=0;

  for(const age of want){
    const roster=AGES[age];
    const rows=[];
    for(const c of roster){
      try{ const r=await shoot(c,age); if(r)rows.push(r); }
      catch(e){ console.log("  BUILD/RENDER ERROR "+c+" @age"+age+": "+e.message); }
    }
    byAge[age]=rows;
    console.log("\n"+"=".repeat(96));
    console.log("AGE "+age+" — "+AGENAME[age].toUpperCase()+"   ("+rows.length+" units)");
    console.log("=".repeat(96));
    console.log("  "+pad("unit",16)+pad("mean(F)",10)+pad("V",7)+pad("mean(Q)",10)+lp("h px",6)+lp("w px",6)+lp("mesh",6)+"  note");
    for(const r of rows){
      const note=r.cls==="villager"||r.cls==="king"?"teamAge-driven":(WILDS.includes(r.cls)?"wilds — neutral creep, present in every age":"");
      console.log("  "+pad(r.label,16)+pad(hex(r.mean),10)+pad(luma(r.mean).toFixed(3),7)+pad(hex(r.meanQ),10)+
                  lp(r.h,6)+lp(r.views.F.w,6)+lp(r.mesh,6)+"  "+note);
    }
    // every pair
    const pairs=[];
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const s=score(rows[i],rows[j]);
      const p={age,a:rows[i].label,b:rows[j].label,...s};
      pairs.push(p); allPairs.push(p); histAll++;
      for(const t of HIST)if(s.si>t)histSil[t]++;
      if(s.fail)allFails.push(p);
    }
    pairs.sort((x,y)=>(y.si-x.si));
    const near=pairs.filter(p=>p.de<DE_T||p.si>IOU_T);
    console.log("\n  "+pairs.length+" pairs.  worst colour ΔE00 "+Math.min(...pairs.map(p=>p.de)).toFixed(1)+
                "   worst silhouette min-IoU "+Math.max(...pairs.map(p=>p.si)).toFixed(3)+
                "   A4 FAILURES: "+pairs.filter(p=>p.fail).length);
    if(near.length){
      console.log("  pairs tripping EITHER measure (a single trip is not a failure — both are required):");
      console.log("    "+pad("pair",34)+lp("ΔE00",7)+lp("IoU_F",8)+lp("IoU_Q",8)+lp("minIoU",8)+lp("size",7)+"  verdict");
      for(const p of near.slice(0,24))
        console.log("    "+pad(p.a+" / "+p.b,34)+lp(p.de.toFixed(1),7)+lp(p.iF.toFixed(3),8)+lp(p.iQ.toFixed(3),8)+
          lp(p.si.toFixed(3),8)+lp(p.sz.toFixed(2),7)+"  "+
          (p.fail?"*** A4 FAIL":(p.de<DE_T?"colour only — separated by outline":"outline only — separated by colour")));
    }else console.log("  no pair trips either measure.");
    // THE STRIPS, FOR LOOKING AT. Two of them: the renders, and the 40px silhouettes the gate
    // actually compares, blown up so a human can see whether "IoU 0.78" is a real difference or
    // an arithmetic one. No summary sentence substitutes for this.
    if(rows.length){
      const lab=s=>"-label "+JSON.stringify(s);
      cp.execSync("montage -tile "+rows.length+"x1 -geometry x300+3+3 -background '#202024' -fill '#D0D0D0' -pointsize 15 "+
        rows.map(r=>lab(r.label)+" "+JSON.stringify(r.views.F.file)).join(" ")+" "+
        JSON.stringify(path.join(OUT,"age"+age+"_renders.png")));
      for(const v of ["F","Q"])
        cp.execSync("montage -trim -tile "+rows.length+"x1 -geometry x150+4+4 -background '#3050A0' -fill '#FFFFFF' -pointsize 15 "+
          rows.map(r=>lab(r.label)+" "+JSON.stringify(r.views[v].file.replace(/\.png$/,"_sil.ppm"))).join(" ")+" "+
          JSON.stringify(path.join(OUT,"age"+age+"_sil"+v+".png")));
      console.log("  wrote "+path.join(OUT,"age"+age+"_renders.png")+" , _silF.png , _silQ.png");
    }
  }

  // ---------------------------------------------- the named at-risk pairs
  console.log("\n"+"=".repeat(96));
  console.log("THE SIX NAMED AT-RISK PAIRS (§H A4 / the CSV) — REPORTED WHETHER OR NOT THEY FAIL");
  console.log("=".repeat(96));
  console.log("  "+pad("pair",26)+lp("ΔE00",7)+lp("IoU_F",8)+lp("IoU_Q",8)+lp("minIoU",8)+lp("size",7)+"  verdict / how it is meant to separate");
  for(const [a,c,how] of AT_RISK){
    let found=null;
    for(const age of want){
      const rs=byAge[age]||[]; const ra=rs.find(r=>r.cls===a), rb=rs.find(r=>r.cls===c);
      if(ra&&rb){found=score(ra,rb);break;}
    }
    if(!found){console.log("  "+pad(a+"/"+c,26)+"  not in the ages swept");continue;}
    const v=found.fail?"*** A4 FAIL":(found.de<DE_T?"PASS on outline":(found.si>IOU_T?"PASS on colour":"PASS on both"));
    console.log("  "+pad(a+"/"+c,26)+lp(found.de.toFixed(1),7)+lp(found.iF.toFixed(3),8)+lp(found.iQ.toFixed(3),8)+
      lp(found.si.toFixed(3),8)+lp(found.sz.toFixed(2),7)+"  "+pad(v,18)+"  "+how);
  }

  // ---------------------------------------------- the flat failing list, worst first
  console.log("\n"+"=".repeat(96));
  console.log("EVERY A4 FAILURE, WORST FIRST — a fixer can work straight off this");
  console.log("=".repeat(96));
  if(!allFails.length){
    console.log("  NONE. No pair in any swept age is within ΔE00 "+DE_T+" AND above min-IoU "+IOU_T.toFixed(2)+
                " AND within "+SIZE_T+"x on height.");
  }else{
    // worst = closest in colour and highest in outline; rank on how far inside BOTH gates it sits
    allFails.sort((x,y)=>((y.si-IOU_T)/(1-IOU_T)+(DE_T-y.de)/DE_T)-((x.si-IOU_T)/(1-IOU_T)+(DE_T-x.de)/DE_T));
    console.log("  "+pad("age",15)+pad("pair",34)+lp("ΔE00",7)+lp("IoU_F",8)+lp("IoU_Q",8)+lp("minIoU",8)+lp("size",7));
    for(const p of allFails)
      console.log("  "+pad(AGENAME[p.age],15)+pad(p.a+" / "+p.b,34)+lp(p.de.toFixed(1),7)+lp(p.iF.toFixed(3),8)+
        lp(p.iQ.toFixed(3),8)+lp(p.si.toFixed(3),8)+lp(p.sz.toFixed(2),7));
  }

  // ------------------------------------------------------------------------------------------
  // THE TWO SINGLE-VIEW LISTS. The gate takes min(IoU_F, IoU_Q) — the LENIENT reading, "separable
  // from at least one of two canonical views", chosen so it does not fire on a pair a player could
  // resolve by watching a unit turn. That leniency has to be shown, not hidden, because the two
  // views are not equal in weight:
  //   view Q IS the gameplay angle. camPitch 0.62 is what the camera does when you are not
  //   touching it, so a pair that collides in Q is a pair a player is looking at right now.
  //   view F never happens in a match; it is the portrait angle, the one every other tool in this
  //   repo uses, and it is here so A4 stays comparable with A1b.
  // A pair that collides in ONE view is not an A4 failure. It is a pair with one line of defence.
  // ------------------------------------------------------------------------------------------
  for(const [v,key,why] of [["Q","iQ","THE GAMEPLAY ANGLE — camPitch 0.62, what a player is actually looking at"],
                            ["F","iF","HEAD-ON — the portrait angle every other tool in this repo uses"]]){
    const one=allPairs.filter(p=>!p.fail&&p.de<DE_T&&p[key]>IOU_T&&p.sz<SIZE_T).sort((a,c)=>c[key]-a[key]);
    console.log("\n  COLLIDES IN VIEW "+v+" ALONE — "+why);
    if(!one.length)console.log("    none.");
    else{
      console.log("    "+pad("age",15)+pad("pair",34)+lp("ΔE00",7)+lp("IoU_"+v,8)+lp("other",8)+lp("size",7)+"  what saves it");
      for(const p of one)console.log("    "+pad(AGENAME[p.age],15)+pad(p.a+" / "+p.b,34)+lp(p.de.toFixed(1),7)+
        lp(p[key].toFixed(3),8)+lp((v==="Q"?p.iF:p.iQ).toFixed(3),8)+lp(p.sz.toFixed(2),7)+
        "  only the "+(v==="Q"?"head-on":"gameplay-angle")+" outline");
    }
  }

  // and the same census one notch stricter, so nobody has to take 0.85 on trust
  const strict=allPairs.filter(p=>p.de<DE_T&&p.si>0.80&&p.sz<SIZE_T).sort((a,c)=>c.si-a.si);
  console.log("\n  AT THE STRICTER READING IoU > 0.80 (same colour and size rules): "+strict.length+" pairs");
  for(const p of strict)console.log("    "+pad(AGENAME[p.age],15)+pad(p.a+" / "+p.b,34)+lp(p.de.toFixed(1),7)+
    lp(p.iF.toFixed(3),8)+lp(p.iQ.toFixed(3),8)+lp(p.si.toFixed(3),8)+lp(p.sz.toFixed(2),7));

  // ---------------------------------------------- threshold sensitivity + the verdict
  console.log("\n"+"=".repeat(96));
  console.log("THRESHOLD SENSITIVITY — so the threshold is visible rather than asserted");
  console.log("=".repeat(96));
  console.log("  "+allPairs.length+" pairs swept.  Silhouette min-IoU distribution:");
  for(const t of HIST)console.log("    pairs over IoU "+t.toFixed(2)+":  "+lp(histSil[t],4)+"   ("+(100*histSil[t]/histAll).toFixed(1)+"%)");
  const deUnder=allPairs.filter(p=>p.de<DE_T).length;
  console.log("  pairs under ΔE00 "+DE_T+":  "+deUnder+"   ("+(100*deUnder/allPairs.length).toFixed(1)+"%)");
  const top=allPairs.slice().sort((a,c)=>c.si-a.si).slice(0,10);
  console.log("  the ten most similar OUTLINES in the game (colour ignored):");
  for(const p of top)console.log("    "+pad(AGENAME[p.age],15)+pad(p.a+" / "+p.b,34)+"minIoU "+p.si.toFixed(3)+
    "   ΔE00 "+p.de.toFixed(1)+"   size "+p.sz.toFixed(2));
  const topC=allPairs.slice().sort((a,c)=>a.de-c.de).slice(0,10);
  console.log("  the ten closest COLOURS in the game (outline ignored):");
  for(const p of topC)console.log("    "+pad(AGENAME[p.age],15)+pad(p.a+" / "+p.b,34)+"ΔE00 "+p.de.toFixed(1)+
    "   minIoU "+p.si.toFixed(3)+"   size "+p.sz.toFixed(2));

  console.log("\n"+"=".repeat(96));
  console.log("§H A4 VERDICT  — team "+TEAMN+", ages "+want.join(",")+", "+shots+" composer renders");
  console.log("  self-test "+(selfOK?"PASS":"FAIL")+"   ·   "+allPairs.length+" pairs   ·   "+allFails.length+" failures   ==>  "+
    (allFails.length?"*** A4 FAILS":"A4 PASSES"));
  console.log("=".repeat(96)+"\n");

  await b.close(); srv.close(); process.exit(allFails.length?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
