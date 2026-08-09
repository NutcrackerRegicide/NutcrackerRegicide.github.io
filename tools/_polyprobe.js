const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8297);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:1920,height:1080}});
  await page.goto("http://localhost:8297/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof vikingPoint==="function",null,{timeout:45000});
  await page.evaluate(()=>{for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(400);
  for(const off of [true,false]){
    await page.evaluate((off)=>{
      for(const o of scene.children){
        if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.color)continue;
        if(o.geometry.attributes.position.count<1000)continue;
        o.geometry.computeBoundingBox();
        if(o.geometry.boundingBox.min.z<-100){o.material.polygonOffset=off;o.material.needsUpdate=true;}
      }
      const p=vikingPoint(0,0.55), py=terrainHeight(p.x,p.z);
      camera.position.set(p.x,py+40,p.z+1.5); camera.lookAt(p.x,py,p.z);
      camera.updateProjectionMatrix();
      if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
      renderer.shadowMap.needsUpdate=true; composer.render();
    },off);
    await page.waitForTimeout(160);
    await page.screenshot({path:path.join(ROOT,"_viking","_poly-"+(off?"on":"off")+".png")});
  }
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
