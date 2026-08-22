/* aurafogproof.js — DOES THE FOG PAINT DEAD MOTES WHITE? (v132.54)
   Emits a full cloud, lets every mote EXPIRE (colour buffer all zero), walks the camera out past
   the fog line, and renders the same frame twice: once with the aura material fogged, once not.
   If the theory is right, the fogged frame has bright dots where the colour buffer says black.  */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||"/tmp/_fogproof";
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8175);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:900,height:520}});
  page.on("pageerror",e=>{if(!/Cannot access/.test(e.message))console.log("ERR "+e.message.slice(0,110));});
  await page.goto("http://localhost:8175/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  // HIDE THE DOM. The first run of this tool screenshotted the name screen in both frames and
  // reported a zero-pixel difference — a perfect A/B of two pictures of a menu.
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){}try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{try{for(let i=0;i<40;i++)tickBody(true);}catch(e){}});

  const info=await page.evaluate(()=>{
    const X=20,Z=40;
    camera.position.set(X,8,Z+8); camera.lookAt(X,2,Z);
    const u=makeUnit(0,"clubman",X,Z,{name:"Ghost",bot:{role:"citizen"}});
    u.bot=null; u.remote="ghost"; u.lvl=XP_MAX_LVL; u._auraAcc=0;
    u.root.position.y=terrainHeight(X,Z);
    for(let i=0;i<40;i++)updateEffects(0.05);          // raise a full cloud
    const peak=auraStats().lit;
    u.alive=false;                                     // …and let every mote expire
    for(let i=0;i<60;i++)updateEffects(0.05);
    window.__spot=[X,Z];
    return {peak:peak, litNow:auraStats().lit, live:auraStats().live, swept:auraStats().swept};
  });
  console.log("  cloud peaked at "+info.peak+" lit points; after expiry lit="+info.litNow+
    "  live="+info.live+"  swept="+info.swept+"   <- the colour buffer is BLACK");

  const shoot=async(fogOn,name)=>{
    const n=await page.evaluate(([fogOn])=>{
      _auraMat.fog=fogOn; _auraMat.needsUpdate=true;
      const s=window.__spot;
      camera.position.set(s[0],14,s[1]+120);           // out past the fog line, looking back
      camera.lookAt(s[0],2,s[1]); camera.updateProjectionMatrix();
      if(typeof setSunHour==="function")setSunHour(0,camera.position.x,camera.position.z);
      if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
      return auraStats().lit;
    },[fogOn]);
    await page.waitForTimeout(150);
    await page.screenshot({path:path.join(OUT,name+".png")});
    return n;
  };
  const a=await shoot(true ,"A-fog-on-OLD");
  const b=await shoot(false,"B-fog-off-v132.54");
  console.log("  rendered both frames (colour buffer lit="+a+" in each) -> "+OUT);
  await browser.close(); srv.close();
})();
