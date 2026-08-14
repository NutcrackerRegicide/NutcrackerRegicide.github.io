/* REGICIDE PVP — tools/aurashot.js — LOOK AT THE LEVEL AURA (v132.29)
   ------------------------------------------------------------------
   node tools/aurashot.js [outdir]

   Dev-only. The aura is the one v132 feature whose gates cannot settle it: §2 says judgements
   about how things look have been wrong repeatedly here, so the smoketest asserts everything
   COUNTABLE about it (one draw call, the pool ceiling, the range gate, who may glow, the colour
   ramp, no per-frame allocation) and this tool produces the pictures for the owner to judge.

   It photographs the three things John actually chose:
     · THE RAMP      — levels 1 / 8 / 16 / 25 side by side, so "faint at 1, gold at 25" is a
                       thing you can see rather than a number in a log.
     · THE TEAM READ — the same ramp on BLUE and on RED. §2.5 caps team colour at 35% of a unit
                       and the team read is the most important thing in a fight; if gold swamps
                       it, that shows up here.
     · MOBILE        — the same capped unit with the composer OFF, because 12-touch.js:191 sets
                       composer=null and roughly half the audience never sees bloom at all. If
                       the aura only works with bloom, it does not work.
     · RANGE         — the same unit at AURA_FAR, which must be empty sky (John's v125 rule).

   Every mote is spawned by the REAL emitter through updateEffects, not by a harness stand-in,
   so what is photographed is what ships.                                                     */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||path.join(ROOT,"_aura");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png",jpg:"image/jpeg"};

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8131);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:1100,height:620}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  page.on("console",m=>{const t=m.text();if(/error|fail/i.test(t))console.log("[console] "+t.slice(0,160));});
  await page.goto("http://localhost:8131/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;   // freeze: the loop would re-render from its own camera
  });
  await page.waitForTimeout(500);
  await page.evaluate(()=>{try{for(let i=0;i<60;i++)tickBody(true);}catch(e){}});

  // ---- stage a rank of levelled players on open ground ----
  const STAGE=await page.evaluate(()=>{
    const X=20,Z=40;
    // v132.29: CLEAR THE SET. The first run put a tree trunk across the capped unit and the
    // judgement being made here is about a few pixels of light, so the stage has to be clean.
    for(const n of nodes)
      if(n.type==="wood"&&n.amount>0&&Math.abs(n.x-X)<26&&Math.abs(n.z-Z)<30){n.amount=0;if(n.mesh)n.mesh.visible=false;}
    window.__aura=[];
    const mk=(team,dx,lvl)=>{
      const u=makeUnit(team,"clubman",X+dx,Z,{name:"L"+lvl,bot:{role:"citizen"}});
      u.bot=null; u.remote="shot"+team+"-"+lvl;         // isHuman() = isPlayer || remote
      u.lvl=lvl; u._auraAcc=0; u.facing=Math.PI;
      u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
      window.__aura.push(u); return u;
    };
    [1,8,16,25].forEach((lv,i)=>mk(0,i*3.2-4.8,lv));   // BLUE rank
    [1,8,16,25].forEach((lv,i)=>mk(1,i*3.2-4.8+16,lv));// RED rank, one pace right
    return [X,Z];
  });
  const [X,Z]=STAGE;

  // let the emitter fill the air through the REAL driver
  const settle=async(n)=>{await page.evaluate((k)=>{for(let i=0;i<k;i++)updateEffects(0.05);},n);};

  const shoot=async(name,setup,ticks)=>{
    await page.evaluate(setup);
    await settle(ticks||36);
    await page.evaluate(()=>{
      if(typeof setSunHour==="function")setSunHour(0,camera.position.x,camera.position.z);
      if(typeof renderer!=="undefined"){
        renderer.shadowMap.needsUpdate=true;
        if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
      }
    });
    await page.waitForTimeout(100);
    await page.screenshot({path:path.join(OUT,name+".png")});
    console.log("shot",name);
  };

  const aim=(px,py,pz,lx,ly,lz)=>new Function("",
    "camera.position.set("+px+","+py+","+pz+");camera.lookAt("+lx+","+ly+","+lz+");camera.updateProjectionMatrix();");

  // 01 — THE RAMP, blue rank, gameplay distance
  await shoot("01-ramp-blue",aim(X-1,2.4,Z+15,X-1,3.2,Z));
  // 02 — THE RAMP, red rank
  await shoot("02-ramp-red",aim(X+16,2.4,Z+15,X+16,3.2,Z));
  // 03 — BOTH RANKS: does gold swamp the team read when the two are side by side?
  await shoot("03-teamread",aim(X+6,4.5,Z+30,X+6,3.0,Z));
  // 04 — THE CAP, close, bloom ON. Low camera angled UP: additive light reads against sky and
  // shade, and has almost nothing to add to a sunlit green field.
  await shoot("04-cap-bloom",aim(X+4.8,1.6,Z+7.0,X+4.8,3.4,Z));
  // 05 — THE CAP, close, COMPOSER OFF (the mobile path: 12-touch.js:191)
  await page.evaluate(()=>{window.__savedComposer=composer;composer=null;});
  await shoot("05-cap-nobloom-mobile",aim(X+4.8,1.6,Z+7.0,X+4.8,3.4,Z));
  await page.evaluate(()=>{composer=window.__savedComposer;});
  // 06 — 40px TEST (§5.2): the whole rank rendered small, to see if it survives being tiny
  await shoot("06-fardistance",aim(X+6,18,Z+62,X+6,2.0,Z));
  // 07 — THE RANGE RULE: beyond AURA_FAR the aura must be gone entirely
  await shoot("07-beyond-range",aim(X+6,10,Z+AURA_FAR_JS(),X+6,2.0,Z),40);

  function AURA_FAR_JS(){return 78;} // a shade past AURA_FAR (62) — must be empty air

  const stats=await page.evaluate(()=>{
    const s=(typeof auraStats==="function")?auraStats():null;
    return {live:s?s.live:-1,max:s?s.max:-1,
      calls:renderer.info.render.calls,tris:renderer.info.render.triangles,
      far:(typeof AURA_FAR!=="undefined")?AURA_FAR:null,
      near:(typeof AURA_NEAR!=="undefined")?AURA_NEAR:null};
  });
  fs.writeFileSync(path.join(OUT,"stats.json"),JSON.stringify(stats,null,2));
  console.log("aura stats:",JSON.stringify(stats));
  await browser.close(); srv.close();
})();
