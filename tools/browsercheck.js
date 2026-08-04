/* v107 browser check — NOT part of the shipped game.
   Verifies in real Chromium what the headless smoketest cannot:
   1) all 79 SFX OGGs decode (Sound._state.ready + buf count) on http AND file://
   2) all 6 music tracks (audio/music/age0-5.ogg) load + play through <audio>
   3) an in-page anthem actually starts when a fake live-game state is armed
   4) v129.3: the menu bed (audio/music/menu.ogg) loads, loops, and arms from renderFrame
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
    // v129.4 THE GATE, CHECKED BEFORE ANYTHING TOUCHES THE PAGE. The name screen is silent, and
    // this has to be asserted BEFORE the autoplay-unlock click below — a click at (400,300) on
    // the name screen is indistinguishable from the player pressing CONTINUE, and would arm the
    // bed before the check could see it stay off.
    const quiet=await page.evaluate(async()=>{
      await new Promise(r=>setTimeout(r,700)); // ~40 real frames of renderFrame with the gate shut
      const M=Sound._mm;
      return {screen:NET.screen,armed:NET.wantMenuBed(),playing:M.playing,fade:M.fade,el:!!M.el};
    });
    check(label+": the menu bed stays SILENT on the name screen, and no element is even built ("+
      JSON.stringify(quiet)+")",
      quiet.screen==="namescreen"&&quiet.armed===false&&quiet.playing===false&&
      quiet.fade===0&&quiet.el===false);
    await page.mouse.click(400,300); // autoplay unlock
    const ok=await page.waitForFunction(()=>typeof Sound!=="undefined"&&Sound._state.ready===true,null,{timeout:30000}).catch(()=>null);
    const nbuf=await page.evaluate(()=>[Object.keys(Sound._state.buf).length,Object.keys(Sound._defs).length]);
    check(label+": Sound ready & ALL "+nbuf[1]+" SFX decoded ("+nbuf[0]+")",!!ok&&nbuf[0]===nbuf[1]);
    const mus=await page.evaluate(async()=>{
      const out=[];
      // v129.3: "menu" rides the same loader as the six anthems — it is streamed the same way,
      // from the same folder, and a missing one is just as silent.
      for(const a of [0,1,2,3,4,5,"menu"]){
        out.push(await new Promise(res=>{
          const el=new Audio("audio/music/"+(a==="menu"?"menu":"age"+a)+".ogg");
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
    check(label+": all 6 anthems + the menu bed load & play ("+mus.map(m=>m.a+":"+(m.ok?m.dur+"s":m.err)).join(" · ")+")",mus.every(m=>m.ok));
    // v129.3 THE MENU BED, IN THE REAL FRAME. The point of this check is the WIRING, not the
    // file: renderFrame must be reaching Sound.menuTick while inMenu, and the element it arms
    // must be looping menu.ogg. Nothing asserts that headlessly, because renderFrame draws.
    // v129.4: and it must arm on the SHIELDS, so this presses CONTINUE the way the button does.
    const gate=await page.evaluate(()=>{
      NET.uiName();                             // exactly what the CONTINUE button calls
      return {screen:NET.screen,armed:NET.wantMenuBed()};
    });
    // DO NOT sleep a guessed interval here. The fade is driven by the frame's dt and tickBody
    // CLAMPS dt to 0.05, so 0.9s of fade costs AT LEAST 18 frames — and this container renders
    // the game at about 2 fps under swiftshader (deskcheck's own on-screen read-out says "2 fps"),
    // which puts a full fade nine seconds away in wall time. A 3s sleep caught it at 0.28 and
    // read as a bug in the game. Poll for the state instead; that is frame-rate-independent and
    // still fails loudly if the fade genuinely stalls.
    const full=await page.waitForFunction(()=>Sound._mm.fade>=1,null,{timeout:60000}).catch(()=>null);
    const bed=await page.evaluate(()=>{
      const MMs=Sound._mm;
      return {playing:MMs.playing,src:MMs.el?MMs.el.src:"",loop:MMs.el?MMs.el.loop:null,
        fade:+MMs.fade.toFixed(2),vol:MMs.el?+MMs.el.volume.toFixed(3):-1,
        expected:+(Sound.getVol("master")*Sound.getVol("music")*Sound.MUSTRIM).toFixed(3),
        menu:typeof inMenu==="undefined"?null:inMenu};
    });
    check(label+": CONTINUE opens the gate — renderFrame arms the looping bed and fades it up ("+
      JSON.stringify(gate)+" "+JSON.stringify(bed)+")",
      gate.screen==="startmenu"&&gate.armed===true&&!!full&&
      bed.playing===true&&/menu\.ogg/.test(bed.src)&&bed.loop===true&&bed.fade===1&&
      Math.abs(bed.vol-bed.expected)<0.005);
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
    // v129.3: the menu bed joins the tally, and it is the one track that deserves the most
    // scrutiny — an anthem streams when your age lands, but menu.ogg streams on EVERY launch,
    // before the player has done anything at all. Keep it small.
    const MUSIC_BUDGET_MB=32, MENU_BUDGET_MB=3;
    let total=0, rows=[];
    for(const a of [0,1,2,3,4,5,"menu"]){
      const stem=(a==="menu")?"menu":"age"+a;
      const f=path.join(ROOT,"audio","music",stem+".ogg");
      const b=fs.existsSync(f)?fs.statSync(f).size:0;
      total+=b; rows.push(stem+" "+(b/1048576).toFixed(1));
    }
    const mb=total/1048576;
    check("v123 music budget: the six anthems + the menu bed total "+mb.toFixed(1)+" MB of "+MUSIC_BUDGET_MB+
      " ("+rows.join(" · ")+")", total>0&&mb<=MUSIC_BUDGET_MB);
    const mf=path.join(ROOT,"audio","music","menu.ogg");
    const mbb=(fs.existsSync(mf)?fs.statSync(mf).size:0)/1048576;
    check("v129.3 menu bed: every launch streams it, so it stays under "+MENU_BUDGET_MB+" MB ("+
      mbb.toFixed(2)+" MB)", mbb>0&&mbb<=MENU_BUDGET_MB);
  }
  await browser.close();srv.close();
  console.log(fails?fails+" BROWSER FAILURES":"BROWSER CHECK PASSED");
  process.exit(fails?1:0);
})().catch(e=>{console.error("BROWSER CHECK CRASHED:",e);process.exit(1);});
