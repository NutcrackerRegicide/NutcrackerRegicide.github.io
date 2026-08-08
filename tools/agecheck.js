#!/usr/bin/env node
/* REGICIDE — tools/agecheck.js — THE GATE THAT CAN SEE SHAPE.
   ==========================================================
   AGES §H A1 measures ΔE00 on a colour crop of the crown. A build where all six ages wore the
   SAME shako in six different hexes scored 12.7 and passed it comfortably; the owner caught it by
   looking, and the spec could not. §H A1b is the answer and this file is A1b: it thresholds the
   head region into a BINARY MASK, throws the colour away entirely, and computes IoU between all
   fifteen pairs. Two hats that overlap by more than 70% of their combined area are one hat wearing
   different paint, and no amount of ΔE00 can say so.

     node tools/agecheck.js line [a,b,c,d,e,f]   A1 + A1b + A2 + the strip, on a six-unit ladder
     node tools/agecheck.js king                 §H A7 — six kings at teamAge 0-5
     node tools/agecheck.js shot  <cls> [age]    one figure, framed whole, for LOOKING at

   EVERYTHING GOES THROUGH composer.render() (§G.6). unitshot.js and cartshot.js were both taking
   their numbers off a bare renderer.render() until v131, which is how a beard measured at
   (246,242,231) shipped at (255,255,247). __draw() below throws rather than falling back, because
   a silent fallback is exactly how that bug survived three rounds of "measured, correct".

   THE BACKGROUND IS A CHROMA KEY AND IT IS MEASURED, NOT ASSUMED. The grade multiplies blue by
   0.97 and bloom bleeds the figure outward, so the magenta that comes out the far end is not the
   magenta that went in. The corner pixel is sampled every frame and the mask is a distance
   threshold against THAT, which also means the tool cannot be fooled by a post-stack change.   */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const ROOT=path.join(__dirname,"..");
const MODE=process.argv[2]||"line";
const OUT=path.join(ROOT,"_ages");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
const W=420,H=560;
const AGENAME=["Stone","Bronze","Iron","Classical","Medieval","Enlight."];

function pixels(file){
  const raw=cp.execSync(`convert ${JSON.stringify(file)} -depth 8 -colorspace sRGB rgb:-`,{maxBuffer:1<<28});
  return {w:W,h:H,d:raw};
}
const at=(P,x,y)=>{const i=(y*P.w+x)*3;return [P.d[i],P.d[i+1],P.d[i+2]];};
const luma=c=>(0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255;   // §A.0: Rec.709 on ENCODED bytes
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
// ---- the figure mask: everything that is not the measured background ----
function maskOf(P){
  const bg=at(P,3,3), m=new Uint8Array(P.w*P.h); let n=0;
  for(let y=0;y<P.h;y++)for(let x=0;x<P.w;x++){
    const c=at(P,x,y);
    const d=Math.abs(c[0]-bg[0])+Math.abs(c[1]-bg[1])+Math.abs(c[2]-bg[2]);
    if(d>90){m[y*P.w+x]=1;n++;}
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
// mean colour of the masked pixels inside a row band, optionally dropping team-coloured ones
function bandMean(P,mk,bb,f0,f1,dropTeam,beard,win){
  const y0=Math.round(bb.y0+bb.h*f0), y1=Math.round(bb.y0+bb.h*f1);
  const X0=win?Math.max(bb.x0,win[0]):bb.x0, X1=win?Math.min(bb.x1,win[1]):bb.x1;
  let r=0,g=0,b=0,n=0;
  for(let y=y0;y<y1;y++)for(let x=X0;x<=X1;x++){
    if(!mk.m[y*P.w+x])continue;
    if(beard&&beard[y*P.w+x])continue;            // the beard is u.id-driven, not age-driven
    const c=at(P,x,y);
    if(dropTeam&&dE00(c,dropTeam)<12)continue;    // §H A2: mask the team-coloured coat panel
    r+=c[0];g+=c[1];b+=c[2];n++;
  }
  return n?[r/n,g/n,b/n]:null;
}
function rowMean(P,mk,bb,y0,y1,dropTeam,beard,win){
  const X0=win?Math.max(bb.x0,win[0]):bb.x0, X1=win?Math.min(bb.x1,win[1]):bb.x1;
  let r=0,g=0,b=0,n=0;
  for(let y=Math.max(0,y0);y<Math.min(P.h,y1);y++)for(let x=X0;x<=X1;x++){
    if(!mk.m[y*P.w+x])continue;
    if(beard&&beard[y*P.w+x])continue;
    const c=at(P,x,y);
    if(dropTeam&&dE00(c,dropTeam)<12)continue;
    r+=c[0];g+=c[1];b+=c[2];n++;
  }
  return n?[r/n,g/n,b/n]:null;
}
// ---- the head mask: chin line to the top of the hat, normalised to one height ----
// The chin is handed in from the page (world y → screen y) rather than guessed from the profile:
// a beard and a neck guard both bulge below the jaw and every "find the narrowest row" heuristic
// I tried put the line somewhere different on each of the six.
function headMask(P,mk,bb,chinY,N,win){
  const y0=bb.y0, y1=Math.min(chinY,bb.y1);
  // COLUMNS AS WELL AS ROWS. A shouldered club, a drawn blade and a shield rim all reach above the
  // chin line on this rig, and left in they widen the "hat" and drop blobs into a mask that is
  // supposed to be a helmet. The window is ±0.95 world off centre — wider than the shako's brim,
  // the Gallic crest and the hide dome, and inboard of every prop.
  const W0=win?Math.max(bb.x0,win[0]):bb.x0, W1=win?Math.min(bb.x1,win[1]):bb.x1;
  // >>> THE HEAD IS THE COMPONENT THE HEAD IS IN, AND A SWORD BLADE IS NOT IT. <<<
  // The ±0.95 window was supposed to be "inboard of every prop" and it is not: the vanguard's
  // greatsword, the broadsword's blade and the musketeer's barrel all stand vertically INSIDE it,
  // 0.6-0.9 off centre, and each one lands in the head mask as a detached bar. That is not a
  // rounding error — the bar sets x1, so it sets the mask's WIDTH, so it sets the h/w ratio the
  // gate scores AND the normalisation every IoU is computed after. Measured: the Medieval helm is
  // 1.157 world across on a 2.09-tall head region (h/w 1.81) and the tool reported 1.41, because
  // the blade added 0.36 of empty air to the box. §H A1b step 1 says "crop each figure's HEAD
  // region"; a flood fill from the skull keeps exactly that and drops anything not touching it.
  const seen=new Uint8Array((W1-W0+1)*(y1-y0+1)); const IW=W1-W0+1;
  const stack=[]; const cx0=Math.round((W0+W1)/2);
  for(let y=y0;y<=y1;y++)for(let dx=-2;dx<=2;dx++){
    const x=cx0+dx; if(x<W0||x>W1)continue;
    if(mk.m[y*P.w+x]&&!seen[(y-y0)*IW+(x-W0)]){seen[(y-y0)*IW+(x-W0)]=1;stack.push(x,y);}
  }
  while(stack.length){
    const y=stack.pop(), x=stack.pop();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy;
      if(nx<W0||nx>W1||ny<y0||ny>y1)continue;
      const i=(ny-y0)*IW+(nx-W0);
      if(seen[i]||!mk.m[ny*P.w+nx])continue;
      seen[i]=1; stack.push(nx,ny);
    }
  }
  const on=(x,y)=>(x>=W0&&x<=W1&&y>=y0&&y<=y1&&seen[(y-y0)*IW+(x-W0)]);
  let x0=1e9,x1=-1;
  for(let y=y0;y<=y1;y++)for(let x=W0;x<=W1;x++)if(on(x,y)){if(x<x0)x0=x;if(x>x1)x1=x;}
  const hw=x1-x0+1, hh=y1-y0+1;
  // HEIGHT ONLY. §H A1b step 3: "Normalise each mask to the same bounding-box HEIGHT (the hats
  // differ in size, and that is a legitimate difference, not the one being measured here)."
  // The first cut of this resampled into a square N×N, which normalises WIDTH as well — and width
  // over height is precisely what separates a low wide dome from a tall narrow barrel. Squared,
  // the Stone cap and the Medieval great helm scored IoU 0.811 while measuring 172×135 and
  // 140×163 respectively, i.e. the test threw away the one number that told them apart. Scaled by
  // a single factor and centred in a common canvas, aspect survives into the comparison.
  const sc=N/hh, nw=Math.max(1,Math.round(hw*sc)), M=N*3;
  const out=new Uint8Array(M*N), off=Math.floor((M-nw)/2);
  for(let j=0;j<N;j++)for(let i=0;i<nw;i++){
    const sx=x0+Math.min(hw-1,Math.floor((i+0.5)/sc)), sy=y0+Math.min(hh-1,Math.floor((j+0.5)/sc));
    if(on(sx,sy))out[j*M+off+i]=1;
  }
  return {mask:out,w:hw,h:hh,ratio:hh/hw,N:N,M:M};
}
const _or=(a,b)=>{const o=new Uint8Array(a.length);for(let i=0;i<a.length;i++)o[i]=a[i]|b[i];return o;};
const iou=(a,b)=>{let I=0,U=0;for(let i=0;i<a.length;i++){if(a[i]&&b[i])I++;if(a[i]||b[i])U++;}return U?I/U:1;};

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}}).listen(8157);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:W,height:H}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8157/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:30000});

  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;
    for(const u of units)u.root.visible=false;
    // THE STAGE: hide the world outright rather than shooting past it. Anything left in frame is
    // a second surface the mask has to reject, and terrain in particular grades to values a dark
    // helmet sits inside.
    window.__hidden=[];
    for(const c of scene.children){
      if(c.isLight)continue;
      if(c.visible){window.__hidden.push(c);c.visible=false;}
    }
    window.__diag=scene.children.length+"/"+window.__hidden.length;
    scene.fog=null;
    window.__bg=scene.background; scene.background=new THREE.Color(0xB020C0);  // chroma key
    window.__draw=()=>{
      renderer.shadowMap.needsUpdate=true;
      if(typeof composer==="undefined"||!composer)
        throw new Error("no composer — every number this tool prints would be void (§G.6)");
      for(let i=0;i<3;i++)composer.render();
    };
    // A unit's root is parented into the scene by makeUnit; keep it visible past the sweep above.
    window.__stage=(u,ageForKing)=>{
      if(window.__shot){window.__shot.root.visible=false;window.__shot.alive=false;}
      // hide every OTHER root the scene has grown since the sweep (makeUnit adds one per call)
      for(const c of scene.children)if(!c.isLight)c.visible=false;
      window.__shot=u; u.root.visible=true;
      for(const p of u.root.children)p.visible=false;
      u.body.visible=true;                    // body only: no selection ring, no health bar
      u.root.position.set(0,0,140);
      u.facing=0; u.body.rotation.set(0,0,0);
      // HEAD-ON. §H A1b wants the hat's own outline, and a three-quarter turn foreshortens a neck
      // guard into a dome and a transverse crest into a bump.
      const bb=new THREE.Box3().setFromObject(u.body);
      const cy=(bb.min.y+bb.max.y)/2, span=Math.max(bb.max.y-bb.min.y,2.5);
      camera.position.set(0,140+0.0,140+span*1.42);
      camera.position.set(0,cy,140+span*1.55);
      camera.lookAt(0,cy,140);
      camera.updateProjectionMatrix();
      window.__draw();
      // the chin line, in SCREEN pixels: R.head is a group whose origin is the chin pole
      const toY=wy=>{const v=new THREE.Vector3(0,wy,140);v.project(camera);
        return Math.round((1-v.y)*0.5*window.innerHeight);};
      // THE TORSO BAND IS ROWS **AND** COLUMNS. §H A2 names the rows and says nothing about the
      // columns, and taken literally the crop is the whole bounding box — which on a broadsword
      // includes a shield on one side and a drawn blade on the other, and on a clubman a war club
      // that is a sixth of the crop in raw wood. Those are class props, not the age's dominant
      // surface, and they differ per class inside an age. The window is the TORSO's own width:
      // ±0.72 world, which is the 0.52 barrel plus the 0.71 shoulder line and nothing outboard.
      const cx=(wx=>{const v=new THREE.Vector3(wx,2,140);v.project(camera);
        return (v.x*0.5+0.5)*window.innerWidth;});
      const xMid=Math.round(cx(0)), xHalf=Math.round(cx(0.72)-cx(0));
      // headWidth for §H A7, taken off the SKULL and not off the widest row under the chin — the
      // beard is 1.19 across against a 1.103 head (§6.3c) and measuring the beard makes every
      // crown look 8% narrower than it is.
      const headW=Math.round(2*(cx(NC_HEADW/2)-cx(0)));
      let chin=null,belt=null;
      if(u.rig&&u.rig.head){
        const v=new THREE.Vector3(); u.rig.head.getWorldPosition(v);
        chin=toY(v.y+0.06);
        // THE TORSO, MEASURED WHERE IT ACTUALLY IS. §H A2 names "28-58% of the figure's height",
        // and on THIS rig that band is mostly FACE: §6.1a makes hat+head 0.46-0.54 H, so 28% down
        // from the crown is still brow height and 58% is the belt. The spec band is reported
        // unchanged below because it is the written gate — but a second band from the chin to the
        // belt is reported beside it, because that is the surface §A.1 calls the DOMINANT and
        // measuring the face six times would tell nobody anything.
        belt=toY((u.rigBaseY||0.95)+0.30);
      }
      let m=0; const s=new Set();
      u.body.traverse(o=>{if(o.isMesh){m++;s.add(o.material);}});
      return {chin,belt,xMid,xHalf,headW,mesh:m,mat:s.size,top:bb.max.y,bot:bb.min.y,diag:window.__diag};
    };
  });

  // THE BEARD HAS TO COME OUT OF §H A2, AND HERE IS THE ARGUMENT FOR IT IN FULL.
  // A2 crops 28-58% of the figure and drops every pixel within ΔE00 12 of the team colour, because
  // the coat is team-driven and therefore cannot carry the age. The carved beard is the same case
  // twice over: §2.6a makes it a pure function of u.id and NOT of the age, and §6.3c makes it
  // 1.19 wide against a 1.04 torso — so on a §6.1a figure it covers the entire chest in the exact
  // band the gate measures. Left in, every age's "dominant" is chestnut #6B4A2E and the test can
  // only ever report the beard back to you. It is masked the way A2 already masks the coat, and
  // the mask is MEASURED rather than colour-matched: BEARD_TONES and MOUSTACHE_TONES are plain
  // mutable arrays, so the harness flags them green, rebuilds the unit (the merge bakes
  // material.color into the vertex-colour attribute, so the geometry is bit-identical), shoots,
  // and keeps the green pixels. calib.js established this trick; nothing in js/ knows it exists.
  const FLAG=[0x00,0xFF,0x30];
  const shoot=async(cls,file,age)=>{
    const info=await page.evaluate(([c,a,flag])=>{
      if(a!==null&&a!==undefined){teamAge[0]=a;}
      if(!window.__bt){window.__bt=BEARD_TONES.slice();window.__mt=MOUSTACHE_TONES.slice();
        window.__tc=TEAMCOL.slice();}
      for(let i=0;i<BEARD_TONES.length;i++){BEARD_TONES[i]=flag;MOUSTACHE_TONES[i]=flag;}
      TEAMCOL[0]=0x00E0FF;      // cyan: the SHADED side of a team coat is 20+ ΔE00 off the pure
                                // hex and a colour threshold keeps it, which is how a navy shadow
                                // ends up counted as the age's dominant surface.
      const uf=makeUnit(0,c,0,140,{name:"Flag",bot:null,isKing:c==="king"});
      if(!uf)return null;
      return window.__stage(uf);
    },[cls,age===undefined?null:age,0x00FF30]);
    if(!info)return null;
    await page.screenshot({path:file.replace(/\.png$/,"_flag.png")});
    const info2=await page.evaluate(([c,a,team])=>{
      for(let i=0;i<BEARD_TONES.length;i++){BEARD_TONES[i]=window.__bt[i];MOUSTACHE_TONES[i]=window.__mt[i];}
      // >>> §H A1 AND §H A2 ARE TWO-TEAM GATES AND WERE ONLY EVER RUN AT TEAM 0. <<<
      // The v131.3 build passed A1 at 12.7 on Blue and failed it at 8.2 on Red, because three of
      // the six crowns carried a team band and a saturated red one moves a crown crop 14 ΔE00
      // sideways where a saturated blue one moves it 4. `TEAM=1 node tools/agecheck.js line`
      // renders the identical figure with TEAMCOL[0] set to the red hex — the unit is still team
      // 0, so nothing about its construction changes except the colour the gate is blind to.
      TEAMCOL[0]=team?window.__tc[1]:window.__tc[0];
      if(a!==null&&a!==undefined){teamAge[0]=a;}
      const u=makeUnit(0,c,0,140,{name:"Gate",bot:null,isKing:c==="king"});
      if(!u)return null;
      return window.__stage(u);
    },[cls,age===undefined?null:age,+(process.env.TEAM||0)]);
    await page.screenshot({path:file});
    return info2;
  };
  // pixels the flag render painted green — the beard and moustache, and nothing else
  function flagMasks(file){
    const P=pixels(file.replace(/\.png$/,"_flag.png"));
    const beard=new Uint8Array(P.w*P.h), team=new Uint8Array(P.w*P.h);
    for(let i=0;i<P.w*P.h;i++){
      const r=P.d[i*3],g=P.d[i*3+1],b=P.d[i*3+2];
      if(g>100&&g>r+50&&g>b+40)beard[i]=1;          // green flag: beard + moustache
      else if(g>90&&b>90&&g>r+40&&b>r+40)team[i]=1; // cyan flag: every team-coloured surface
    }
    return {beard,team};
  }

  const N=48;
  if(MODE==="line"||MODE==="king"||MODE==="vill"){
    // king and villager are ONE class id driven by teamAge, so the six-age ladder for them is six
    // shots of the same id with the team aged between them — not six different classes.
    const AGED=MODE==="king"?"king":MODE==="vill"?"villager":null;
    const classes=AGED?[AGED,AGED,AGED,AGED,AGED,AGED]
      :(process.argv[3]||"clubman,shortsword,broadsword,legionaire,vanguard,musketeer").split(",");
    const dir=path.join(OUT,MODE); fs.mkdirSync(dir,{recursive:true});
    const rows=[];
    for(let i=0;i<classes.length;i++){
      const f=path.join(dir,(AGED?AGED+i:classes[i])+".png");
      const info=await shoot(classes[i],f,AGED?i:undefined);
      if(!info){console.log("skip "+classes[i]);continue;}
      const P=pixels(f), mk=maskOf(P), bb=bboxOf(mk,P);
      const hWin=[info.xMid-Math.round(info.xHalf*0.95/0.72),info.xMid+Math.round(info.xHalf*0.95/0.72)];
      const hm=headMask(P,mk,bb,info.chin,N,hWin);
      const fm=flagMasks(f); const bm=fm.beard;
      let bn=0,tn=0; for(let k=0;k<bm.length;k++){bn+=bm[k];tn+=fm.team[k];}
      rows.push({cls:classes[i],age:i,file:f,P,mk,bb,hm,info,bm,bn,tm:fm.team,tn});
    }
    const TEAM=[0x2E,0x5F,0xD8];
    console.log("\n>>> TEAM "+(+(process.env.TEAM||0))+" — §H A1/A2 are two-team gates. Run BOTH and score the worse. <<<");
    console.log("\n=== §H A1 — CROWN COLOUR (top 28% of the figure box), 15 pairs, FAIL < 12 ===");
    const crown=rows.map(r=>bandMean(r.P,r.mk,r.bb,0,0.28));
    for(let i=0;i<rows.length;i++)
      console.log(("  "+i+" "+AGENAME[i]).padEnd(16)+hex(crown[i])+"  V="+luma(crown[i]).toFixed(3));
    let worst=1e9,worstP="";
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const d=dE00(crown[i],crown[j]);
      if(d<worst){worst=d;worstP=i+"/"+j;}
      console.log("   "+i+"-"+j+"  ΔE00 "+d.toFixed(1)+(d<12?"   *** FAIL":""));
    }
    console.log("  A1 worst pair "+worstP+" = "+worst.toFixed(1)+(worst>=12?"  PASS":"  FAIL"));

    console.log("\n=== §H A1b — CROWN SILHOUETTE (binary, colour removed), FAIL IoU > 0.70 ===");
    // …and the §6.1a share travels with the ratio, because they are traded against each other on
    // every one of these hats and a lane that reports one without the other is hiding the trade.
    // "Hat + head together are 0.46-0.54 of H… if the region above the shoulders is under 44% of
    // the silhouette, it is not a nutcracker."
    for(let i=0;i<rows.length;i++){
      const hh=rows[i].hm.h/rows[i].bb.h;
      console.log(("  "+i+" "+AGENAME[i]).padEnd(16)+"hat "+rows[i].hm.w+"x"+rows[i].hm.h+
        "px  h/w="+rows[i].hm.ratio.toFixed(2)+"   hat+head "+hh.toFixed(3)+" H"+
        (hh<0.44?"  *** §6.1a FAIL":hh>0.54?"  *** §6.1a OVER":""));
    }
    let wIoU=-1,wIoUP="",nIoUOver=0,nIoUPairs=0;
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const v=iou(rows[i].hm.mask,rows[j].hm.mask);
      if(v>wIoU){wIoU=v;wIoUP=i+"/"+j;}
      nIoUPairs++; if(v>0.70)nIoUOver++;
      console.log("   "+i+"-"+j+"  IoU "+v.toFixed(3)+(v>0.70?"   *** FAIL":""));
    }
    console.log("  A1b worst pair "+wIoUP+" = "+wIoU.toFixed(3)+
      "   ("+nIoUOver+" of "+nIoUPairs+" pairs over 0.70)"+(wIoU<=0.70?"  PASS":"  FAIL"));
    let ratioOK=true;
    for(let i=0;i+1<rows.length;i++){
      const d=Math.abs(rows[i].hm.ratio-rows[i+1].hm.ratio);
      if(d<0.15)ratioOK=false;
      console.log("   ratio "+i+"-"+(i+1)+"  Δ="+d.toFixed(2)+(d<0.15?"   *** FAIL":""));
    }
    console.log("  A1b adjacent h/w spread "+(ratioOK?"PASS":"FAIL"));

    console.log("\n=== §H A2 — DOMINANT (torso 28-58%, team masked), FAIL ΔE00 < 12 or adj |ΔV| < 0.25 ===");
    const dom=rows.map(r=>bandMean(r.P,r.mk,r.bb,0.28,0.58,null,_or(r.bm,r.tm),
      [r.info.xMid-r.info.xHalf,r.info.xMid+r.info.xHalf]));
    for(let i=0;i<rows.length;i++)
      console.log(("  "+i+" "+AGENAME[i]).padEnd(16)+hex(dom[i])+"  V="+luma(dom[i]).toFixed(3));
    let w2=1e9,w2P="";
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const d=dE00(dom[i],dom[j]);
      if(d<w2){w2=d;w2P=i+"/"+j;}
      console.log("   "+i+"-"+j+"  ΔE00 "+d.toFixed(1)+(d<12?"   *** FAIL":""));
    }
    console.log("  A2 worst pair "+w2P+" = "+w2.toFixed(1)+(w2>=12?"  PASS":"  FAIL"));
    let vOK=true;
    for(let i=0;i+1<rows.length;i++){
      const d=Math.abs(luma(dom[i])-luma(dom[i+1]));
      if(d<0.25)vOK=false;
      console.log("   ΔV "+i+"-"+(i+1)+"  "+d.toFixed(3)+(d<0.25?"   *** FAIL":""));
    }
    console.log("  A2 adjacent ΔV "+(vOK?"PASS":"FAIL"));

    console.log("\n=== §H A2b — DOMINANT over the TRUE torso (chin line to belt), team masked ===");
    const dm2=rows.map(r=>rowMean(r.P,r.mk,r.bb,r.info.chin,r.info.belt,null,_or(r.bm,r.tm),
      [r.info.xMid-r.info.xHalf,r.info.xMid+r.info.xHalf]));
    for(let i=0;i<rows.length;i++)
      console.log(("  "+i+" "+AGENAME[i]).padEnd(16)+hex(dm2[i])+"  V="+luma(dm2[i]).toFixed(3));
    let w3=1e9,w3P="";
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const d=dE00(dm2[i],dm2[j]);
      if(d<w3){w3=d;w3P=i+"/"+j;}
      if(d<12)console.log("   "+i+"-"+j+"  ΔE00 "+d.toFixed(1)+"   *** FAIL");
    }
    console.log("  A2b worst pair "+w3P+" = "+w3.toFixed(1)+(w3>=12?"  PASS":"  FAIL"));
    let v2=true,line="   ΔV ";
    for(let i=0;i+1<rows.length;i++){
      const d=Math.abs(luma(dm2[i])-luma(dm2[i+1])); if(d<0.25)v2=false;
      line+=i+"-"+(i+1)+" "+d.toFixed(3)+(d<0.25?"*FAIL  ":"  ");
    }
    console.log(line); console.log("  A2b adjacent ΔV "+(v2?"PASS":"FAIL"));

    if(MODE==="king"){
      console.log("\n=== §H A7 — THE KING GATE ===");
      const GOLD=[0xCF,0xB5,0x3B];
      let a7gold=true,a7legs=true;
      for(const r of rows){
        // gold mass in the top 0.20 H
        const y1=Math.round(r.bb.y0+r.bb.h*0.20);
        let rows2=[],goldN=0;
        for(let y=r.bb.y0;y<y1;y++){
          let x0=1e9,x1=-1,run=0;
          for(let x=r.bb.x0;x<=r.bb.x1;x++){
            if(!r.mk.m[y*r.P.w+x])continue;
            // ΔE00 < 22, not 16. §H A7 asks for a "#CFB53B-family region" and the family is what
            // the ramp does to it: the shaded facets of a gold band come back 18-20 off the pure
            // hex and a tight threshold reports a crown as having a hole through the middle.
            if(dE00(at(r.P,x,y),GOLD)<22){if(x<x0)x0=x;if(x>x1)x1=x;run++;goldN++;}
          }
          rows2.push(run?{y,w:x1-x0+1}:null);
        }
        const gRows=rows2.filter(Boolean);
        const gH=gRows.length, gW=gRows.length?Math.max(...gRows.map(o=>o.w)):0;
        // head width: the widest masked row in the band just under the chin
        const hw=r.info.headW;
        // the leg split: count separate runs on the bottom 10% of the figure
        const yS=Math.round(r.bb.y0+r.bb.h*0.93);
        let runs=0,inRun=false;
        for(let x=r.bb.x0;x<=r.bb.x1;x++){const on=!!r.mk.m[yS*r.P.w+x];if(on&&!inRun)runs++;inRun=on;}
        const okH=gH/r.bb.h>=0.10, okW=gW/(hw||1)>=0.90;
        if(!okH||!okW)a7gold=false;
        if(runs>1)a7legs=false;
        console.log("  age "+r.age+"  gold "+gH+" rows = "+(gH/r.bb.h).toFixed(3)+
          " H "+(okH?"PASS":"FAIL")+"   widest "+gW+"px / headW "+hw+"px = "+(gW/(hw||1)).toFixed(2)+
          "x "+(okW?"PASS":"FAIL")+"   hem runs "+runs+(runs>1?"  *** SPLIT LEGS FAIL":"  PASS (one trapezoid)"));
      }
      // ==========================================================================================
      // §H A7 HAS THREE BULLETS AND THIS BLOCK USED TO PRINT TWO OF THEM.
      // The third — "the six crowns are not mutually distinguishable at 40px by form alone as pure
      // black silhouettes" — is the CROWN-FORM clause, and it is not un-measured: it is the same
      // quantity §H A1b computes on the head masks, sixty lines up, and in `king` mode those masks
      // ARE the six crowns. It was computed, printed under the A1b heading, and then dropped on the
      // floor before the A7 verdict, so a reader scanning for A7 saw three PASS-shaped lines per
      // age and no verdict at all while a failing clause sat two screens above with someone else's
      // name on it. Measured at the time of writing: worst pair IoU 0.806 with 4 of 15 pairs over
      // the 0.70 ceiling — A7 FAILS on form and has been failing quietly.
      // A7's colour result is NOT a failure and must not be read as one: §C makes gold the age's
      // CONSTANT and gives the FORM the job of carrying the age, so twelve of fifteen crown pairs
      // under §H A1's ΔE00 floor is the specification working, not breaking. That is why the line
      // below prints the form clause as the gate and the colour spread as context beside it.
      console.log("  A7 crown FORM (= A1b on the six crowns, §H A7 bullet 3)  worst pair "+wIoUP+
        " IoU "+wIoU.toFixed(3)+"   "+nIoUOver+" of "+nIoUPairs+" pairs over 0.70   "+
        (wIoU<=0.70?"PASS":"*** FAIL — the six crowns are one hat"));
      console.log("  A7 VERDICT  gold-region "+(a7gold?"PASS":"FAIL")+" · robe-hem "+
        (a7legs?"PASS":"FAIL")+" · crown-form "+(wIoU<=0.70?"PASS":"FAIL")+"   ==>  "+
        ((a7gold&&a7legs&&wIoU<=0.70)?"A7 PASS":"*** A7 FAILS"));
    }
    // the strip, for LOOKING at — which is the only test that caught the six shakos
    const strip=path.join(dir,"strip.png");
    cp.execSync("montage -tile "+rows.length+"x1 -geometry "+W+"x"+H+"+3+3 -background '#202024' "+
      rows.map(r=>JSON.stringify(r.file)).join(" ")+" "+JSON.stringify(strip));
    // …and the same strip at 40px tall with the colour taken out, which is the gameplay distance
    cp.execSync("montage -tile "+rows.length+"x1 -geometry x40+2+2 -background '#202024' -colorspace Gray "+
      rows.map(r=>JSON.stringify(r.file)).join(" ")+" "+JSON.stringify(path.join(dir,"strip40.png")));
    // and the binary head masks, side by side: this is literally what A1b compares
    const mfiles=[];
    for(const r of rows){
      const f=path.join(dir,"mask_"+r.age+".ppm");
      const M=r.hm.M, L=M*N, buf=Buffer.alloc(L*3);
      for(let i=0;i<L;i++){const v=r.hm.mask[i]?0:255;buf[i*3]=v;buf[i*3+1]=v;buf[i*3+2]=v;}
      fs.writeFileSync(f,Buffer.concat([Buffer.from("P6\n"+M+" "+N+"\n255\n"),buf]));
      mfiles.push(f);
    }
    cp.execSync("montage -tile "+rows.length+"x1 -geometry 200x140+3+3 -background '#4040A0' "+
      mfiles.map(f=>JSON.stringify(f)).join(" ")+" "+JSON.stringify(path.join(dir,"masks.png")));
    for(const f of mfiles)fs.unlinkSync(f);
    // ==========================================================================================
    // §6.3c — THE BEARD'S ACCEPTANCE TEST, AND IT IS ABOUT AN EDGE, NOT A SHAPE.
    // "At 40px greyscale it must read as a TRIANGLE." Three rounds have now built a correct lathe
    // profile — bottom/top width 0.34-0.47, tip 12-20% of max, no flat cut — and failed the test
    // anyway, because an outline drawn against a surface of its OWN VALUE is not an outline. The
    // clearest proof was Classical: a silvered-ash beard at V 0.442 in front of polished-steel
    // armour at 0.446, four THOUSANDTHS apart, authored blind against the hex table.
    // So the pair is measured, not the beard: the beard's mean value against the mean value of the
    // figure pixels in a 3px ring around it. §6.2's own adjacent-band floor is 0.25 and that is
    // what is required here of every age.
    console.log("\n=== §6.3c — BEARD vs THE SURFACE BEHIND IT (3px ring, figure px), FAIL |ΔV| < 0.25 ===");
    for(const r of rows){
      const W2=r.P.w, H2=r.P.h;
      const ring=new Uint8Array(W2*H2);
      for(let y=1;y<H2-1;y++)for(let x=1;x<W2-1;x++){
        if(r.bm[y*W2+x]||!r.mk.m[y*W2+x])continue;
        let near=false;
        for(let dy=-3;dy<=3&&!near;dy++)for(let dx=-3;dx<=3;dx++){
          const yy=y+dy,xx=x+dx; if(yy<0||yy>=H2||xx<0||xx>=W2)continue;
          if(r.bm[yy*W2+xx]){near=true;break;}
        }
        if(near)ring[y*W2+x]=1;
      }
      let bv=0,bn=0,rv=0,rn=0;
      for(let y=0;y<H2;y++)for(let x=0;x<W2;x++){
        if(r.bm[y*W2+x]&&r.mk.m[y*W2+x]){bv+=luma(at(r.P,x,y));bn++;}
        else if(ring[y*W2+x]){rv+=luma(at(r.P,x,y));rn++;}
      }
      const b=bn?bv/bn:0, g=rn?rv/rn:0, d=Math.abs(b-g);
      console.log(("  "+r.age+" "+AGENAME[r.age]).padEnd(16)+"beard V "+b.toFixed(3)+
        "   behind V "+g.toFixed(3)+"   |ΔV| "+d.toFixed(3)+(d<0.25?"   *** FAIL":"  PASS"));
    }
    console.log("\n=== §2.5 — TEAM COLOUR AS A FRACTION OF THE FIGURE (want 20-30%) ===");
    for(const r of rows){
      let all=0;
      for(let y=r.bb.y0;y<=r.bb.y1;y++)for(let x=r.bb.x0;x<=r.bb.x1;x++)if(r.mk.m[y*r.P.w+x])all++;
      console.log(("  "+r.age+" "+AGENAME[r.age]).padEnd(16)+(100*r.tn/all).toFixed(1)+"%   beard "+
        (100*r.bn/all).toFixed(1)+"% of the figure");
    }
    console.log("\n  meshes/materials: "+rows.map(r=>r.cls+" "+r.info.mesh+"/"+r.info.mat).join("  "));
    console.log("  wrote "+strip+" , masks.png , strip40.png");
  }else if(MODE==="census"){
    // ==========================================================================================
    // §H A8 (CLIPPING) + §H A10 (MESHES) OVER **EVERY CLASS**, AS ONE PASS/FAIL LINE.
    // Both of these have now been missed twice in the same way: the melee line, the villagers and
    // the kings were swept and passed, and the carts — which are on the map in numbers — were not,
    // because the census was a thing a lane REMEMBERED to do rather than a thing a tool ran. The
    // oxcart shipped 2.82% of its pixels pegged at 255 with two contiguous 700px+ regions at
    // (255,255,225), and 39 meshes against A10's ceiling of 12, and no lane reported either.
    // This builds every id in CLS, shoots it through the composer against the chroma key, and
    // prints clipped% / the largest >216-in-all-three region / meshes / materials per class.
    const dir=path.join(OUT,"census"); fs.mkdirSync(dir,{recursive:true});
    const ids=await page.evaluate(()=>Object.keys(CLS));
    let worstClip=0,worstClipC="",worstHot=0,worstHotC="",worstMesh=0,worstMeshC="";
    for(const c of ids){
      const f=path.join(dir,c+".png");
      let info=null;
      try{ info=await shoot(c,f); }catch(e){ console.log(("  "+c).padEnd(18)+"BUILD ERROR "+e.message); continue; }
      if(!info){console.log(("  "+c).padEnd(18)+"skip"); continue;}
      const P=pixels(f), mk=maskOf(P);
      let n=0,clip=0; const hot=new Uint8Array(P.w*P.h);
      for(let y=0;y<P.h;y++)for(let x=0;x<P.w;x++){
        if(!mk.m[y*P.w+x])continue; n++;
        const cc=at(P,x,y);
        if(cc[0]>=255||cc[1]>=255||cc[2]>=255)clip++;
        if(cc[0]>216&&cc[1]>216&&cc[2]>216)hot[y*P.w+x]=1;
      }
      // largest contiguous hot region (4-connected)
      let big=0; const vis=new Uint8Array(P.w*P.h);
      for(let y=0;y<P.h;y++)for(let x=0;x<P.w;x++){
        if(!hot[y*P.w+x]||vis[y*P.w+x])continue;
        let sz=0; const st=[x,y]; vis[y*P.w+x]=1;
        while(st.length){const yy=st.pop(),xx=st.pop(); sz++;
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const nx=xx+dx,ny=yy+dy;
            if(nx<0||ny<0||nx>=P.w||ny>=P.h)continue;
            const i2=ny*P.w+nx; if(vis[i2]||!hot[i2])continue; vis[i2]=1; st.push(nx,ny);}}
        if(sz>big)big=sz;
      }
      const pc=n?100*clip/n:0;
      if(pc>worstClip){worstClip=pc;worstClipC=c;}
      if(big>worstHot){worstHot=big;worstHotC=c;}
      if(info.mesh>worstMesh){worstMesh=info.mesh;worstMeshC=c;}
      console.log(("  "+c).padEnd(18)+"clip "+pc.toFixed(2).padStart(5)+"%"+(pc>2?" *FAIL":"      ")+
        "   hot "+String(big).padStart(5)+"px"+(big>200?" *FAIL":"      ")+
        "   mesh "+String(info.mesh).padStart(3)+"/"+info.mat+(info.mesh>12?" *FAIL":""));
    }
    console.log("\n  §H A8  worst clipping   "+worstClipC+" "+worstClip.toFixed(2)+"%  (ceiling 2%)   "+
      (worstClip<=2?"PASS":"FAIL"));
    console.log("  §H A8  largest hot px  "+worstHotC+" "+worstHot+"px  (ceiling 200px)   "+
      (worstHot<=200?"PASS":"FAIL"));
    console.log("  §H A10 worst mesh count "+worstMeshC+" "+worstMesh+"  (ceiling 12)   "+
      (worstMesh<=12?"PASS":"FAIL"));
  }else if(MODE==="shot"){
    const cls=process.argv[3]||"clubman", age=process.argv[4]?+process.argv[4]:undefined;
    const dir=path.join(OUT,"shot"); fs.mkdirSync(dir,{recursive:true});
    const f=path.join(dir,cls+(age===undefined?"":"_"+age)+".png");
    const info=await shoot(cls,f,age);
    console.log(cls+"  "+JSON.stringify(info)+"  -> "+f);
  }else if(MODE==="det"){
    // §H A9 — THE DETERMINISM SWEEP, and it has to run on the ISOLATED figure. unitshot keeps the
    // terrain and the sky in frame and world gen reseeds per process, so two unitshot runs differ
    // on the background whatever the unit does — which makes a byte diff of the whole frame useless
    // as a desync detector. Here the world is hidden and the background is a flat key, so ANY
    // difference between two processes is the unit, i.e. a Math.random() that reached appearance.
    const dir=path.join(OUT,process.argv[4]||"det"); fs.mkdirSync(dir,{recursive:true});
    for(const c of (process.argv[3]||"clubman,broadsword,king,viking").split(","))
      await shoot(c,path.join(dir,c+".png"));
    console.log("wrote "+dir);
  }
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
