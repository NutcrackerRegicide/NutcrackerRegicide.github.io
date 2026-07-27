const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8131);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:1400,height:760}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8131/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:30000});
  await page.evaluate(()=>{for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(400);
  // three vantage points: deep in the wood, on the King's Road, and standing in a base
  const spots=[["wood",-60,-95,6],["road",0,10,6],["base",-170,0,8]];
  for(const [name,x,z,y] of spots){
    const info=await page.evaluate(({x,z,y})=>{
      camera.position.set(x,y+6,z+18); camera.lookAt(x,y,z);
      // Make the measurement DETERMINISTIC. Left alone this harness reported whatever LOD state
      // the frozen game loop happened to leave behind, which swung the base reading from 277 to
      // 1504 draw calls between runs. Force everything inside the cull radius visible instead:
      // that is the worst case — a full army on screen — and it's the number that actually
      // matters when asking whether a phone can run this.
      for(const t of worldDeco)t.visible=((t.position.x-x)**2+(t.position.z-z)**2)<150*150;
      let nUnits=0;
      for(const u of units){
        const vis=u.alive&&((u.root.position.x-x)**2+(u.root.position.z-z)**2)<150*150;
        u.root.visible=vis; if(vis)nUnits++;
      }
      renderer.info.reset(); renderer.shadowMap.needsUpdate=true;
      const t0=performance.now(); for(let i=0;i<10;i++)renderer.render(scene,camera);
      const ms=(performance.now()-t0)/10;
      return {calls:renderer.info.render.calls,tris:renderer.info.render.triangles,ms:+ms.toFixed(1),units:nUnits};
    },{x,z,y});
    console.log(name.padEnd(6),"units",String(info.units).padStart(3),
      " drawCalls",String(info.calls).padStart(5)," tris",String(info.tris).padStart(8),
      " softwareGL ms/frame",info.ms);
    await page.screenshot({path:path.join(ROOT,"tools","shot_forest_"+name+".png")});
  }
  await b.close(); srv.close();
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
