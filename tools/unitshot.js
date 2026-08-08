#!/usr/bin/env node
/* REGICIDE PVP — tools/unitshot.js — LOOK AT ONE UNIT (v128.6)
   -------------------------------------------------------------
   node tools/unitshot.js [outdir] [class,class,…]

   `vista.js` renders the world, which is exactly what you want for lighting and foliage and
   exactly what you do NOT want for a character change: the AI has built a different town and
   moved different soldiers by the time it fires, so two runs differ for reasons that have
   nothing to do with the thing you changed.

   This freezes everything, hides the world, and puts ONE unit of each requested class in front
   of a fixed camera at a fixed pose. Two runs differ only by what you did to the body. Written
   for the v128.6 rigid-cluster merge — where the whole question was "does welding 51 meshes into
   11 change what anyone sees" — and it answers that in one diff.                              */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||path.join(ROOT,"_unitshot");
const CLASSES=(process.argv[3]||"villager,broadsword,archer,knight,king,musketeer").split(",");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}}).listen(8146);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:520,height:680}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8146/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:30000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;                 // freeze the loop: no animation drift
    for(const u of units)u.root.visible=false;          // and an empty stage
    for(const t of worldDeco)t.visible=false;
    for(const bl of buildings)if(bl.body)bl.body.visible=false;
  });
  for(const cls of CLASSES){
    const ok=await page.evaluate(c=>{
      if(window.__shot){window.__shot.root.visible=false;window.__shot.alive=false;}
      const u=makeUnit(0,c,0,140,{name:"Shot",bot:null});
      if(!u)return false;
      window.__shot=u;
      u.root.position.set(0,terrainHeight(0,140),140);
      u.root.visible=true; u.facing=0; u.body.rotation.set(0,0,0);
      // a fixed three-quarter pose: enough turn to show the face AND the shoulder line
      u.body.rotation.y=-0.6;
      camera.position.set(2.4,terrainHeight(0,140)+2.0,144.6);
      camera.lookAt(0,terrainHeight(0,140)+1.15,140);
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true;
      // v131 THIS TOOL WAS CALIBRATING THROUGH THE WRONG RENDER, and every colour taken with it
      // was void. The game draws through the EffectComposer; a bare renderer.render() skips
      // UnrealBloomPass and the grade and writes an un-encoded buffer. That is exactly how
      // nc.beard #F7F3E8 was "proved" correct and then SHIPPED at (255,255,247) with two channels
      // pegged, ~6,900 flat pixels per figure on 136 bodies — the bloom high pass is at 0.86 and
      // the beard sat on the cliff. vista.js/phoneshot.js/inkweight.js have always done it this
      // way; unitshot is the per-class tool and was the one that mattered. AGES §G.6.
      for(let i=0;i<3;i++){
        if(typeof composer!=="undefined"&&composer)composer.render();
        else renderer.render(scene,camera);
      }
      let m=0;u.body.traverse(o=>{if(o.isMesh)m++;});
      const s=new Set();u.body.traverse(o=>{if(o.isMesh)s.add(o.material);});
      return m+"/"+s.size;
    },cls);
    if(!ok){console.log("skip "+cls);continue;}
    await page.screenshot({path:path.join(OUT,cls+".png")});
    console.log(("shot "+cls).padEnd(22)+ok+"  (meshes/materials)");
  }
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
