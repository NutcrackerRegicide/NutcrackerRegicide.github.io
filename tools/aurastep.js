/* REGICIDE PVP — tools/aurastep.js — IS THE LEVEL RAMP LEGIBLE? (v132.50)
   ----------------------------------------------------------------------
   node tools/aurastep.js [outdir]

   John, v132.49: "The emphasis on the aura also does not change much from lvl 1 to 25 and needs
   to be more significant." aurashot.js cannot settle that question — it photographs all four
   levels in ONE frame at gameplay distance, where the grass hides the ankles and the far figures
   are 40px tall. This tool photographs each level ALONE, from the SAME camera, with the pool
   drained between subjects, so the four pictures differ in exactly one variable.
   Also shoots the WALK, which is the other half of v132.50: the same capped unit photographed
   mid-sprint. A trail, if there is one, is a line on the ground behind him.                  */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||path.join(ROOT,"_aurastep");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png",jpg:"image/jpeg"};

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8137);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:900,height:700}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8137/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;
  });
  await page.waitForTimeout(400);
  await page.evaluate(()=>{try{for(let i=0;i<60;i++)tickBody(true);}catch(e){}});

  const X=20,Z=40;
  await page.evaluate(([X,Z])=>{
    // clear the set: this is a judgement about a few pixels of light
    for(const n of nodes)
      if(n.type==="wood"&&n.amount>0&&Math.abs(n.x-X)<26&&Math.abs(n.z-Z)<30){n.amount=0;if(n.mesh)n.mesh.visible=false;}
    for(const b of (typeof foliage!=="undefined"&&foliage?foliage:[]))
      if(b&&b.position&&Math.abs(b.position.x-X)<20&&Math.abs(b.position.z-Z)<24)b.visible=false;
    window.__sub=null;
  },[X,Z]);

  const drain=async()=>{await page.evaluate(()=>{for(let i=0;i<60;i++)updateEffects(0.05);});};
  const render=async()=>{await page.evaluate(()=>{
    if(typeof setSunHour==="function")setSunHour(0,camera.position.x,camera.position.z);
    if(typeof renderer!=="undefined"){renderer.shadowMap.needsUpdate=true;
      if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);}
  });};

  // ---- one level, alone, from the fixed camera ----
  // ONE subject for the whole run, re-levelled between shots. The first version of this tool
  // built a fresh unit per level — and makeUnit randomises the face, so the four pictures
  // differed in beard as well as in aura and the tool broke its own one-variable promise.
  await page.evaluate(([X,Z])=>{
    const u=makeUnit(0,"clubman",X,Z,{name:"Step",bot:{role:"citizen"}});
    u.bot=null; u.remote="step-sub"; u.lvl=1; u._auraAcc=0; u.facing=Math.PI;
    u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
    window.__sub=u; window.__home=[u.root.position.x,u.root.position.z];
  },[X,Z]);
  const step=async(lvl,walk)=>{
    await page.evaluate(([X,Z,lvl])=>{
      const u=window.__sub;
      u.root.position.x=window.__home[0]; u.root.position.z=window.__home[1];
      u.lvl=lvl; u._auraAcc=0;
      camera.position.set(X+0.2,2.0,Z+6.2); camera.lookAt(X,2.6,Z); camera.updateProjectionMatrix();
    },[X,Z,lvl]);
    await drain();
    if(walk){
      // A SPRINT ACROSS THE FRAME, the emitter driven by the REAL updateEffects. He starts left
      // of centre and finishes right of it, so the ground he has just crossed is in shot: that
      // strip is the whole question. Before v132.50 it held a two-unit smear of light.
      await page.evaluate(()=>{window.__sub.root.position.x=window.__home[0]-3.0;});
      await page.evaluate(()=>{for(let i=0;i<24;i++)updateEffects(0.05);});
      await page.evaluate(()=>{
        for(let i=0;i<40;i++){window.__sub.root.position.x+=0.15; updateEffects(0.05);}
      });
    }else{
      await page.evaluate(()=>{for(let i=0;i<40;i++)updateEffects(0.05);});
    }
    const s=await page.evaluate(()=>{
      const st=auraStats(), sh=auraShape(window.__sub);
      return {live:st.live,n:sh.n,rad:+sh.rad.toFixed(2),top:+sh.top.toFixed(2),
              spread:+auraSpread(window.__sub).toFixed(2)};
    });
    await render(); await page.waitForTimeout(80);
    const name=(walk?"walk-":"lvl-")+String(lvl).padStart(2,"0");
    await page.screenshot({path:path.join(OUT,name+".png")});
    console.log(name.padEnd(9)+"  motes "+String(s.n).padStart(3)+
      "   radius "+String(s.rad).padStart(5)+"u   column "+String(s.top).padStart(5)+
      "u   worst-behind "+String(s.spread).padStart(5)+"u");
    return s;
  };

  const out={};
  for(const lv of [1,8,16,25])out["lvl"+lv]=await step(lv,false);
  // and the walk, at the cap, with the same subject
  out.walk=await step(25,true);
  fs.writeFileSync(path.join(OUT,"steps.json"),JSON.stringify(out,null,2));
  await browser.close(); srv.close();
})();
