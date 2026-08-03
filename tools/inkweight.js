/* REGICIDE PVP — tools/inkweight.js — HOW HEAVY IS THE LINE, REALLY (v128.3)
   -------------------------------------------------------------------------
   node tools/inkweight.js [phone|desk]

   Renders an aged-up hall (gable roofs are the only inked geometry left in the game) at a
   range of ?ink= scales, at the viewport and pixel ratio the target device actually uses.
   Exists because outline weight is the one thing that cannot be judged at desktop resolution:
   the phone rasterises at 590x273 and upscales, so a line specified in device pixels lands
   40% heavier on screen than the number says.                                              */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
const DESK=process.argv[2]==="desk";
const VP=DESK?{w:1400,h:760,dpr:1}:{w:844,h:390,dpr:0.7}, TAG=DESK?"desk":"phone";
const SCALES=[0,0.35,0.5,0.7,1];
(async()=>{
  const OUT=path.join(ROOT,"_ink_w"); fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8152);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  for(const s of SCALES){
    const page=await b.newPage({viewport:{width:VP.w,height:VP.h}});
    page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
    await page.goto("http://localhost:8152/index.html?ink="+s,{waitUntil:"load"});
    await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeBuilding==="function",null,{timeout:30000});
    const got=await page.evaluate(dpr=>{
      for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
      try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
      renderer.setPixelRatio(dpr); if(window.__syncInk)window.__syncInk();
      window.requestAnimationFrame=()=>0;
      // an Age-3 hall + houses on open ground, away from the seeded town
      teamAge[0]=3;
      const spots=[["towncenter",60,60],["house",74,54],["house",48,54],["barracks",62,76]];
      for(const [t,x,z] of spots){try{makeBuilding(0,t,x,z,true,0);}catch(e){}}
      const sz=renderer.getDrawingBufferSize(new THREE.Vector2());
      return {bufW:sz.x,bufH:sz.y,scale:window.__inkScale,noInk:!!window.__noInk};
    },VP.dpr);
    await page.waitForTimeout(300);
    await page.evaluate(()=>{
      camera.position.set(60+16,11,60+26); camera.lookAt(60,4,60); camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true;
      if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
    });
    await page.waitForTimeout(120);
    const f=path.join(OUT,TAG+"-ink"+String(s).replace(".","p")+".png");
    await page.screenshot({path:f});
    console.log(TAG+"  ?ink="+String(s).padEnd(5)+" buffer "+got.bufW+"x"+got.bufH+
      "  scale="+got.scale+(got.noInk?"  (OFF)":"")+"  -> "+path.basename(f));
    await page.close();
  }
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
