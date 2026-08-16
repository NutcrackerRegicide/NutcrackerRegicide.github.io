#!/usr/bin/env node
/* auraleak.js — CAN A MOTE BE LEFT BEHIND? (v132.51 investigation)
   John, v132.50 playtest, with a photograph of a band of lights hanging over the town:
     "do you see all the sparkles in town? that is my sparkles from being level 1 in the distance.
      level sparkles should not linger whatsoever and only be at the leveled unit."
   v132.50 made motes follow their owner, so a WALK cannot leave a trail. This tool goes looking
   for the other ways a mote can end up somewhere its owner is not — it drives the REAL frame
   functions and reports the worst distance from any live mote to the unit that emitted it.
   Usage: node tools/auraleak.js                                                              */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8141);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:900,height:600}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8141/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{try{for(let i=0;i<60;i++)tickBody(true);}catch(e){}});

  const probe=async(label,fn)=>{
    const r=await page.evaluate(fn);
    console.log(("  "+label).padEnd(46)+"live "+String(r.live).padStart(4)+
      "   ownerless "+String(r.orphan).padStart(4)+"   worst-from-owner "+
      (r.worst===null?" n/a":r.worst.toFixed(2)+"u"));
    return r;
  };
  const read=()=>{
    const L=auraLive(); let worst=null,orphan=0;
    const p=(typeof player!=="undefined"&&player&&player.root)?player.root.position:null;
    for(const m of L){ if(!m.owned)orphan++;
      if(p){const d=Math.hypot(m.x-p.x,m.z-p.z); if(worst===null||d>worst)worst=d;} }
    return {live:auraStats().live,orphan:orphan,worst:worst};
  };

  console.log("\n  --- the player, level 1, driven through the REAL frame path ---");
  await page.evaluate(()=>{
    player.lvl=1; player._auraAcc=0;
    window.__read=new Function("","return ("+(function(){}).toString()+")");
  });
  await page.evaluate(()=>{for(let i=0;i<120;i++)tickBody(true);});
  await probe("standing still, 2s",read);
  await page.evaluate(()=>{ // walk 30 units east through the frame path
    for(let i=0;i<150;i++){player.root.position.x+=0.2; tickBody(true);}
  });
  await probe("after walking 30u",read);

  console.log("\n  --- the two states where the sim stops but the SCREEN does not ---");
  await page.evaluate(()=>{player.lvl=25;player._auraAcc=0;for(let i=0;i<60;i++)tickBody(true);});
  const before=await probe("level 25, cloud full",read);
  await page.evaluate(()=>{ inMenu=true; for(let i=0;i<600;i++)tickBody(true); }); // 10s in a menu
  const menu=await probe("…then 10s with the MENU open",read);
  await page.evaluate(()=>{ inMenu=false; for(let i=0;i<120;i++)tickBody(true); });
  await probe("…menu closed again, 2s",read);
  await page.evaluate(()=>{player.lvl=25;player._auraAcc=0;for(let i=0;i<60;i++)tickBody(true);});
  await page.evaluate(()=>{ gameOver=true; for(let i=0;i<600;i++)tickBody(true); });
  const over=await probe("level 25 cloud, then 10s GAME OVER",read);
  await page.evaluate(()=>{ gameOver=false; });

  console.log("\n  --- and does the walk-away leave them where the player WAS? ---");
  await page.evaluate(()=>{ for(let i=0;i<200;i++)tickBody(true); player.lvl=25; player._auraAcc=0;
    for(let i=0;i<60;i++)tickBody(true); window.__was=[player.root.position.x,player.root.position.z]; });
  await page.evaluate(()=>{ inMenu=true; for(let i=0;i<300;i++)tickBody(true); inMenu=false;
    player.root.position.x+=45; for(let i=0;i<10;i++)tickBody(true); });
  const stranded=await page.evaluate(()=>{
    const L=auraLive(), w=window.__was; let n=0,far=0;
    for(const m of L){n++; if(Math.hypot(m.x-w[0],m.z-w[1])<8)far++;}
    return {live:n,atOldSpot:far,px:player.root.position.x};
  });
  console.log("  motes still sitting at the OLD position after riding 45u away: "+
    stranded.atOldSpot+" of "+stranded.live+" live");
  fs.writeFileSync("/tmp/auraleak.json",JSON.stringify({menu:menu,over:over,stranded:stranded},null,2));
  await browser.close(); srv.close();
})();
