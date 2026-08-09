#!/usr/bin/env node
/* v132.3 — THE VIKING ROAD, THROUGH THE COMPOSER
   ----------------------------------------------
   node tools/vikingshot.js

   Same rig, resolution and post stack as tools/roadshot.js, so the two sets of pictures are
   comparable pixel for pixel. It answers the one question tools/vikingroad.js deliberately refuses:

     THE CUT LINE. v130.4 put the King's Road's biggest value step exactly on the grass boundary and
     it read as an outline you could trace round the whole road. The fix was to make the road meet
     the lawn at its PALEST — 0.47 against grass at 0.52, a step you have to look for — and spend
     the contrast inward. The Viking road runs its profile the OTHER way on purpose (bare pale
     centre, shaded margin), so it meets the lawn at its darkest, and that is exactly the
     arrangement v130.4 got burned by. Whether it is a cut line or a shaded verge is a question
     about pixels and cannot be answered from vertex attributes: the road's colours are near-
     absolute against a white map and the terrain's are MULTIPLIERS around 1.0 on a green base.
     The first cut of the gate compared them anyway and reported the lawn at luminance 1.239.

   So this reads the FRAME. For each vantage it walks a horizontal scanline across the track and
   reports the sRGB luminance profile in pixels: grass, verge, centre, verge, grass. Then it prints
   the step at the boundary next to the King's Road's own step measured the same way in the same
   frame-space, because the shipped road is the bar.                                              */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_viking");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
const PNG=(()=>{try{return require("pngjs").PNG;}catch(e){return null;}})();
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8296);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:1920,height:1080}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8296/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof vikingPoint==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;
  });
  await page.waitForTimeout(500);

  // ---- the draw-call cost of the ribbon, the way AD §9.1 defines the budget ----------------------
  const M=await page.evaluate(()=>{
    let vk=null;
    for(const o of scene.children){
      if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.color)continue;
      // the same shape test tools/vikingroad.js uses. The looser one here (>1000 verts, y-span
      // <30, reaching past z=-100) also matched a 341,424-vertex merged prop mesh, so the "cost"
      // line was reporting some other object's triangles with a straight face.
      const n=o.geometry.attributes.position.count;
      if(n<1000||n>60000||!o.geometry.attributes.uv)continue;
      o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
      if(bb.min.z<-100&&bb.max.y-bb.min.y<12)vk=o;
    }
    const p=vikingPoint(0,0.55), py=terrainHeight(p.x,p.z);
    camera.position.set(p.x+14,py+12,p.z+14); camera.lookAt(p.x,py+1,p.z);
    camera.updateProjectionMatrix();
    if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
    renderer.info.reset(); renderer.render(scene,camera);
    const a=renderer.info.render.calls, at=renderer.info.render.triangles;
    if(!vk)return {found:false};
    vk.visible=false; renderer.info.reset(); renderer.render(scene,camera);
    const c=renderer.info.render.calls; vk.visible=true;
    // the TRIANGLE delta between the two passes is not the road's — renderer.info accumulates the
    // shadow-map passes too, and hiding the road changes what they cull. Read the geometry.
    return {found:true,calls:a-c,frame:a,frameTris:at,
      tris:(vk.geometry.index?vk.geometry.index.count:vk.geometry.attributes.position.count)/3,
      vkverts:vk.geometry.attributes.position.count,vkz:+vk.geometry.boundingBox.min.z.toFixed(0)};
  });
  console.log("\n  the Viking road costs "+(M.found?M.calls+" draw call(s) / "+M.tris+" triangles":"NOT FOUND")+
    "   (whole camera pass: "+M.frame+" calls / "+M.frameTris+" tris)"+
    (M.found?"   [mesh: "+M.vkverts+" verts, reaches z="+M.vkz+"]":""));

  // ---- the shots --------------------------------------------------------------------------------
  const SHOTS=[
    {name:"viking-play-mid",   road:"viking", t:0.55, mode:"play"},
    {name:"viking-play-bazaar",road:"viking", t:0.42, mode:"play"},
    {name:"viking-junction",   road:"viking", t:0.05, mode:"junc"},
    {name:"viking-tip",        road:"viking", t:0.95, mode:"low"},
    {name:"viking-top",        road:"viking", t:0.55, mode:"top"},
    {name:"kings-top",         road:"kings",  t:0.40, mode:"top"},   // the bar, same rig
    {name:"kings-top-b",       road:"kings",  t:0.62, mode:"top"},
  ];
  const rows=[];
  for(const s of SHOTS){
    await page.evaluate(({t,mode,road})=>{
      const p=(road==="kings")?roadPoint(t):vikingPoint(0,t);
      const py=terrainHeight(p.x,p.z);
      if(mode==="play"){const D=18,Y=Math.PI/2,P=0.62;
        camera.position.set(p.x+D*Math.sin(Y)*Math.cos(P),py+Math.max(1.1,D*Math.sin(P)+2),p.z+D*Math.cos(Y)*Math.cos(P));
        camera.lookAt(p.x,py+2,p.z);
      }else if(mode==="top"){
        // THE UP VECTOR IS NOT OPTIONAL LOOKING STRAIGHT DOWN. The first cut left it at +y, which
        // is degenerate for a vertical camera: three.js picks whatever falls out, and for the
        // King's Road it fell out ALONG the road — so the scanline ran up the middle of the track
        // for 1489 px and measured its own length instead of its width. Point `up` along the
        // road's TANGENT and the road runs vertically in frame, so a horizontal scanline crosses
        // it square. Same rig for both roads, which is the only way the two numbers compare.
        const e=0.004;
        const a=(road==="kings")?roadPoint(Math.max(0,t-e)):vikingPoint(0,Math.max(0,t-e));
        const c=(road==="kings")?roadPoint(Math.min(1,t+e)):vikingPoint(0,Math.min(1,t+e));
        const tx=c.x-a.x, tz=c.z-a.z, tl=Math.hypot(tx,tz)||1;
        camera.up.set(tx/tl,0,tz/tl);
        camera.position.set(p.x,py+40,p.z); camera.lookAt(p.x,py,p.z);
      }
      else if(mode==="junc"){camera.position.set(p.x+4,py+46,p.z+6);camera.lookAt(p.x+4,py,p.z-6);}
      else{const q=(road==="kings")?roadPoint(t-0.10):vikingPoint(0,t-0.10);
        camera.position.set(p.x+2,py+7,p.z-11);camera.lookAt(q.x,py+1,q.z);}
      camera.updateProjectionMatrix();
      if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
      renderer.shadowMap.needsUpdate=true;
      composer.render();
      camera.up.set(0,1,0);
    },s);
    await page.waitForTimeout(160);
    const file=path.join(OUT,s.name+".png");
    await page.screenshot({path:file});
    // ---- the scanline. Only the two TOP shots are metered: a top-down camera puts the track across
    // the middle of the frame at a known place, so a horizontal scanline crosses grass-road-grass
    // with no props, no horizon and no perspective foreshortening to argue about.
    if(s.mode==="top"&&PNG){
      const img=PNG.sync.read(fs.readFileSync(file));
      const y=Math.floor(img.height/2), prof=[], warm=[];
      for(let x=0;x<img.width;x++){
        const i=(y*img.width+x)*4;
        const R2=img.data[i]/255, G=img.data[i+1]/255, B=img.data[i+2]/255;
        prof.push(0.2126*R2+0.7152*G+0.0722*B);
        warm.push(R2-G);                       // >0 on earth, <0 on grass
      }
      rows.push({name:s.name,prof,warm});
    }
  }

  if(!PNG){console.log("\n  (pngjs not installed — pictures written, scanline not metered)");}
  else for(const r of rows){
    const p=r.prof, n=p.length;
    // FIND THE ROAD BY HUE, NOT BY VALUE. The first cut of this looked for a band DARKER than the
    // lawn and found a run of zero pixels — because a footpath worn to dry earth is PALER than
    // grass, which is the whole point of its profile. Dirt is warm (red above green); grass is not.
    // That separation is unambiguous and does not care which one is brighter.
    const mid=Math.floor(n/2);
    let lo=mid, hi=mid;
    const lawnAt=(a,c)=>{let s=0,k=0;for(let x=a;x<c;x++){s+=p[x];k++;}return s/k;};
    const grass=(lawnAt(40,120)+lawnAt(n-120,n-40))/2;
    while(lo>2&&r.warm[lo]>0.02)lo--;
    while(hi<n-3&&r.warm[hi]>0.02)hi++;
    const w=hi-lo;
    const band=(f,t2)=>{let s=0,k=0;for(let x=lo+Math.round(w*f);x<lo+Math.round(w*t2);x++){s+=p[x];k++;}return k?s/k:0;};
    const edge=(band(0.02,0.14)+band(0.86,0.98))/2, centre=band(0.40,0.60);
    console.log("\n  "+r.name+"   the track spans "+w+" px of the frame");
    console.log("    lawn beside it     "+grass.toFixed(3));
    console.log("    where it MEETS it  "+edge.toFixed(3)+"    step "+Math.abs(grass-edge).toFixed(3));
    console.log("    centre             "+centre.toFixed(3));
    console.log("    profile edge->centre->edge  "+
      [0.03,0.12,0.25,0.40,0.50,0.60,0.75,0.88,0.97].map(f=>band(f-0.03,f+0.03).toFixed(2)).join(" "));
  }
  console.log("\n  pictures in _viking/\n");
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
