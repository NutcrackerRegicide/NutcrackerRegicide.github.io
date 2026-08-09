/* scratch: look at all four gate rungs after v132.15/.16. */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_gates");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8306);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:1500,height:900}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8306/index.html",{waitUntil:"load",timeout:90000});
  await page.waitForFunction(()=>typeof makeBuilding==="function",null,{timeout:45000});
  await page.evaluate(()=>{for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(400);
  for(const [name,type,age,unit] of [["a5-cannon","fort_gate",5,"cannon"],["a5-catapult","fort_gate",5,"catapult"],
                                     ["a4-cannon","fort_gate",4,"cannon"],["a5-wallramp","fort_wall",5,"clubman"]]){
    await page.evaluate(({type,age,unit})=>{
      for(const t of buildings.slice())t.alive=false;
      for(const u of units.slice()){u.alive=false;u.root.visible=false;}
      teamAge[0]=age;
      const GX=0,GZ=40;
      const g=makeBuilding(0,type,GX,GZ,true,0); if(g){g.built=true;g.alive=true;}
      window.__isWall=(type.indexOf("wall")>=0);
      // a wall either side so the gate reads as part of a line
      for(const s of [-1,1])for(let i=1;i<=2;i++){
        const w=makeBuilding(0,age>=5?"fort_wall":(age>=3?"stone_wall":"wood_wall"),GX+s*i*12.5,GZ,true,0);
        if(w){w.built=true;w.alive=true;}
      }
      const u=makeUnit(0,unit,GX,GZ+9,{name:""}); if(u){u.facing=Math.PI;u.root.rotation.y=Math.PI;
        u.root.position.set(GX,terrainHeight(GX,GZ+9),GZ+9);}
      // hide anything that is not the test rig: the default map is still standing and the camera
      // was ending up inside a tree.
      scene.updateMatrixWorld(true);
      const keep=new Set(); buildings.filter(bb=>bb.alive).forEach(bb=>bb.root.traverse(o=>keep.add(o)));
      units.filter(uu=>uu.alive).forEach(uu=>uu.root.traverse(o=>keep.add(o)));
      // studio shot: hide EVERYTHING except the rig and the ground it stands on. The distance cull
      // left tree trunks (they are low and near) standing in front of the camera.
      let ground=null,best=0;
      scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.attributes&&o.geometry.attributes.position){
        const n=o.geometry.attributes.position.count; if(n>best&&Math.abs(o.rotation.x+Math.PI/2)<0.01){best=n;ground=o;}}});
      scene.traverse(o=>{ if(!o.isMesh&&!o.isSprite)return;
        if(keep.has(o)||o===ground)return; o.visible=false; });
      camera.up.set(0,1,0);
      if(window.__isWall){camera.position.set(GX+15,13,GZ-19); camera.lookAt(GX,3,GZ-4);}
      else {camera.position.set(GX+17,10,GZ+27); camera.lookAt(GX,4.5,GZ);}
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true; composer.render();
    },{type,age,unit});
    await page.waitForTimeout(180);
    await page.screenshot({path:path.join(OUT,name+".png")});
    console.log("shot "+name);
  }
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
