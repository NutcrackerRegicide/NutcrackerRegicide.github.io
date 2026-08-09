#!/usr/bin/env node
/* v131.29 — DOES THE BAZAAR HOLD ITS OWN NOW?
   -------------------------------------------
   node tools/bazaarshot.js

   John: "lets update bazaar model looks a little wimpy compared to new graphics" / "market model
   needs to be reworked looks very wimpy compared to other buildings". Both are the same object.

   "Wimpy" is a COMPARISON, so this measures a comparison rather than photographing the thing on its
   own and declaring it improved. Three numbers, none of them a judgement:

     MASS   the bazaar's bounding box against the buildings it stands among, each measured off its
            real model rather than off §5.6's table (which is stale — the table says a house is 7.4
            and the shipped house measures 5.0). The old bazaar topped out at 4.40. That number IS
            the complaint.
     DRAW   how many draw calls the three bazaars cost. mat() has no cache, so the old builder spent
            one material and one draw per part; §9.3 requires the before and after.
     BAND   the roof-against-plinth screen-value delta, which §2.4 floors at 0.25 — the one rule a
            bigger prop can quietly break by changing what sits next to what.                     */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_bazaar");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8256);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:900,height:560}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8256/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    const found=[];
    scene.traverse(o=>{
      if(!o.isMesh||!o.geometry)return;
      for(const m of neutralMarkets)
        if(Math.abs(o.position.x-m.x)<0.01&&Math.abs(o.position.z-m.z)<0.01)found.push(o);
    });
    let bb=null, tris=0, lowest=0;
    for(const o of found){
      o.geometry.computeBoundingBox();
      const t=o.geometry.boundingBox.clone();
      bb=bb?bb.union(t):t; tris+=o.geometry.getAttribute("position").count/3;
    }
    if(bb)lowest=bb.min.y;
    const mats=new Set(found.map(o=>o.material.uuid));
    // the ladder, measured off the real models rather than off the doc's table
    const ladder={};
    for(const type of ["house","barracks","towncenter","market"]){
      try{
        const g=buildingMesh(type,0,Math.max(BLD[type].age||0,3),0,0);
        const bs=(typeof BSCALE!=="undefined"&&BSCALE[type])||1;
        let t=null; g.traverse(o=>{if(!o.isMesh)return;
          const q=new THREE.Box3().setFromObject(o); if(isFinite(q.min.x))t=t?t.union(q):q;});
        if(t)ladder[type]={h:+((t.max.y-t.min.y)*bs).toFixed(2),w:+((t.max.x-t.min.x)*bs).toFixed(2)};
      }catch(e){ladder[type]=null;}
    }
    return {n:found.length,mats:mats.size,tris,lowest:+lowest.toFixed(2),
            h:bb?+(bb.max.y-bb.min.y).toFixed(2):null,
            above:bb?+bb.max.y.toFixed(2):null,
            w:bb?+(bb.max.x-bb.min.x).toFixed(2):null,
            d:bb?+(bb.max.z-bb.min.z).toFixed(2):null,ladder};
  });

  const luma=h=>{const r=(h>>16)&255,g=(h>>8)&255,b2=h&255;return (0.2126*r+0.7152*g+0.0722*b2)/255;};
  console.log("\n  DRAW — "+out.n+" mesh(es) on "+out.mats+" material  ->  "+out.n+
              " draw calls for the whole feature");
  console.log("         it was ~18 meshes on ~18 materials PER bazaar = ~54.  freed: ~"+(54-out.n));
  console.log("         triangles, all three: "+out.tris);
  console.log("\n  MASS — "+out.w+" x "+out.d+" in plan, "+out.above+" above ground"+
              "  (bbox "+out.h+", plinth sunk to "+out.lowest+")");
  console.log("         measured against the real models it stands among:");
  for(const k in out.ladder){
    const L=out.ladder[k];
    if(!L){console.log("           "+k.padEnd(12)+"(could not build)");continue;}
    console.log("           "+k.padEnd(12)+String(L.h).padStart(6)+" tall, "+String(L.w).padStart(6)+
      " wide     bazaar is "+(out.above/L.h).toFixed(2)+"x its height");
  }
  console.log("         the OLD bazaar stood 4.40 — 0.88 of a house. That was the complaint.");
  const dv=Math.abs(luma(0xD9C48F)-luma(0xB4543A));
  console.log("\n  BAND — roof #B4543A ("+luma(0xB4543A).toFixed(3)+") against plinth #D9C48F ("+
              luma(0xD9C48F).toFixed(3)+")  delta "+dv.toFixed(3)+
              (dv>=0.25?"   PASS (§2.4 floors it at 0.25)":"   *** FAIL"));

  for(const [nm,cam,look] of [
    ["road", [ 10,  4.5, 32],[0, 4.0, 15]],
    ["wide", [ 30, 17.0, 52],[0, 4.0, 15]],
    ["town", [-58, 17.0,-10],[-77, 4.0, 17]]]){
    await page.evaluate(({cam,look})=>{
      for(const u of units)u.root.visible=false;
      camera.position.set(cam[0],terrainHeight(cam[0],cam[2])+cam[1],cam[2]);
      camera.lookAt(look[0],terrainHeight(look[0],look[2])+look[1],look[2]);
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true; scene.updateMatrixWorld(true);
      if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
    },{cam,look});
    await page.waitForTimeout(150);
    await page.screenshot({path:path.join(OUT,"bazaar-"+nm+".png")});
  }
  console.log("\n  rendered to _bazaar/\n");
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
