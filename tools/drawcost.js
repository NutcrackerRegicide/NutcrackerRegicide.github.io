const {chromium}=require("playwright-core");
const http=require("http"),path=require("path"),fs=require("fs"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8145);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:1400,height:760}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8145/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:30000});
  await page.evaluate(()=>{for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{
    const x=-170,z=0,y=8;
    camera.position.set(x,y+6,z+18); camera.lookAt(x,y,z); camera.updateProjectionMatrix();
    for(const t of worldDeco)t.visible=((t.position.x-x)**2+(t.position.z-z)**2)<150*150;
    const inR=[]; for(const u of units){ if(u.alive&&((u.root.position.x-x)**2+(u.root.position.z-z)**2)<150*150)inR.push(u); }
    function measure(){ renderer.info.reset(); renderer.shadowMap.needsUpdate=true;
      const t0=performance.now(); for(let i=0;i<6;i++)renderer.render(scene,camera);
      return {calls:renderer.info.render.calls,tris:renderer.info.render.triangles,ms:+((performance.now()-t0)/6).toFixed(1)}; }
    for(const u of units)u.root.visible=false;
    const without=measure();
    for(const u of inR)u.root.visible=true;
    const withUnits=measure();
    // how many of a unit's meshes actually SURVIVE frustum culling on average
    return {without,withUnits,n:inR.length};
  });
  const dCalls=r.withUnits.calls-r.without.calls, dTris=r.withUnits.tris-r.without.tris;
  console.log("=== ISOLATING THE UNITS (base fight, camera at a town centre) ===");
  console.log("scene WITHOUT units : "+String(r.without.calls).padStart(5)+" draw calls  "+String(r.without.tris).padStart(7)+" tris");
  console.log("scene WITH "+String(r.n).padStart(3)+" units: "+String(r.withUnits.calls).padStart(5)+" draw calls  "+String(r.withUnits.tris).padStart(7)+" tris");
  console.log("-----------------------------------------------------------");
  console.log("UNITS COST          : "+dCalls+" draw calls for "+r.n+" units  =  "+(dCalls/Math.max(1,r.n)).toFixed(1)+" draw calls PER UNIT");
  console.log("UNITS COST          : "+dTris+" triangles      =  "+Math.round(dTris/Math.max(1,r.n))+" tris per unit");
  console.log("");
  console.log("If each unit were ONE mesh with ONE material (ideal glTF export):");
  console.log("  "+r.n+" units would cost "+r.n+" draw calls instead of "+dCalls+"  ->  "+(dCalls-r.n)+" calls saved ("+(100-100*r.n/Math.max(1,dCalls)).toFixed(0)+"% cut)");
  console.log("  whole scene: "+r.withUnits.calls+" -> "+(r.without.calls+r.n));
  console.log("If each unit were 4 materials (body/metal/cloth/face atlas):");
  console.log("  "+r.n*4+" draw calls  ->  whole scene "+(r.without.calls+r.n*4));
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
