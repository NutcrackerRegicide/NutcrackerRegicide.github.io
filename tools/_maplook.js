/* scratch: a top-down overview of the whole map — roads, bazaars, camps — to check against the
   owner's sketch. Orthographic-ish: one very high perspective shot, plus a labelled schematic. */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_maplook");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8303);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:1800,height:1300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8303/index.html",{waitUntil:"load",timeout:90000});
  await page.waitForFunction(()=>typeof CREEP_SITES!=="undefined"&&typeof vikingPoint==="function",null,{timeout:45000});
  await page.evaluate(()=>{for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(500);
  const facts=await page.evaluate(()=>{
    // fog would swallow a 700-unit shot; push it back for the overview only
    if(scene.fog){scene.fog.near=900;scene.fog.far=2400;}
    camera.far=3000; camera.up.set(0,0,-1);
    camera.position.set(0,720,0.001); camera.lookAt(0,0,0);
    camera.updateProjectionMatrix();
    if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
    renderer.shadowMap.needsUpdate=true; composer.render();
    return {sites:CREEP_SITES.map(c=>({x:c.x,z:c.z,r:c.r,inner:!!c.inner,boss:!!c.boss})),
      baz:BAZAAR_SITES.map(B=>{const p=B.p();return {what:B.what,x:+p.x.toFixed(0),z:+p.z.toFixed(0)};}),
      tc:TCPOS,map:[MAP.x,MAP.z]};
  });
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,"overview.png")});
  console.log(JSON.stringify(facts));
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
