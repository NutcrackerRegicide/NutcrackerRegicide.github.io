#!/usr/bin/env node
/* REGICIDE PVP — tools/menushot.js — LOOK AT THE MENU (v128.9)
   ------------------------------------------------------------
   node tools/menushot.js [outdir]

   The menu is the one part of the game `vista.js` cannot photograph, because vista's whole job is
   to get PAST it. Three screens x three viewports, driven through the real controls — no forcing
   display:flex by hand, because a screen that only appears when a test sets it is not a screen.  */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||path.join(ROOT,"_menushot");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png",jpg:"image/jpeg"};
const VIEWS=[
  {name:"desktop",w:1400,h:820,touch:false,q:""},
  {name:"laptop", w:1280,h:720,touch:false,q:""},
  {name:"phone",  w:844, h:390,touch:true, q:"?touch=1"}
];
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}}).listen(8148);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  for(const v of VIEWS){
    const page=await b.newPage({viewport:{width:v.w,height:v.h},hasTouch:v.touch,isMobile:v.touch,
      deviceScaleFactor:1});
    page.on("pageerror",e=>console.log("PAGE ERROR ["+v.name+"]: "+e.message));
    await page.goto("http://localhost:8148/index.html"+v.q,{waitUntil:"load"});
    await page.waitForFunction(()=>typeof NET!=="undefined"&&!!NET.uiScreen,null,{timeout:30000});
    // 1. THE NAME — force the first-run path by clearing the stored name, then reload
    await page.evaluate(()=>{try{localStorage.removeItem("regicideName");}catch(e){}});
    await page.reload({waitUntil:"load"});
    await page.waitForFunction(()=>typeof NET!=="undefined"&&!!NET.uiScreen,null,{timeout:30000});
    await page.waitForTimeout(500);
    await page.screenshot({path:path.join(OUT,v.name+"-1-name.png")});
    // 2. THE SHIELDS — through CONTINUE, the way a player gets there
    await page.evaluate(()=>document.getElementById("btnname").click());
    await page.waitForTimeout(400);
    await page.screenshot({path:path.join(OUT,v.name+"-2-shields.png")});
    // 3. SETUP — through the PVP shield, with JOIN open so the hall browser shows
    await page.evaluate(()=>document.getElementById("btnpvp").click());
    await page.waitForTimeout(400);
    await page.screenshot({path:path.join(OUT,v.name+"-3-setup.png")});
    await page.evaluate(()=>document.getElementById("btnhost").click());
    await page.waitForTimeout(400);
    await page.screenshot({path:path.join(OUT,v.name+"-4-host.png")});
    const geo=await page.evaluate(()=>{
      const g=id=>{const e=document.getElementById(id);if(!e)return null;const b=e.getBoundingClientRect();
        return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)];};
      const sm=document.getElementById("startmenu"),ss=document.getElementById("setupscreen");
      return {shields:[g("btnsolo"),g("btncoop"),g("btnpvp")],
        smScroll:sm.scrollHeight-sm.offsetHeight, ssScroll:ss.scrollHeight-ss.offsetHeight};
    });
    console.log(v.name.padEnd(9)+" shields "+JSON.stringify(geo.shields)+
      "  overflow: shields "+geo.smScroll+"px, setup "+geo.ssScroll+"px");
    await page.close();
  }
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e.message);process.exit(1);});
