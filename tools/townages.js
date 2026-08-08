#!/usr/bin/env node
/* REGICIDE — tools/townages.js — THE SIX AGES OF A TOWN, SIDE BY SIDE.
 * -------------------------------------------------------------------
 *   node tools/townages.js [outdir]
 *
 * AGES §F's whole claim is AoE's: "a building must be identifiable by roof shape and colour
 * alone, at distance." That claim is only checkable against SIX TOWNS SEEN TOGETHER, and there
 * was no tool that produced them — vista.js photographs whatever age the sim happens to be in.
 * So: one synthetic town on a fixed plan, rebuilt once per age with exactly the ids that age has
 * unlocked (§F.7's 4/8/12/17/20/20), photographed from ONE vantage, and montaged.
 *
 * It prints the numbers §H/A5 and §H/A6 are written in:
 *   · A5 auto — the mean colour of each town's ROOF BAND and the 15 pairwise CIEDE2000 (FAIL <12)
 *   · A6      — per (age, building) the roof face and the wall face, eyedroppered off the render
 *               by projecting each body's own bounding box, and |ΔV| between them (FAIL <0.25)
 *   · §G.4    — atlas cells and _skinCache size, so the ~130 budget travels with the picture
 *   · §G.4    — a hash of every resource node. World gen runs under one seeded stream and the
 *               netcode indexes `nodes` POSITIONALLY (10-net.js:1614); a new texturedMat pair
 *               minted inside that window shifts every index and silently breaks PROTO 26.
 *
 * TRAP THIS TOOL EXISTS TO AVOID (§G.6): it renders through composer.render(). A bare
 * renderer.render() skips UnrealBloomPass (high pass 0.86) and the grade, and every colour taken
 * off it is void — that is how a beard measured at (246,242,231) shipped at (255,255,247).
 */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||path.join(ROOT,"_towns");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
const AGE=["0-stone","1-bronze","2-iron","3-classical","4-medieval","5-enlightenment"];
const W=1100,H=620;

// ---- raw pixels via ImageMagick — the same door tools/calib.js uses, so no new dependency ----
function pixels(file,w,h){
  const raw=cp.execSync(`convert ${JSON.stringify(file)} -depth 8 -colorspace sRGB rgb:-`,{maxBuffer:1<<28});
  return {w,h,d:raw};
}
const at=(P,x,y)=>{const i=(y*P.w+x)*3;return [P.d[i],P.d[i+1],P.d[i+2]];};
const V=c=>(0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255;   // AGES §A.0: Rec.709 on ENCODED bytes
const hex=c=>"#"+c.map(v=>Math.round(v).toString(16).padStart(2,"0")).join("").toUpperCase();
function _lab(c){
  const f=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  const r=f(c[0]),g=f(c[1]),b=f(c[2]);
  let X=(r*0.4124+g*0.3576+b*0.1805)/0.95047, Y=r*0.2126+g*0.7152+b*0.0722,
      Z=(r*0.0193+g*0.1192+b*0.9505)/1.08883;
  const k=t=>t>0.008856?Math.cbrt(t):(7.787*t+16/116);
  X=k(X);Y=k(Y);Z=k(Z);
  return [116*Y-16,500*(X-Y),200*(Y-Z)];
}
function dE00(c1,c2){
  const [L1,a1,b1]=_lab(c1),[L2,a2,b2]=_lab(c2);
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2;
  const G=0.5*(1-Math.sqrt(Math.pow(Cb,7)/(Math.pow(Cb,7)+Math.pow(25,7))));
  const A1=(1+G)*a1,A2=(1+G)*a2, Cp1=Math.hypot(A1,b1),Cp2=Math.hypot(A2,b2);
  const hh=(x,y)=>{if(x===0&&y===0)return 0;let t=Math.atan2(y,x)*180/Math.PI;return t<0?t+360:t;};
  const h1=hh(A1,b1),h2=hh(A2,b2);
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
// IS THIS PIXEL ON A BUILDING? A roof-band crop is a rectangle, and a rectangle over a five-
// building Stone Age town is mostly the world BEHIND it. The first cut filtered grass and sky and
// reported the Stone town's roofs at #A5B39E — a pale grey-green, i.e. the fog-washed mountain
// range showing between two thatch cones — which is a number about the skybox, not the age.
// Three exclusions, and every roof hex in §F.0 survives all three:
//   grass      G clearly above both R and B
//   sky/fog    cool (B not below R) AND bright — which the Medieval slate (V 0.374) and the age-5
//              copper (V 0.547) are both comfortably under, and the two warm decks are not cool
//   shadow     near-black: the ink outlines and the eave shadow, which are not the roof's colour
function onRoof(c){
  if(c[1]>c[0]+16&&c[1]>c[2]+34)return false;
  const v=(0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255;
  if(c[2]>=c[0]-4&&v>0.60)return false;
  if(v<0.055)return false;
  return true;
}
// the median of a pixel sample, per channel: a mean lets one hot finial or one dark window drag a
// whole face, and a building face is exactly the kind of surface that has both on it.
function medianOf(list){
  if(!list.length)return null;
  const out=[];
  for(let ch=0;ch<3;ch++){const v=list.map(c=>c[ch]).sort((a,b)=>a-b);out.push(v[v.length>>1]);}
  return out;
}

// ONE FIXED TOWN PLAN, AND IT IS DELIBERATELY COMPACT. scene.fog runs 75->150 (01-engine.js:47),
// so a town wide enough to hold all twenty ids photographs its own far half through half a fog
// bank — the first cut of this tool spread over 150 units, sat the camera 125 back, and reported
// every roof in every age as the same pale blue-grey #BDD3D6, because that is what fog is. The
// A5 read is "can you name the age from the roofs", which is a GAMEPLAY-DISTANCE question, so the
// plan is the nine buildings a town actually shows you from a play camera and the vantage is
// vista.js's own town shot: ~62 units out, inside fog near. The other eleven ids are covered by
// the a6 sweep below, one at a time, at close range.
const PLAN=[
  ["towncenter",     0,   0],
  ["house",        -19, -15],["house",-20,7],
  ["barracks",      20, -14],
  ["storage_pit",   19,  -1],
  ["farm",           1,  27],
  ["watch_tower",  -12, -28],
  ["temple",       -32,   3],
  ["market",        30,  14],
  ["stable",       -34,  26]
];
// every id §F names, for the A6 sweep — one building, one close camera, one measurement
const ALLTYPES=["towncenter","house","storage_pit","barracks","farm","archery_range","stable",
  "watch_tower","siege_workshop","blacksmith","wood_wall","wood_gate","tower","temple","market",
  "stone_wall","stone_gate","castle","fort_wall","fort_gate"];
const CX=0, CZ=62;

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8131);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:W,height:H}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message+"\n"+(e.stack||"").split("\n").slice(0,4).join("\n")));
  page.on("console",m=>{const t=m.text();if(/error|cannot read|is not a function/i.test(t))console.log("[console] "+t.slice(0,200));});
  await page.goto("http://localhost:8131/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof buildings!=="undefined"&&typeof makeBuilding==="function",null,{timeout:45000});

  const BOOT=await page.evaluate(()=>{
    let h=2166136261>>>0,n=0;
    for(const nd of nodes){const s=nd.type+"|"+nd.x.toFixed(4)+"|"+nd.z.toFixed(4);
      for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}n++;}
    return {hash:h.toString(16),count:n,
            atlas:(typeof UATLAS!=="undefined"&&UATLAS.slots)?UATLAS.slots.size:-1,
            skins:(typeof _skinCache!=="undefined")?_skinCache.size:-1};
  });
  const BLD_AGE=await page.evaluate(()=>{const o={};for(const k in BLD)o[k]=BLD[k].age||0;return o;});
  console.log("NODE HASH : "+BOOT.count+" nodes · "+BOOT.hash+"    <-- §G.4: MUST NOT MOVE");
  console.log("AT BOOT   : atlas "+BOOT.atlas+" cells · _skinCache "+BOOT.skins);

  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;
    // CLEAR THE WOOD, AND DO IT AFTER applyLOD, NOT BEFORE. The plan sits on real map ground, so
    // a spruce stands between the camera and half the town — and a roofline test photographed
    // through a forest is a test of the forest. The trap: applyLOD (09-main.js:322) sets
    // `t.visible` on EVERY worldDeco item from its distance to the camera every time it runs, so
    // hiding the wood up here and then calling applyLOD down there puts every tree straight back.
    window.__clearWood=(cx,cz,r)=>{
      for(const n of nodes)if(n.mesh){const dx=n.x-cx,dz=n.z-cz;
        if(dx*dx+dz*dz<r*r)n.mesh.visible=false;}
      for(const d of worldDeco){const dx=d.position.x-cx,dz=d.position.z-cz;
        if(dx*dx+dz*dz<r*r)d.visible=false;}
      for(const u of units)u.root.visible=false;   // this is a BUILDING tool
    };
  });
  await page.waitForTimeout(400);

  const runs=[];
  for(let age=0;age<6;age++){
    const info=await page.evaluate(({PLAN,CX,CZ,age})=>{
      if(window.__town)for(const b of window.__town){
        b.alive=false;
        if(b.root&&b.root.parent)b.root.parent.remove(b.root);
        const i=buildings.indexOf(b); if(i>=0)buildings.splice(i,1);
      }
      window.__town=[];
      teamAge[0]=age;
      const made=[];
      for(const [type,dx,dz] of PLAN){
        if(((BLD[type]&&BLD[type].age)||0)>age)continue;
        // OWNER RULING §0a.1: stone_wall/stone_gate are FULLY REPLACED from age 4, so the town
        // plan stops PLACING them there the way the build menu does. What an already-placed one
        // renders as in ages 4-5 is 03-buildings' problem and is checked separately below.
        if((type==="stone_wall"||type==="stone_gate")&&age>=4)continue;
        made.push(makeBuilding(0,type,CX+dx,CZ+dz,true));
      }
      window.__town=made;
      let loose=0; for(const b of made)b.body.traverse(o=>{if(o.isMesh)loose++;});
      return {n:made.length,loose,
              welded:made.reduce((a,b)=>a+(b.body.userData.bMerged|0),0),
              atlas:UATLAS.slots.size,skins:_skinCache.size};
    },{PLAN,CX,CZ,age});

    // the camera, then the render, then the SCREEN BOXES of every body — taken in the same
    // evaluate as the render so nothing can move between the picture and the coordinates.
    const boxes=await page.evaluate(({CX,CZ})=>{
      camera.position.set(CX+25,38,CZ+56);
      camera.lookAt(CX-3,4,CZ+1);
      camera.updateProjectionMatrix();
      if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
      window.__clearWood(CX,CZ,130);
      if(typeof sun!=="undefined"&&sun&&sun.target){
        sun.target.position.set(CX,0,CZ); sun.target.updateMatrixWorld();
        sun.position.set(CX+120,168,CZ+80); sun.updateMatrixWorld();
      }
      renderer.shadowMap.needsUpdate=true;
      for(let i=0;i<2;i++){
        if(typeof composer!=="undefined"&&composer)composer.render();
        else throw new Error("NO COMPOSER — every number in this run would be void (AGES §G.6)");
      }
      const out=[];
      for(const b of window.__town){
        b.root.updateMatrixWorld(true);
        const bb=new THREE.Box3().setFromObject(b.body);
        if(!isFinite(bb.min.x))continue;
        let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
        for(const px of [bb.min.x,bb.max.x])for(const py of [bb.min.y,bb.max.y])for(const pz of [bb.min.z,bb.max.z]){
          const v=new THREE.Vector3(px,py,pz).project(camera);
          const sx=(v.x*0.5+0.5)*window.innerWidth, sy=(-v.y*0.5+0.5)*window.innerHeight;
          if(sx<x0)x0=sx; if(sx>x1)x1=sx; if(sy<y0)y0=sy; if(sy>y1)y1=sy;
        }
        out.push({type:b.type,x0,y0,x1,y1,hWorld:bb.max.y-bb.min.y});
      }
      return out;
    },{CX,CZ});

    const file=path.join(OUT,"town-"+AGE[age]+".png");
    await page.screenshot({path:file});
    console.log(("town "+AGE[age]).padEnd(20)+info.n+" buildings · "+info.loose+" loose meshes · "+
      info.welded+" welded parts · atlas "+info.atlas+" · skins "+info.skins);
    runs.push({age,file,info,boxes});
  }

  // ================= THE OWNER RULINGS, ASSERTED (AGES §0a) =================
  // Two of them are structural, both are easy to regress silently, and neither is covered by
  // smoketest.js. They are checked here because this is the buildings tool and these are building
  // rules — a colour gate cannot see either of them.
  const RULINGS=await page.evaluate(()=>{
    const sig=m=>{let n=0,t=[];m.traverse(o=>{if(o.isMesh){n++;t.push(o.geometry.type[0]);}});
                  return n+":"+t.sort().join("");};
    const out={};
    // §0a.1 — stone_wall / stone_gate are FULLY REPLACED by fort_wall / fort_gate and must NOT
    // render in the Medieval or Enlightenment ages. The replacement is a BUILD-MENU replacement,
    // not a demolition, so an already-placed stone wall is restyled by _restyleOneBuilding and it
    // is the MESH that has to enforce this.
    for(const a of [4,5]){
      out["stone_wall@"+a]=sig(buildingMesh("stone_wall",0,a,4,4))===sig(buildingMesh("fort_wall",0,a,4,4));
      out["stone_gate@"+a]=sig(buildingMesh("stone_gate",0,a,4,4))===sig(buildingMesh("fort_gate",0,a,4,4));
    }
    // …and it must still be the CLASSICAL stone wall in age 3, which is the one age it exists in
    out["stone_wall@3 differs from fort"]=sig(buildingMesh("stone_wall",0,3,4,4))!==sig(buildingMesh("fort_wall",0,3,4,4));
    // OWNER RULING — watch_tower is OCCUPIABLE and tower SHOOTS. Two distinct buildings, not two
    // sizes of one, in every age they share.
    let towersDiffer=true;
    for(const a of [3,4,5])if(sig(buildingMesh("watch_tower",0,a,4,4))===sig(buildingMesh("tower",0,a,4,4)))towersDiffer=false;
    out["watch_tower != tower"]=towersDiffer;
    // §5.7 / §H/A5 — six ages must be six ROOF FORMS, not one form in six colours. The house is
    // the building the roofline test actually measures, so it is the one asserted.
    const hs=new Set();
    for(let a=0;a<6;a++)hs.add(sig(buildingMesh("house",0,a,4,4)));
    out["six distinct house forms"]=hs.size===6;
    return out;
  });
  console.log("\n=== OWNER RULINGS (AGES §0a) and §5.7 ===");
  let rulingFail=0;
  for(const k in RULINGS){console.log("  "+(RULINGS[k]?"PASS":"*** FAIL")+"  "+k); if(!RULINGS[k])rulingFail++;}

  // ================= the A6 sweep: every (age, id), ONE AT A TIME, at close range =================
  // §H/A6: "eyedropper the roof's SUNLIT face and the wall's SUNLIT face." Two earlier cuts read
  // horizontal bands off the building's screen bounding box and both were wrong for the same
  // reason — a box that includes a flagpole and a banner puts the "roof band" on sky and the
  // "wall band" on roof, and half the rows came back with roof and wall byte-identical.
  //
  // So this is a real eyedropper. Each building is built UNMERGED (buildingMesh, not
  // makeBuilding), which keeps the roof slabs and the wall boxes as separate meshes carrying their
  // own cached materials, and the two faces are identified BY MATERIAL IDENTITY — texturedMat and
  // aWall come out of _skinCache, so `mesh.material === aWall(age)` is exact and needs no tagging
  // in the building file. From those meshes it takes TRIANGLE CENTROIDS, keeps the ones whose face
  // normal points at both the camera and the sun, nudges each one 0.12 off the surface so the
  // sample lands on the face and not on its own silhouette edge, and projects to pixels.
  const A6SHOTS=[];
  for(let age=0;age<6;age++)for(const type of ALLTYPES){
    if(((BLD_AGE[type])||0)>age)continue;
    const probe=await page.evaluate(({type,age})=>{
      if(window.__solo&&window.__solo.parent)window.__solo.parent.remove(window.__solo);
      teamAge[0]=age;
      const holder=new THREE.Group();
      const body=buildingMesh(type,0,age,-140,62);      // UNMERGED on purpose — see the note above
      holder.add(body);
      holder.scale.setScalar((typeof BSCALE!=="undefined"&&BSCALE[type])||1);
      holder.position.set(-140,terrainHeight(-140,62),62);
      scene.add(holder); window.__solo=holder;
      holder.updateMatrixWorld(true);
      const bb=new THREE.Box3().setFromObject(body);
      const cy=(bb.min.y+bb.max.y)/2, r=Math.max(bb.max.x-bb.min.x,bb.max.y-bb.min.y,bb.max.z-bb.min.z);
      const dist=Math.max(20,r*1.9);
      camera.position.set(-140+dist*0.55,cy+dist*0.62,62+dist*0.85);
      camera.lookAt(-140,cy*0.92,62);
      camera.updateProjectionMatrix();
      if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
      window.__clearWood(-140,62,150);
      if(typeof sun!=="undefined"&&sun&&sun.target){
        sun.target.position.set(-140,0,62); sun.target.updateMatrixWorld();
        sun.position.set(-140+120,168,62+80); sun.updateMatrixWorld();
      }
      renderer.shadowMap.needsUpdate=true;
      for(let i=0;i<2;i++){
        if(typeof composer!=="undefined"&&composer)composer.render();
        else throw new Error("NO COMPOSER — every number in this run would be void (AGES §G.6)");
      }
      const sunDir=new THREE.Vector3().subVectors(sun.position,sun.target.position).normalize();
      const roofMats=new Set([texturedMat(BPAL[age].roofPat,aRoof(age,type))]);
      if(age===1)roofMats.add(texturedMat(BPAL[1].pat,BPAL[1].dark));  // the cornice band, §F.0
      // §F.0's "wall" column names TWO hexes for every age — daub AND drystone, mudbrick AND
      // ashlar socle, limewash AND ashlar — but its roof/wall CONTRAST column is quoted against
      // the PRIMARY one, so that is what this measures. The second hex is a fallback and only a
      // fallback: measuring both together put the age-0 town centre's reading on the daub cell
      // hidden inside its drystone ring, and — worse — put every age-5 reading on the BRICK,
      // which §F.0 lists as base course, quoins and chimneys, i.e. an accent and not a wall face.
      const wallMats=new Set([aWall(age)]);
      const wallAlt=new Set([texturedMat("metal",BPAL[age].stone)]);
      const gl=renderer.getContext(), DPR=window.devicePixelRatio||1;
      const ray=new THREE.Raycaster(), sray=new THREE.Raycaster();
      const P0=new THREE.Vector3(),P1=new THREE.Vector3(),P2=new THREE.Vector3();
      const C=new THREE.Vector3(),N=new THREE.Vector3(),E1=new THREE.Vector3(),E2=new THREE.Vector3();
      const px=new Uint8Array(4);
      // a 3x3 median, not a single texel: the ink outlines are 1.8 CSS px wide and a sample that
      // lands on one reports the hull's near-black instead of the face's colour
      const blk=new Uint8Array(9*4);
      function readAt(v){
        const sx=Math.round((v.x*0.5+0.5)*window.innerWidth),
              sy=Math.round((-v.y*0.5+0.5)*window.innerHeight);
        if(sx<3||sy<3||sx>=window.innerWidth-3||sy>=window.innerHeight-3)return null;
        gl.readPixels(Math.round(sx*DPR)-1,Math.round((window.innerHeight-sy)*DPR)-1,3,3,
                      gl.RGBA,gl.UNSIGNED_BYTE,blk);
        const out=[];
        for(let ch=0;ch<3;ch++){const v2=[];
          for(let i=0;i<9;i++)v2.push(blk[i*4+ch]);
          v2.sort((a,b)=>a-b); out.push(v2[4]);}
        return out;
      }
      // SHADOWED IS NOT SUNLIT, AND UNTIL v131.2 THIS TOOL COULD NOT TELL THE DIFFERENCE.
      // `N.dot(sunDir)` says a face is TURNED TOWARD the sun. It does not say the sun can SEE it,
      // and in this building set that gap is enormous and it is deliberate: §5.5 hangs the eave
      // 14-18% out over the wall precisely so it drops a hard shadow band on it, and §F.4's Doric
      // peristyle puts the whole cella in the roof's shade by construction. Every one of those
      // faces passed the old test, and the median then mixed lit and shaded samples of the SAME
      // hex — which is why one travertine wall read 0.774 on the house and 0.643 on the barracks
      // in the same run, and why the Classical temple reported its wall at V 0.368 when the hex
      // is #D8C8A2 (0.787) and the podium two metres below it renders at 0.80.
      // Nine of the fifteen "failures" in the round-1 measurement were this and not paint.
      // §H/A6 says "the roof's SUNLIT face and the wall's SUNLIT face" — so ask the sun.
      //
      // ASK THE SUN THE SAME QUESTION THE RENDERER ASKS IT, WHICH MEANS CASTERS ONLY. Most of the
      // small parts in this file carry an explicit `castShadow=false` — §G.7's rule, so that a
      // cornice, a dentil course or an architrave costs nothing in the shadow pass — and those
      // parts therefore do NOT darken the pixel underneath them in the render. Raycasting against
      // the whole body counted every one of them as a blocker, which is stricter than the picture
      // and threw away wall faces that are plainly lit in the screenshot. Intersect the CASTERS.
      //
      // FIVE RAYS, NOT ONE, AND THE FOUR SPARE ONES ARE THE PENUMBRA. A single hard ray puts the
      // boundary between lit and shaded in a different place from the renderer's, which resolves
      // the same edge through a shadow map with a bias and a finite texel — so a thin ribbon of
      // points along every shadow line comes back "lit" from the ray and near-black from the
      // frame buffer. That ribbon is small and it does not matter until it is ALL a face has:
      // the Classical temple's cella returned nine of them and reported its travertine wall at
      // V 0.111, a hex authored at 0.787, and the row "passed" on it. Requiring the point to be
      // clear of the caster over a 3.4° cone drops the ribbon and keeps the face.
      let shadowDrop=0;
      const casters=[]; body.traverse(o=>{if(o.isMesh&&o.castShadow)casters.push(o);});
      const SUNJ=[sunDir.clone()];
      {
        const up=Math.abs(sunDir.y)<0.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
        const t1=new THREE.Vector3().crossVectors(sunDir,up).normalize();
        const t2=new THREE.Vector3().crossVectors(sunDir,t1).normalize();
        for(const s of [-1,1]){
          SUNJ.push(sunDir.clone().addScaledVector(t1,s*0.06).normalize());
          SUNJ.push(sunDir.clone().addScaledVector(t2,s*0.06).normalize());
        }
      }
      function litBySun(S){
        if(!casters.length)return true;
        for(const d of SUNJ){          // sunDir points FROM the building TOWARD the sun
          sray.set(S,d);
          if(sray.intersectObjects(casters,false).length){shadowDrop++;return false;}
        }
        return true;
      }
      function sample(mats){
        const out=[];
        body.traverse(o=>{
          if(!o.isMesh||!o.geometry||!mats.has(o.material))return;
          o.updateWorldMatrix(true,false);
          const gp=o.geometry.attributes.position; if(!gp)return;
          const idx=o.geometry.index;
          const nTri=idx?idx.count/3:gp.count/3;
          const step=Math.max(1,Math.floor(nTri/48));
          for(let t=0;t<nTri;t+=step){
            const a=idx?idx.getX(t*3):t*3, b2=idx?idx.getX(t*3+1):t*3+1, c2=idx?idx.getX(t*3+2):t*3+2;
            P0.fromBufferAttribute(gp,a).applyMatrix4(o.matrixWorld);
            P1.fromBufferAttribute(gp,b2).applyMatrix4(o.matrixWorld);
            P2.fromBufferAttribute(gp,c2).applyMatrix4(o.matrixWorld);
            C.copy(P0).add(P1).add(P2).multiplyScalar(1/3);
            E1.subVectors(P1,P0); E2.subVectors(P2,P0); N.crossVectors(E1,E2);
            if(N.lengthSq()<1e-9)continue;
            N.normalize();
            if(N.dot(sunDir)<0.18)continue;                     // not a sunlit face (§H/A6)
            const toCam=new THREE.Vector3().subVectors(camera.position,C).normalize();
            if(N.dot(toCam)<0.30)continue;                      // not turned toward the camera
            // OCCLUSION, AND THIS IS THE CLAUSE THE FIRST TWO CUTS OF THIS TOOL LACKED. A sunlit
            // camera-facing wall face is still INVISIBLE if the eave hangs over it — §5.5 makes
            // the overhang 14-18% of the footprint on purpose — so half the wall samples were
            // landing on the roof above them and the tool reported roof and wall as the same
            // colour on thirty-one rows. Raycast from the camera and keep the point only if the
            // FIRST thing the ray hits is the mesh we meant to measure.
            // …and take FIVE points across the face, not just its centroid: a face whose middle
            // is behind a chimney or a banner has plenty of clear surface either side of it, and
            // sampling one point per triangle left 31 of the 81 rows with no reading at all.
            //
            // WEIGHTED BY WORLD AREA, and that clause is load-bearing. An unweighted median over
            // triangles lets a 0.4-unit sunlit dormer cap outvote a 40-unit wall, and it did: the
            // Classical barracks' "roof" jumped 0.084 of value the moment the centurion's block
            // gained its own little hip, because that hip is four triangles pointed straight at
            // the sun and the main roof is four triangles raked away from it. §H/A6 says "the
            // roof's sunlit FACE", which is an area, not a triangle count.
            const area=E1.clone().cross(E2).length()*0.5;
            const rep=Math.max(1,Math.min(12,Math.round(area/1.5)));
            for(const bc of [[1/3,1/3,1/3],[0.6,0.2,0.2],[0.2,0.6,0.2],[0.2,0.2,0.6],[0.45,0.45,0.1]]){
              const S=new THREE.Vector3()
                .addScaledVector(P0,bc[0]).addScaledVector(P1,bc[1]).addScaledVector(P2,bc[2])
                .addScaledVector(N,0.12);
              const dir=new THREE.Vector3().subVectors(S,camera.position).normalize();
              ray.set(camera.position,dir);
              const hit=ray.intersectObject(body,true);
              if(!hit.length||hit[0].object!==o)continue;
              if(!litBySun(S))continue;                          // see litBySun — shadowed != sunlit
              const c=readAt(S.clone().project(camera));
              if(c)for(let q=0;q<rep;q++)out.push(c);
            }
          }
        });
        return out;
      }
      // FOUR POINTS IS NOT A FACE. The sun ray above kills the bulk of a shadowed surface but not
      // the last few pixels along the shadow's own edge — three.js's shadow map has a bias and a
      // finite texel, so the geometric boundary and the rendered one differ by a pixel or two and
      // a handful of stragglers survive. With the old threshold of 4 those stragglers WERE the
      // median: the Classical temple's cella reported V 0.116, near-black, off a wall hex authored
      // at 0.787. MIN below is that floor raised to a face-sized sample. It is the same number in
      // both places on purpose — a row that cannot reach it does not fall back to a reading it
      // also cannot trust, it falls back to the age's second wall hex, and failing that it is
      // reported UNMEASURED. An unmeasured row is not a passed row.
      // 8, not 25: the samples are replicated by world AREA, so a genuine face returns hundreds
      // and a hundred-square-metre one returns thousands. 25 sounded safe and was not — it cut ten
      // rows that had a real, small, correctly-lit face (the Iron blacksmith's open-sided bay, the
      // Classical fabrica's working bays) down to nothing. 8 kills the shadow-edge stragglers,
      // which come in ones and twos, and keeps everything that is actually a face. The raw counts
      // are printed on every row so a thin sample is visible rather than merely trusted.
      const MIN=8;
      let wall=sample(wallMats), altUsed=false, wallRaw=wall.length;
      if(wall.length<MIN){const alt=sample(wallAlt); if(alt.length>wall.length){wall=alt;altUsed=true;wallRaw=alt.length;}}
      if(wall.length<MIN)wall=[];
      let roof=sample(roofMats); const roofRaw=roof.length; if(roof.length<MIN)roof=[];
      // …and tell the caller whether a missing roof reading means "no sunlit face" or "no face".
      // §F.6 gives the Enlightenment tower "none — thick parapet" and its watch tower "flat gun
      // platform behind a parapet": those two rows have no roof to eyedropper AT ALL, and lumping
      // them in with rows that merely came up shadowed hides a real answer inside a warning.
      let roofMeshes=0; body.traverse(o=>{if(o.isMesh&&roofMats.has(o.material))roofMeshes++;});
      return {roof,wall,altUsed,shadowDrop,roofMeshes,roofRaw,wallRaw,
              rHex:aRoof(age,type),wHex:altUsed?BPAL[age].stone:BPAL[age].wall};
    },{type,age});
    const f=path.join(OUT,"_a6",AGE[age]+"-"+type+".png");
    fs.mkdirSync(path.dirname(f),{recursive:true});
    await page.screenshot({path:f});
    A6SHOTS.push({age,type,file:f,probe});
  }

  const FIN=await page.evaluate(()=>{
    let h=2166136261>>>0;
    for(const nd of nodes){const s=nd.type+"|"+nd.x.toFixed(4)+"|"+nd.z.toFixed(4);
      for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}}
    return {hash:h.toString(16),atlas:UATLAS.slots.size,skins:_skinCache.size,
            calls:renderer.info.render.calls,tris:renderer.info.render.triangles};
  });
  await browser.close(); srv.close();

  // ================= A5 (auto): the ROOF BAND of each town =================
  const bands=[];
  for(const r of runs){
    const P=pixels(r.file,W,H);
    const samp=[];
    for(const b of r.boxes){
      // the farm IS in the band from v131: it has a barn now, and a barn has a roof (§F.2-§F.6).
      const bh=b.y1-b.y0;
      if(bh<12)continue;
      const yA=Math.max(0,Math.round(b.y0+bh*0.06)), yB=Math.round(b.y0+bh*0.30);
      for(let y=yA;y<yB;y++)for(let x=Math.round(b.x0+2);x<Math.round(b.x1-2);x++){
        if(x<0||x>=W||y<0||y>=H)continue;
        const c=at(P,x,y);
        if(!onRoof(c))continue;
        samp.push(c);
      }
    }
    bands.push({age:r.age,med:medianOf(samp)||[0,0,0],n:samp.length});
  }
  console.log("\n=== §H/A5 (automatic half) — town ROOF-BAND median per age, off composer.render() ===");
  for(const b of bands)console.log("  "+AGE[b.age].padEnd(17)+hex(b.med)+"  rgb("+
    b.med.map(v=>String(Math.round(v)).padStart(3)).join(",")+")  V="+V(b.med).toFixed(3)+"   "+b.n+" px");
  let worst=1e9,wp="";
  console.log("  15 pairwise CIEDE2000 — FAIL below 12:");
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
    const d=dE00(bands[i].med,bands[j].med);
    if(d<worst){worst=d;wp=AGE[i]+" / "+AGE[j];}
    console.log("    "+AGE[i].padEnd(17)+AGE[j].padEnd(17)+d.toFixed(2)+(d<12?"   *** FAIL":""));
  }
  console.log("  WORST: "+wp+" = "+worst.toFixed(2)+(worst<12?"   *** A5-AUTO FAILS":"   PASS"));

  // ================= A6: roof face vs wall face, per (age, id) =================
  // The two exemptions §H/A6 states and no others: a BRONZE flat roof has no pitch and therefore
  // no value break, so the row measures the 0.10 H cornice band against the wall instead; and an
  // AGE-5 COPPER ORNAMENT is exempt as ornament, so a civic building measures its slate.
  //
  // AND ONE STRUCTURAL EXCLUSION THAT IS NOT AN EXEMPTION, RE-DRAWN IN v131.2. The old line was
  // `/wall|gate/ || farm`, which quietly threw away 23 of the 81 rows, and it was wrong about two
  // thirds of them. THE FARM HAS HAD A BARN SINCE v131 and a barn has an ageRoof() — five rows
  // were being skipped for a reason that had stopped being true, and the A5 band code four
  // screens up already says so in as many words. GATES have a roof in §F's prose (shingle over
  // the flanking towers) but not one this tool can sample: the caps are `box(...,P.roof)` off
  // `mat()`, which caches nothing, so there is no material identity to match and no roof PLANE
  // to eyedropper — that is a real limit and it is now printed as one instead of hidden.
  // Only a bare WALL genuinely has no roof at all. A6 reaches 63 of 81 rows and the other 18 are
  // named; a gate that reads "exempt" without saying why is how a third of a gate goes missing.
  const NOROOF=t=>/^(wood|stone|fort)_wall$/.test(t);      // a wall. There is no roof. Not a row.
  const NOROOFPLANE=t=>/_gate$/.test(t);                   // tower caps off mat(), nothing to match
  console.log("\n=== §H/A6 — SUNLIT roof face vs SUNLIT wall face, per (age, id). FAIL |dV| < 0.25 ===");
  const a6=[]; let a6fail=0, a6rows=0, a6meas=0, a6unmeas=0, a6noroof=0;
  for(const s of A6SHOTS){
    a6rows++;
    if(NOROOF(s.type)||NOROOFPLANE(s.type)){
      a6noroof++;
      a6.push({age:s.age,type:s.type,exempt:NOROOF(s.type)?"no roof — a wall":"gate: no samplable roof plane"});
      continue;
    }
    const grab=list=>medianOf(list.filter(c=>c[0]+c[1]+c[2]>18));
    const rHex=s.probe.rHex, wHex=s.probe.wHex;
    const roof=grab(s.probe.roof), wall=grab(s.probe.wall);
    if(!roof&&!s.probe.roofMeshes){        // §F.6's flat gun platforms: no roof exists to sample
      a6noroof++;
      a6.push({age:s.age,type:s.type,exempt:"no roof mesh — §F.6 flat parapet"});
      console.log("  "+AGE[s.age].padEnd(17)+s.type.padEnd(16)+
        "— no roof mesh at all (§F.6 gives this row a flat gun platform, not a roof)");
      continue;
    }
    if(!roof||!wall){
      a6unmeas++;
      a6.push({age:s.age,type:s.type,exempt:"NO SUNLIT SAMPLE ("+s.probe.roofRaw+"/"+s.probe.wallRaw+" pts)"});
      console.log("  "+AGE[s.age].padEnd(17)+s.type.padEnd(16)+"*** NO SUNLIT SAMPLE — UNMEASURED ("+
        s.probe.roofRaw+" roof pts, "+s.probe.wallRaw+" wall pts, "+
        s.probe.shadowDrop+" dropped in shadow)");
      continue;
    }
    a6meas++;
    const dv=Math.abs(V(roof)-V(wall)), ok=dv>=0.25, bronze=(s.age===1);
    // §H/A6's second stated exemption: age-5 COPPER is ornament and is exempt. §F.0 measures it
    // itself at 0.240 and says so — the town centre and the temple are the two civic roofs that
    // carry verdigris, and everything else in the age is slate at 0.516.
    const copper=(s.age===5&&(s.type==="towncenter"||s.type==="temple"));
    if(!ok&&!bronze&&!copper)a6fail++;
    // …and print the AUTHORED pair beside the rendered one. They are different quantities and a
    // critic comparing them without knowing that will read a global property of the ramp as a
    // building defect: the toon ramp, the fog and the grade COMPRESS range, so a wall authored at
    // 0.770 comes back at 0.627 while a roof authored at 0.374 comes back at 0.389, and §F.0's
    // stated 0.396 lands at 0.239 on screen with nothing wrong with either hex. §5.5 is written
    // against the authored pair; §H/A6 measures the render. Both belong in the output.
    const aRoofV=V([(rHex>>16)&255,(rHex>>8)&255,rHex&255]),
          aWallV=V([(wHex>>16)&255,(wHex>>8)&255,wHex&255]);
    a6.push({age:s.age,type:s.type,roof:hex(roof),wall:hex(wall),dv,bronze,copper,
             authoredDv:Math.abs(aRoofV-aWallV),pts:[s.probe.roof.length,s.probe.wall.length]});
    // ΔE00 ALONGSIDE, BECAUSE §H/A6 IS A VALUE-ONLY TEST AND SOME OF THIS SET SEPARATES BY HUE.
    // §F.0 already protects one such pair in as many words — Classical and Medieval roofs are
    // 0.03 apart in value and 29 apart in ΔE00, and "a critic must not fix it by darkening one".
    // The same thing happens on the age-5 brick rows: red brick over blue-grey slate is |dV| 0.08
    // and ΔE00 ~30, which is invisible to this gate and unmissable on the screenshot. Printing
    // both means a reader can tell a row that is genuinely a lump from a row that is only failing
    // the axis the gate happens to measure. It does NOT change the pass/fail: |dV| still rules.
    const de=dE00(roof,wall);
    console.log("  "+AGE[s.age].padEnd(17)+s.type.padEnd(16)+"roof "+hex(roof)+" V"+V(roof).toFixed(3)+
      "   wall "+hex(wall)+" V"+V(wall).toFixed(3)+"   |dV| "+dv.toFixed(3)+
      "  dE00 "+de.toFixed(1).padStart(4)+
      "  (authored "+Math.abs(aRoofV-aWallV).toFixed(3)+", "+
      s.probe.roofRaw+"/"+s.probe.wallRaw+" pts)"+
      (s.probe.altUsed?"  [2nd wall hex]":"")+
      (ok?"":(bronze?"   (bronze flat-roof exemption, §F.0)":
              copper?"   (age-5 copper ornament exemption, §H/A6)":"   *** FAIL")));
  }
  console.log("  A6: "+a6rows+" (age,id) rows rendered · "+a6meas+" measured · "+
    a6noroof+" have no roof (walls/gates) · "+a6unmeas+" UNMEASURED · "+
    a6fail+" non-exempt rows under the 0.25 floor");
  if(a6unmeas)console.log("  *** "+a6unmeas+" row(s) produced no sunlit sample. An unmeasured row is "+
    "NOT a passed row — a gate that silently skips its input is not a gate.");

  // ================= the contact sheet =================
  try{
    const labelled=[];
    for(const r of runs){
      const o=path.join(OUT,"_lbl-"+AGE[r.age]+".png");
      cp.execSync(`convert ${JSON.stringify(r.file)} -resize 720x -bordercolor '#111' -border 4 `+
        `-background '#111' -fill '#eee' -pointsize 26 label:'${AGE[r.age].toUpperCase()}' `+
        `+swap -gravity center -append ${JSON.stringify(o)}`);
      labelled.push(o);
    }
    cp.execSync(`montage ${labelled.map(f=>JSON.stringify(f)).join(" ")} -tile 2x3 -geometry +6+6 `+
      `-background '#111' ${JSON.stringify(path.join(OUT,"six-ages.png"))}`);
    for(const f of labelled)fs.unlinkSync(f);
    console.log("\ncontact sheet: "+path.join(OUT,"six-ages.png"));
  }catch(e){console.error("montage failed:",e.message.split("\n")[0]);}

  console.log("\n=== §G.4 BUDGETS ===");
  console.log("atlas cells : "+BOOT.atlas+" at boot -> "+FIN.atlas+" after all six towns   (ceiling ~130)");
  console.log("_skinCache  : "+BOOT.skins+" -> "+FIN.skins);
  console.log("node hash   : "+BOOT.hash+" -> "+FIN.hash+(BOOT.hash===FIN.hash?"   stable":"   *** MOVED"));
  fs.writeFileSync(path.join(OUT,"metrics.json"),JSON.stringify(
    {boot:BOOT,final:FIN,rulings:RULINGS,a5:{bands,worst,worstPair:wp},a6,
     towns:runs.map(r=>({age:r.age,...r.info}))},null,2));
  process.exit(0);
})();
