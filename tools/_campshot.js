/* scratch: render the three interior creep camps at a play vantage. Same rig as tools/roadshot.js. */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_camps");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8301);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:1600,height:900}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8301/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof CREEP_SITES!=="undefined",null,{timeout:45000});
  await page.evaluate(()=>{for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(500);
  const shots=[["inner-axis",0],["inner-red",1],["inner-top",1]];
  for(const [name,idx] of shots){
    await page.evaluate(({name,idx})=>{
      const inner=CREEP_SITES.filter(c=>c.inner); const c=inner[idx];
      const y=terrainHeight(c.x,c.z);
      if(name==="inner-top"){camera.position.set(c.x,y+52,c.z+2);camera.lookAt(c.x,y,c.z);}
      else {camera.position.set(c.x+26,y+15,c.z+26);camera.lookAt(c.x,y+1.5,c.z);}
      camera.updateProjectionMatrix();
      if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
      renderer.shadowMap.needsUpdate=true; composer.render();
    },{name,idx});
    await page.waitForTimeout(160);
    await page.screenshot({path:path.join(OUT,name+".png")});
    console.log("shot "+name);
  }
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
