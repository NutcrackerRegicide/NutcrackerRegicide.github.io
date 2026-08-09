#!/usr/bin/env node
/* v131.27 — IS THE KNIGHT'S FACE ACTUALLY COVERED?
   ------------------------------------------------
   node tools/knighthelm.js

   John: "knight mask is clipping and knight should have full closed face helmet", and his ruling
   on the fix: "Give the knight his own seventh shape." That is helmHoundskull.

   The first render of it was judged BY EYE at a framing so tight the camera was practically inside
   the model, and the eye's verdict — "it's perched on top" — was wrong about the cause. This
   session's record on that is consistent and worth stating: gates that measure something INVISIBLE
   to the eye have been reliable, and gates that measure how something LOOKS have been wrong
   repeatedly. So this measures the invisible thing first and renders second.

   THE INVISIBLE THING IS AN OCCLUSION QUESTION, not a bounding-box question. "Is the face covered"
   means: from every direction a player can look at this man, does a ray reach the skull lathe, the
   moustache, or a curled tip before it reaches something made of metal? A bounding-box containment
   test would answer a different and easier question and would have passed the broken build, because
   the moustache's box IS inside the dome's box — it is only outside the dome's SURFACE.

   So: 812 rays on a Fibonacci sphere, fired inward at the head, first hit recorded per ray, and a
   census of what got hit. Any ray whose first hit is the head lathe or an R.face part is a hole.

   Measured on the UNMERGED body via _buildBodyRaw, because mergeUnitBody welds the head cluster
   into one geometry and a welded head has no separable face left to find (the weld trap, §A11).   */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_knighthelm");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8231);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:520,height:560}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8231/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;
    for(const u of units)u.root.visible=false;
    for(const t of worldDeco)t.visible=false;
    for(const bl of buildings)if(bl.body)bl.body.visible=false;
  });
  await page.waitForTimeout(250);

  // ---------- A. the occlusion census, on the raw unmerged body ----------
  const cen=await page.evaluate(()=>{
    teamAge[0]=4;
    const u={team:0,cls:"knight",id:7,alive:true,hp:100,root:new THREE.Group()};
    scene.add(u.root);
    u.body=new THREE.Group(); u.root.add(u.body);
    // the RAW build: no weld, so the head cluster still has separable parts in it
    _buildBodyRaw(u);
    const R=u.rig;                       // the part registry is u.rig, not u.parts
    const head=(R&&R.head)||null;
    if(!head)return {err:"no rig.head — keys: "+Object.keys(u).join(",")};
    if(u._modelBody)return {err:"knight is glTF-backed (_modelBody set) — the helm code never runs"};
    u.root.position.set(0,0,0); u.root.updateMatrixWorld(true); scene.updateMatrixWorld(true);

    // name every child of the head so the census is readable, and flag the two that must never
    // be a first hit: the skull lathe (the biggest lathe whose base sits at head-local y ~= 0)
    // and anything still in R.face.
    const faceSet=new Set(R.face||[]);
    const kids=[];
    head.traverse(o=>{ if(!o.isMesh||!o.geometry)return;
      o.geometry.computeBoundingBox();
      const bb=o.geometry.boundingBox;
      kids.push({o,type:o.geometry.type,
                 n:o.geometry.getAttribute("position").count,
                 y0:+bb.min.y.toFixed(3),y1:+bb.max.y.toFixed(3)});
    });
    // DO NOT LABEL THE SKULL BY GEOMETRY TYPE. The head lathe ends with .toNonIndexed(), which
    // returns a plain BufferGeometry — so does the beard — and the first cut of this census looked
    // for /Lathe/, found neither, and lumped the skull in with the plumes and the comb under "box".
    // 279 rays landed in that bucket and the probe printed PASS without ever having tested the one
    // thing it exists to test. Label by the two numbers that actually identify the skull: its local
    // box runs chin (0) to crown (NC_HEADH), and nothing else on the head does.
    let skull=null;
    for(const k of kids)if(Math.abs(k.y0)<0.02&&Math.abs(k.y1-NC_HEADH)<0.02&&(!skull||k.n>skull.n))skull=k;
    for(const k of kids)k.label=(skull&&k.o===skull.o)?"SKULL":faceSet.has(k.o)?"FACE":
      (k.o.name||(k.y0<-0.3?"beard":/Cone/.test(k.type)?"plume":"other"));
    if(!skull)return {err:"could not identify the skull lathe — labelling is unsafe, refusing to report"};

    // 812 rays inward from a Fibonacci sphere. The head centre is head-local (0, 0.475, 0).
    const c=new THREE.Vector3(0,NC_HEADH*0.5,0); head.localToWorld(c);
    // RAYCAST THE WHOLE BODY, NOT JUST THE HEAD. The first cut shot at R.head alone and reported 64
    // holes on the nape from below-behind — rays that in the real model pass straight through the
    // shoulders and the pauldrons before they get anywhere near a neck. "Can a player see skin" is
    // a question about the FIGURE; asking it of a disembodied head invents holes that do not exist
    // and would have sent a second round of geometry after them.
    const meshes=[]; u.body.traverse(o=>{if(o.isMesh&&o.geometry)meshes.push(o);});
    const rc=new THREE.Raycaster();
    const N=812, GA=Math.PI*(3-Math.sqrt(5));
    const tally=new Map(); const holes=[];
    for(let i=0;i<N;i++){
      const y=1-(i/(N-1))*2, r=Math.sqrt(Math.max(0,1-y*y)), th=GA*i;
      const d=new THREE.Vector3(Math.cos(th)*r,y,Math.sin(th)*r);
      const org=c.clone().addScaledVector(d,3.0);
      rc.set(org,d.clone().negate());
      const hit=rc.intersectObjects(meshes,false)[0];
      const lab=hit?((kids.find(k=>k.o===hit.object)||{}).label||"body (torso/arms/kit)"):"(miss)";
      tally.set(lab,(tally.get(lab)||0)+1);
      if(lab==="SKULL"||lab==="FACE"){
        const dl=head.worldToLocal(hit.point.clone());
        holes.push({lab,dir:[+d.x.toFixed(2),+d.y.toFixed(2),+d.z.toFixed(2)],
                    at:[+dl.x.toFixed(2),+dl.y.toFixed(2),+dl.z.toFixed(2)]});
      }
    }
    scene.remove(u.root);
    return {kids:kids.map(k=>({label:k.label,type:k.type.replace("Geometry",""),y0:k.y0,y1:k.y1})),
            faceLeft:(R.face||[]).filter(p=>p.parent).length, faceTotal:(R.face||[]).length,
            tally:[...tally.entries()].sort((a,b)=>b[1]-a[1]), holes:holes.slice(0,14), nHoles:holes.length, N};
  });

  if(cen.err){console.log("!! "+cen.err); await b.close(); srv.close(); process.exit(1);}
  console.log("\nR.head parts after helmHoundskull:");
  for(const k of cen.kids)console.log("   "+k.label.padEnd(11)+k.type.padEnd(10)+" y "+String(k.y0).padStart(6)+" .. "+String(k.y1).padStart(6));
  console.log("\nR.face still parented: "+cen.faceLeft+" of "+cen.faceTotal+"   (must be 0 of 3)");
  console.log("\nfirst-hit census over "+cen.N+" rays:");
  for(const [k,v] of cen.tally)console.log("   "+String(v).padStart(4)+"  "+k);
  console.log("\nHOLES (a ray reaching skin before metal): "+cen.nHoles+"   -> "+(cen.nHoles?"FAIL":"PASS"));
  // A DECORATION NOBODY EVER HITS IS A DECORATION THAT IS NOT THERE. Three renders in a row showed
  // a helm with no eyes because the slots were seated 0.12 inside the dome — geometry present,
  // materials right, nothing to see. The census already knows: if a named helm part never comes up
  // as a first hit from any of 812 directions, it is buried, and that is a fact about the model
  // rather than a judgement about the picture.
  const seen=new Set(cen.tally.map(t=>t[0]));
  const MUST=["helm.dome","helm.visor","helm.slit","helm.breath","helm.band"];
  const gone=MUST.filter(m=>!seen.has(m));
  console.log("BURIED helm parts (present in the model, visible from nowhere): "+
    (gone.length?gone.join(", ")+"   -> FAIL":"none   -> PASS"));
  for(const h of cen.holes)console.log("   "+h.lab+" from dir "+JSON.stringify(h.dir)+" at head-local "+JSON.stringify(h.at));

  // ---------- B. the renders, at a framing a human can judge ----------
  const VIEWS=[["front",0],["threeq",0.7],["side",1.5708],["back",3.1416]];
  for(const [nm,yaw] of VIEWS){
    await page.evaluate(({yaw})=>{
      if(window.__kn){window.__kn.alive=false;window.__kn.root.visible=false;
        if(window.__kn.root.parent)window.__kn.root.parent.remove(window.__kn.root);}
      teamAge[0]=4;
      const Z=140, u=makeUnit(0,"knight",0,Z,{name:""});
      window.__kn=u;
      u.root.position.set(0,terrainHeight(0,Z),Z);
      u.root.visible=true; u.facing=0; if(u.body)u.body.rotation.set(0,yaw,0);
      if(u.bar){u.bar.bg.visible=false;u.bar.fg.visible=false;}
      if(u._ring)u._ring.visible=false;
      // FRAME THE HEAD BY ASKING THE RIG WHERE IT IS. Guessing "terrain + 2.62" put the lens above
      // the crown looking down at it, with a tree trunk between — and the first judgement of this
      // helm ("it's perched on top") was made on a picture taken exactly that way, from about 0.9
      // units, of a shape the camera could not actually see. 2.6 units out, level with the head.
      for(const t of worldDeco)t.visible=false;              // re-hide: the world rebuilds decoration
      for(const o of units)if(o!==u)o.root.visible=false;
      for(const bl of buildings)if(bl.body)bl.body.visible=false;
      const hw=new THREE.Vector3(); u.rig.head.getWorldPosition(hw);
      hw.y+=0.30;                                            // the helm's mass is above the head origin
      camera.position.set(hw.x+Math.sin(0)*2.6,hw.y+0.05,hw.z+2.6);
      camera.lookAt(hw);
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true; scene.updateMatrixWorld(true);
      if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
    },{yaw});
    await page.waitForTimeout(120);
    await page.screenshot({path:path.join(OUT,"head-"+nm+".png")});
  }
  // and the whole man, because a helmet is judged against the figure it sits on (§6.1)
  await page.evaluate(()=>{
    const u=window.__kn;
    if(u&&u.body)u.body.rotation.set(0,0.6,0);
    for(const t of worldDeco)t.visible=false;
    const hw=new THREE.Vector3(); u.rig.head.getWorldPosition(hw);
    const gy=u.root.position.y;
    camera.position.set(hw.x,(gy+hw.y)*0.5+0.4,hw.z+6.4);
    camera.lookAt(hw.x,(gy+hw.y)*0.5,hw.z);
    camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate=true; scene.updateMatrixWorld(true);
    if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
  });
  await page.waitForTimeout(120);
  await page.screenshot({path:path.join(OUT,"body.png")});
  console.log("\nrendered to _knighthelm/  (head-front, head-threeq, head-side, head-back, body)");
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
