/* spawnlook.js — JOHN'S REPRO, FOLLOWED EXACTLY (v132.53)
   "You have to at least be level one, walk far enough to where starting location is in the fog
    of war to see the dots."
   Every probe before this one measured the aura pool while standing in it. This one walks away
   and LOOKS BACK, which is the whole recipe.                                                  */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||"/tmp/_spawn";
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8171);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:1000,height:600}});
  page.on("pageerror",e=>{if(!/Cannot access/.test(e.message))console.log("ERR "+e.message.slice(0,110));});
  page.on("console",m=>{const t=m.text();if(/\[fx\]/.test(t))console.log("FENCE "+t.slice(0,110));});
  await page.goto("http://localhost:8171/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof player!=="undefined"&&player,null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){}try{gameOver=false;}catch(e){}});
  await page.waitForTimeout(2000);
  const home=await page.evaluate(()=>{player.lvl=1;
    window.__home=[player.root.position.x,player.root.position.z];return window.__home;});
  console.log("  spawn at "+home.map(v=>v.toFixed(0)).join(", ")+"  — standing there at level 1 for 6s");
  await page.waitForTimeout(6000);
  // WALK AWAY, using the real loop, until the spawn is well past the fog line
  // TELEPORT rather than nudge: the sim owns the player's position and quietly overwrote a
  // per-frame nudge, so the first run of this tool travelled two units and proved nothing.
  const mid=await page.evaluate(()=>({lit:auraStats().lit,live:auraStats().live}));
  console.log("  standing at spawn: lit="+mid.lit+"  live="+mid.live);
  await page.evaluate(()=>{const h=window.__home;
    player.root.position.set(h[0],player.root.position.y,h[1]-150);
    if(typeof terrainHeight==="function")player.root.position.y=terrainHeight(h[0],h[1]-150);});
  await page.waitForTimeout(4000);
  const away=await page.evaluate(()=>({d:+Math.hypot(player.root.position.x-window.__home[0],
    player.root.position.z-window.__home[1]).toFixed(0),
    st:JSON.parse(JSON.stringify({live:auraStats().live,lit:auraStats().lit,
      deadLit:auraStats().deadLit,swept:auraStats().swept,
      worst:isFinite(auraStats().worst)?+auraStats().worst.toFixed(1):"Inf"}))}));
  console.log("  walked "+away.d+"u away.  auraStats -> "+JSON.stringify(away.st));
  // LOOK BACK at the spawn
  await page.evaluate(()=>{
    const h=window.__home, p=player.root.position;
    camera.position.set(p.x,7,p.z); camera.lookAt(h[0],2,h[1]); camera.updateProjectionMatrix();
    if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
  });
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,"look-back.png")});
  // …and the same frame with the aura layer hidden, which is John's own bisection
  await page.evaluate(()=>{_auraPts.visible=false;
    if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);});
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,"look-back-no-aura.png")});
  console.log("  shots written to "+OUT);
  await browser.close(); srv.close();
})();
