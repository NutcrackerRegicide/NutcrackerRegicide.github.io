/* v107 browser check — NOT part of the shipped game.
   Verifies in real Chromium what the headless smoketest cannot:
   1) all 79 SFX OGGs decode (Sound._state.ready + buf count) on http AND file://
   2) all 6 music tracks (audio/music/age0-5.ogg) load + play through <audio>
   3) an in-page anthem actually starts when a fake live-game state is armed
   Usage: node tools/browsercheck.js   (run from the project dir) */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8123);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--autoplay-policy=no-user-gesture-required","--no-sandbox","--mute-audio"]});
  let fails=0;
  const check=(n,c)=>{console.log((c?"  PASS":"  FAIL")+" — "+n);if(!c)fails++;};
  for(const [label,url] of [["http","http://localhost:8123/index.html"],["file://","file://"+path.join(ROOT,"index.html")]]){
    const page=await browser.newPage();
    page.on("pageerror",e=>console.log("  PAGE ERROR ("+label+"): "+e.message));
    await page.goto(url,{waitUntil:"load"});
    await page.mouse.click(400,300); // autoplay unlock
    const ok=await page.waitForFunction(()=>typeof Sound!=="undefined"&&Sound._state.ready===true,null,{timeout:30000}).catch(()=>null);
    const nbuf=await page.evaluate(()=>[Object.keys(Sound._state.buf).length,Object.keys(Sound._defs).length]);
    check(label+": Sound ready & ALL "+nbuf[1]+" SFX decoded ("+nbuf[0]+")",!!ok&&nbuf[0]===nbuf[1]);
    const mus=await page.evaluate(async()=>{
      const out=[];
      for(let a=0;a<6;a++){
        out.push(await new Promise(res=>{
          const el=new Audio("audio/music/age"+a+".ogg");
          const t=setTimeout(()=>res({a,ok:false,err:"timeout"}),20000);
          el.addEventListener("canplaythrough",async()=>{clearTimeout(t);
            try{await el.play();el.pause();res({a,ok:el.duration>60,dur:Math.round(el.duration)});}
            catch(e){res({a,ok:false,err:String(e)});}});
          el.addEventListener("error",()=>{clearTimeout(t);res({a,ok:false,err:"decode/load error"});});
          el.load();
        }));
      }
      return out;
    });
    check(label+": all 6 anthems load & play ("+mus.map(m=>m.a+":"+(m.ok?m.dur+"s":m.err)).join(" · ")+")",mus.every(m=>m.ok));
    // arm a fake live game: the tick should pick MYTEAM's age and start the anthem element
    const armed=await page.evaluate(async()=>{
      // assign the game's LEXICAL globals (top-level let/const never land on window)
      try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
      try{if(!player)player={root:null,alive:true};}catch(e){}
      teamAge[0]=2;
      Sound.tick(0.016);
      await new Promise(r=>setTimeout(r,600));
      const MU=Sound._mus;
      return {age:MU.age,playing:MU.playing,src:MU.el?MU.el.src:"",vol:MU.el?+MU.el.volume.toFixed(3):-1,
        expected:+(Sound.getVol("master")*Sound.getVol("music")*Sound.MUSTRIM).toFixed(3)};
    });
    check(label+": live tick arms the age-2 anthem, el playing at master×music ("+JSON.stringify(armed)+")",
      armed.age===2&&armed.playing===true&&/age2\.ogg/.test(armed.src)&&Math.abs(armed.vol-armed.expected)<0.005);
    await page.close();
  }
  { // v123 THE BANDWIDTH BUDGET. The anthems were 49 MB of a 52 MB site and burned through
    // Netlify's free credits — every fresh phone load streams one. tools/music.sh re-encodes them;
    // this guards the NEXT song swap from silently putting it back. Raise MUSIC_BUDGET_MB
    // deliberately if the new tracks genuinely need it.
    const MUSIC_BUDGET_MB=32;
    let total=0, rows=[];
    for(let a=0;a<6;a++){
      const f=path.join(ROOT,"audio","music","age"+a+".ogg");
      const b=fs.existsSync(f)?fs.statSync(f).size:0;
      total+=b; rows.push("age"+a+" "+(b/1048576).toFixed(1));
    }
    const mb=total/1048576;
    check("v123 music budget: the six anthems total "+mb.toFixed(1)+" MB of "+MUSIC_BUDGET_MB+
      " ("+rows.join(" · ")+")", total>0&&mb<=MUSIC_BUDGET_MB);
  }
  await browser.close();srv.close();
  console.log(fails?fails+" BROWSER FAILURES":"BROWSER CHECK PASSED");
  process.exit(fails?1:0);
})().catch(e=>{console.error("BROWSER CHECK CRASHED:",e);process.exit(1);});
