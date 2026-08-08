/* v113 dev-only: render the two rebuilt carts to PNGs so the models can be EYEBALLED,
   not just asserted. Not part of the shipped game and not part of the verify chain. */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8124);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:1400,height:760}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8124/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:30000});
  await page.evaluate(()=>{ // strip every DOM overlay so only the 3D frame shows
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0; // FREEZE the game loop, or it re-renders from its own camera
  });
  await page.waitForTimeout(400);
  const shots=[
    {name:"oxcart",      cls:"oxcart", cam:[13,8,17]},
    {name:"oxcart_side",  cls:"oxcart", cam:[19,4.5,0]},
    {name:"oxcart_front", cls:"oxcart", cam:[2,7,20]},
    {name:"trader",       cls:"trader", cam:[7,4.5,9]},
    {name:"trader_side",  cls:"trader", cam:[11,3,0]},
    {name:"knight",       cls:"knight", cam:[7,4.5,9]}   // the horse, for a quality comparison
  ];
  for(const s of shots){
    const info=await page.evaluate(({cls,cam})=>{
      for(const u of units)if(u._shot){u.alive=false;scene.remove(u.root);}
      const u=makeUnit(0,cls==="oxcart"?"villager":cls,0,0,{name:"Shot",bot:null});
      if(cls==="oxcart")setClass(u,"oxcart");
      u._shot=true; u.alive=true; u.root.position.set(0,0,0); u.facing=Math.PI*0.72;
      u.body.rotation.y=u.facing;
      if(u.carry){u.carry.wood=300;} if(typeof updateCargoVisual==="function")updateCargoVisual(u);
      const SX=0,SZ=-70; // clean open grass, well away from either base
      u.root.position.set(SX,terrainHeight?terrainHeight(SX,SZ):0,SZ);
      if(u.bar){u.bar.bg.visible=false;u.bar.fg.visible=false;}
      if(u._ring)u._ring.visible=false;
      camera.position.set(SX+cam[0],cam[1],SZ+cam[2]);
      camera.lookAt(SX,cls==="oxcart"?3.4:2,SZ);
      if(typeof sun!=="undefined"&&sun.target){sun.target.position.set(0,0,0);sun.target.updateMatrixWorld();}
      renderer.shadowMap.needsUpdate=true;
      const bb=new THREE.Box3().setFromObject(u.root);
      // v131 COMPOSER, NOT RENDERER — see the note in unitshot.js. A bare renderer.render()
      // skips bloom and the grade, so any colour eyedroppered off this PNG is a colour the game
      // never draws. AGES §G.6 names this file as a blocker.
      if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
      return {size:[+(bb.max.x-bb.min.x).toFixed(2),+(bb.max.y-bb.min.y).toFixed(2),+(bb.max.z-bb.min.z).toFixed(2)]};
    },s);
    console.log(s.name+" bounds W×H×L = "+info.size.join(" × "));
    await page.screenshot({path:path.join(ROOT,"tools","shot_"+s.name+".png")});
  }
  await browser.close(); srv.close();
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
