const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT="/root/regicide";
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8295);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  await page.goto("http://localhost:8295/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof vikingPoint==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);
  console.log(JSON.stringify(await page.evaluate(()=>{
    scene.updateMatrixWorld(true);
    const want=[[-56,-96],[-41,-106],[58,-73]]; const out=[];
    scene.traverse(o=>{
      if(!o.isMesh||!o.geometry)return;
      if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
      const c=o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
      for(const w of want)if(Math.hypot(c.x-w[0],c.z-w[1])<3)
        out.push({at:w,name:o.name||"(unnamed)",geo:o.geometry.type,
          verts:o.geometry.attributes.position.count,
          r:+o.geometry.boundingSphere.radius.toFixed(1),
          y:+c.y.toFixed(1),gy:+terrainHeight(c.x,c.z).toFixed(1),
          parent:(o.parent&&o.parent.type)||"-"});
    });
    // is it in the trees list?
    const near=[];
    if(typeof trees!=="undefined")for(const t of trees){
      for(const w of want)if(Math.hypot((t.x!==undefined?t.x:t.position.x)-w[0],(t.z!==undefined?t.z:t.position.z)-w[1])<3)near.push(w);
    }
    return {out,treeHits:near.length,haveTrees:typeof trees!=="undefined",
      nodesNear:(typeof nodes!=="undefined")?nodes.filter(n=>want.some(w=>Math.hypot(n.x-w[0],n.z-w[1])<4)).map(n=>({t:n.type,x:+n.x.toFixed(0),z:+n.z.toFixed(0)})):null};
  }),null,1));
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
