/* REGICIDE PVP — tools/phoneshot.js — LOOK AT THE GAME THE WAY A PHONE DOES (v128.1)
   -----------------------------------------------------------------------------------
   node tools/phoneshot.js [outdir]

   Same shots as vista.js, rendered at a phone viewport with the battery saver's 0.7 pixel
   ratio — which is what the device actually rasterises before upscaling to the screen.

   THIS TOOL EARNED ITS PLACE IMMEDIATELY. The v128.1 outlines looked right in every desktop
   render and were INVISIBLE here: the hull push was constant in screen-FRACTION terms, so on a
   273-pixel-tall buffer a 2.4px line resolved to about one device pixel and dissolved. The
   outlines were missing on precisely the device they were added for, and nothing at desktop
   resolution would ever have shown it. Run this after ANY change to line weight, HUD scale, or
   anything else whose size is expressed in pixels.

   Dev-only, not part of the verify chain. Renders the real world from a handful of fixed
   camera setups so a graphics change can be EYEBALLED instead of argued about. Every shot is
   deterministic (the world build is seeded, and the game loop is frozen before the first
   capture), so two runs of this tool differ only by what actually changed in the renderer.

   Shots are chosen to cover the things a stylised-cartoon pass has to get right:
     · a wide meadow    — ground colour, grass density, fog, sky
     · a town           — building silhouettes, roof reds, road paving
     · a forest edge    — canopy greens against the ground greens
     · a close crowd    — how the toon ramp reads on characters at gameplay distance
     · a low sun angle  — whether the ramp bands cleanly or muddies                          */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||path.join(ROOT,"_vista");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8131);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:844,height:390}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message+"\n"+(e.stack||"").split("\n").slice(0,4).join("\n")));
  page.on("console",m=>{const t=m.text();if(/error|fail|undefined/i.test(t))console.log("[console] "+t.slice(0,180));});
  await page.goto("http://localhost:8131/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;
    // simulate the battery saver: 0.7 device pixels per CSS pixel, which is what the phone
    // actually rasterises at — the honest test of whether a 2px outline survives
    renderer.setPixelRatio(0.7);
    renderer.setSize(innerWidth,innerHeight);
    if(typeof composer!=="undefined"&&composer)composer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    if(window.__syncInk)window.__syncInk();
  });
  await page.waitForTimeout(600);
  // let the world settle a little so villagers are out working, then freeze again
  await page.evaluate(()=>{try{for(let i=0;i<120;i++)tickBody(true);}catch(e){}});
  await page.waitForTimeout(200);

  const TC=await page.evaluate(()=>{const t=teamTC(0);return t?[t.x,t.z]:[-175,0];});
  const SHOTS=[
    {name:"01-meadow",   pos:[  20, 14,  60], look:[  10, 2,  10]},
    {name:"02-town",     pos:[TC[0]+34, 20, TC[1]+40], look:[TC[0], 3, TC[1]]},
    {name:"03-forest",   pos:[ -40, 12, -60], look:[ -70, 4, -95]},
    {name:"04-crowd",    pos:[TC[0]+14,  6, TC[1]+16], look:[TC[0]+2, 2.2, TC[1]+2]},
    {name:"05-lowsun",   pos:[  60,  7,  10], look:[  10, 2.5, 10]},
    {name:"06-wide",     pos:[   0, 60, 130], look:[   0, 0, 0]}
  ];
  for(const s of SHOTS){
    await page.evaluate(({pos,look})=>{
      camera.position.set(pos[0],pos[1],pos[2]);
      camera.lookAt(look[0],look[1],look[2]);
      camera.updateProjectionMatrix();
      if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
      if(window.__INKDBG&&typeof outlinePass!=="undefined"&&outlinePass)outlinePass.uniforms.DEBUG_DEPTH.value=1.0;
      if(typeof renderer!=="undefined"){
        renderer.shadowMap.needsUpdate=true;
        if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
      }
    },s);
    await page.waitForTimeout(120);
    await page.screenshot({path:path.join(OUT,s.name+".png")});
    console.log("shot",s.name);
  }
  const stats=await page.evaluate(()=>({
    calls:renderer.info.render.calls,tris:renderer.info.render.triangles,
    geos:renderer.info.memory.geometries,texs:renderer.info.memory.textures,
    objs:scene.children.length
  }));
  console.log("render: "+stats.calls+" draw calls · "+stats.tris+" triangles · "+
    stats.geos+" geometries · "+stats.texs+" textures · "+stats.objs+" scene children");
  await browser.close(); srv.close();
  process.exit(0);
})();
