/* v116 dev-only: drive the mobile spike in an emulated phone — start a solo game, work the
   stick, the look drag and the action pad, and screenshot the result. Not part of the game.
   NOTE ON THE FPS NUMBER: this sandbox renders through swiftshader (software GL), so the frame
   rate here is meaningless as a phone prediction. What this harness proves is that the CONTROLS
   are wired and the layout fits — the real number has to come off John's actual handset. */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
const DEVICES=[
  {name:"phone",     w:844, h:390},  // iPhone-class, LANDSCAPE — the intended way to play
  {name:"portrait",  w:390, h:844},  // held upright: the game must rotate ITSELF into landscape
  {name:"tablet",    w:1180,h:820}
];
(async()=>{
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8132);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"]});
  let fails=0;
  const check=(n,c)=>{console.log((c?"  PASS":"  FAIL")+" — "+n);if(!c)fails++;};
  for(const dev of DEVICES){
    const ctx=await browser.newContext({viewport:{width:dev.w,height:dev.h},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    const page=await ctx.newPage();
    page.on("pageerror",e=>console.log("  PAGE ERROR ("+dev.name+"): "+e.message));
    await page.goto("http://localhost:8132/index.html?touch=1",{waitUntil:"load"});
    await page.waitForFunction(()=>typeof units!=="undefined",null,{timeout:30000});
    // the touch layer should have replaced pointer lock and stripped the post stack
    const boot=await page.evaluate(()=>({
      pad:!!document.getElementById("touchpad"),
      locked:mouseLocked, composer:!!composer, shadows:renderer.shadowMap.enabled,
      hide:HIDE_D, dpr:renderer.getPixelRatio()
    }));
    check(dev.name+": pad injected, pointer-lock bypassed, post stack + shadows off ("+JSON.stringify(boot)+")",
      boot.pad&&boot.locked===true&&boot.composer===false&&boot.shadows===false&&boot.hide<150);
    // v117: THE CANVAS MUST FILL THE SCREEN. v116 sized the renderer before the widened
    // <meta viewport> had applied, and the canvas stayed at a third of the display.
    await page.waitForTimeout(2400); // let the retry schedule finish
    const fitInfo=await page.evaluate(()=>{
      const c=renderer.domElement, r=c.getBoundingClientRect();
      return {cw:Math.round(r.width),ch:Math.round(r.height),vw:innerWidth,vh:innerHeight};
    });
    void fitInfo;
    // v119: FORCED LANDSCAPE. A portrait viewport must present a LANDSCAPE stage — John's phone
    // refuses to rotate (lock on / in-app browser), so the game rotates itself instead. There is
    // no hint and nothing to dismiss.
    const rot=await page.evaluate(()=>{
      const st=document.getElementById("tstage");
      const cs=getComputedStyle(st);
      return {rotated:document.documentElement.classList.contains("rotated"),
        stageW:Math.round(parseFloat(cs.width)),stageH:Math.round(parseFloat(cs.height)),
        xform:cs.transform!=="none",
        // offsetWidth is the LAYOUT size; getBoundingClientRect on a rotated element returns the
        // transposed on-screen box, which is not what we're asserting about
        canvasW:renderer.domElement.offsetWidth,canvasH:renderer.domElement.offsetHeight,
        aspect:+(camera.aspect).toFixed(3),
        noHint:!document.getElementById("trotate"),
        vw:innerWidth,vh:innerHeight};
    });
    const portraitDev=dev.h>dev.w;
    check(dev.name+": no rotate notice exists at all",rot.noHint);
    check(dev.name+": the stage is LANDSCAPE whichever way the phone is held ("+
      rot.stageW+"×"+rot.stageH+", rotated="+rot.rotated+")",
      rot.stageW>rot.stageH&&rot.rotated===portraitDev);
    check(dev.name+": the renderer is sized to the STAGE, not the window (canvas "+
      rot.canvasW+"×"+rot.canvasH+", camera aspect "+rot.aspect+")",
      Math.abs(rot.canvasW-rot.stageW)<=2&&Math.abs(rot.canvasH-rot.stageH)<=2&&rot.aspect>1);
    if(portraitDev){
      // the whole point of picking the viewport width: the rotated stage lands on the ~1180
      // logical width the HUD was tuned for, instead of a 390-px sliver or a 2500-px sheet
      check(dev.name+": the rotated stage lands near the HUD's design width ("+rot.stageW+")",
        rot.stageW>1000&&rot.stageW<1400);
    }
    // start a solo battle through the real menu.
    // v124: the name screen is GONE — you are auto-titled ("Alexander the Great") and land straight
    // on the start menu, where PLAY is the dominant button. Tapping the dead #btnname here used to
    // be step one; now it is a hidden element that only burns an actionability timeout.
    await page.waitForSelector("#btnsolo",{state:"visible",timeout:8000}).catch(()=>{});
    await page.tap("#btnsolo").catch(async()=>{ // fall back past any overlay hit-test
      await page.evaluate(()=>document.getElementById("btnsolo").click()).catch(()=>{});
    });
    await page.waitForTimeout(1600);
    const live=await page.evaluate(()=>({inMenu:typeof inMenu==="undefined"?null:inMenu,alive:!!(player&&player.alive)}));
    check(dev.name+": a solo battle starts from a tap ("+JSON.stringify(live)+")",live.inMenu===false&&live.alive===true);
    // ---- drive the controls with synthetic touches ----
    const drive=await page.evaluate(async(D)=>{
      const T=(el,x,y,id)=>{const t=new Touch({identifier:id,target:el,clientX:x,clientY:y});return t;};
      const fire=(el,type,touches)=>el.dispatchEvent(new TouchEvent(type,
        {bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:touches}));
      const zL=document.getElementById("tzL"), zR=document.getElementById("tzR");
      const p0={x:player.root.position.x,z:player.root.position.z}, yaw0=camYaw, pitch0=camPitch;
      // LEFT thumb: push the movement stick "forward". The zone lives inside the rotated stage,
      // so aim at its real on-screen box and push along the screen axis that maps to stage-up.
      const zb=zL.getBoundingClientRect();
      const rot=document.documentElement.classList.contains("rotated");
      const sx=zb.left+zb.width*0.4, sy=zb.top+zb.height*0.6;
      const fwd=rot?{x:60,y:0}:{x:0,y:-60}; // stage-up is screen-right once rotated clockwise
      fire(zL,"touchstart",[T(zL,sx,sy,1)]);
      fire(zL,"touchmove",[T(zL,sx+fwd.x,sy+fwd.y,1)]);
      const keysDown={w:keys.w,a:keys.a,s:keys.s,d:keys.d};
      await new Promise(r=>setTimeout(r,700));
      const moved=Math.hypot(player.root.position.x-p0.x,player.root.position.z-p0.z);
      fire(zL,"touchend",[T(zL,sx+fwd.x,sy+fwd.y,1)]);
      // RIGHT thumb: hold the LOOK stick over — it steers at a RATE, so the camera must keep
      // turning for as long as it's held rather than moving once per drag event
      const rb=zR.getBoundingClientRect();
      const rx=rb.left+rb.width*0.5, ry=rb.top+rb.height*0.6;
      fire(zR,"touchstart",[T(zR,rx,ry,2)]);
      fire(zR,"touchmove",[T(zR,rx+55,ry-40,2)]);
      const yawMid=camYaw;
      await new Promise(r=>setTimeout(r,600));
      const yawKeptTurning=Math.abs(camYaw-yawMid)>0.03;
      fire(zR,"touchend",[T(zR,rx+55,ry-40,2)]);
      const yawAfterRelease=camYaw;
      await new Promise(r=>setTimeout(r,250));
      const stoppedOnRelease=Math.abs(camYaw-yawAfterRelease)<0.01;
      // the pad
      const atk=document.getElementById("tb-atk"), blk=document.getElementById("tb-block");
      fire(blk,"touchstart",[T(blk,0,0,3)]);
      const blocking=rmbHeld;
      fire(blk,"touchend",[T(blk,0,0,3)]);
      const swing0=player.swing||0;
      fire(atk,"touchstart",[T(atk,0,0,4)]);
      // v120: lmbHeld is now recomputed once per FRAME as (manual || auto-fire), so give the
      // loop a frame before reading it rather than sampling the instant the touch lands
      await new Promise(r=>setTimeout(r,140));
      const attacked=lmbHeld;
      fire(atk,"touchend",[T(atk,0,0,4)]);
      await new Promise(r=>setTimeout(r,140));
      const releasedAtk=lmbHeld===false;
      // does the pad sit clear of the play area / is anything off-screen?
      // measure against the CSS viewport, not the device width — the touch layer widens the
      // virtual viewport to shrink the desktop HUD, so innerWidth is no longer the screen width
      const r=document.getElementById("tbtns").getBoundingClientRect();
      return {keysDown,moved:+moved.toFixed(2),dYaw:+(camYaw-yaw0).toFixed(3),
        dPitch:+(camPitch-pitch0).toFixed(3),blocking,attacked,swing:(player.swing||0)>=swing0,
        yawKeptTurning,stoppedOnRelease,releasedAtk,
        vw:innerWidth,vh:innerHeight,
        padOnScreen:r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.left>=0&&r.top>=0};
    },dev);
    check(dev.name+": the stick drives movement (keys "+JSON.stringify(drive.keysDown)+", walked "+drive.moved+")",
      drive.keysDown.w===true&&drive.moved>0.5);
    // thresholds are loose because this sandbox renders at a few fps and the per-frame dt is
    // capped — what matters is that it keeps turning while HELD and stops dead on release
    check(dev.name+": the RIGHT stick steers at a rate while held, and stops on release (yaw "+
      drive.dYaw+", pitch "+drive.dPitch+")",
      Math.abs(drive.dYaw)>0.05&&Math.abs(drive.dPitch)>0.03&&
      drive.yawKeptTurning===true&&drive.stoppedOnRelease===true);
    check(dev.name+": ATTACK and BLOCK set the same flags the mouse does, and release cleanly",
      drive.attacked===true&&drive.blocking===true&&drive.releasedAtk===true);
    check(dev.name+": the action pad sits fully on screen (css viewport "+drive.vw+"×"+drive.vh+")",drive.padOnScreen);
    // ---- v120: AUTO-GATHER + AUTO-ATTACK + the action grid ----
    const auto=await page.evaluate(async()=>{
      const T=(el,x,y,id)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});
      const fire=(el,type,touches)=>el.dispatchEvent(new TouchEvent(type,
        {bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:touches}));
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      // The drive test above walks the player through a live battlefield, so by now they may be
      // dead, mid-menu or holding a ghost. Reset to a known state or these checks are a coin toss.
      const reset=()=>{
        player.alive=true; player.hp=player.maxHp; player.respawnT=0;
        try{closeMenus();cancelPlacing();}catch(_){}
        keys.w=keys.a=keys.s=keys.d=keys.e=false; lmbHeld=rmbHeld=false;
        player.gathering=null;
      };
      reset();
      // AUTO-GATHER: stand a villager next to a live tree and touch nothing at all
      setClass(player,"villager");
      const tree=nodes.find(n=>n.type==="wood"&&n.amount>50);
      player.carry.food=player.carry.gold=player.carry.stone=player.carry.wood=0;
      player.root.position.set(tree.x+1.4,terrainHeight(tree.x+1.4,tree.z),tree.z);
      player.gathering=null;
      // and clear the ground of anything that would (correctly) interrupt the work
      for(const v of units)if(v.alive&&v.team!==player.team&&
        Math.hypot(v.root.position.x-player.root.position.x,v.root.position.z-player.root.position.z)<14)v.alive=false;
      await wait(400);
      const gathering=!!player.gathering;
      const cls=player.cls, dist=+Math.hypot(player.root.position.x-tree.x,player.root.position.z-tree.z).toFixed(2);
      const woodBefore=player.carry.wood;
      const nodeBefore=player.gathering?player.gathering.amount:-1;
      // POLL, don't guess: software GL runs this at a few fps and a fixed wait is a coin toss
      let chopped=false;
      for(let i=0;i<40&&!chopped;i++){await wait(250);chopped=player.carry.wood>woodBefore;}
      const nodeAfter=player.gathering?player.gathering.amount:-1;
      const gT=player.gathering?+(player.gatherT||0).toFixed(2):-1;
      // AUTO-ATTACK: an enemy walks into reach — the work stops, the body turns, the arm swings
      const yaw0=camYaw;
      const foe=makeUnit(1,"clubman",player.root.position.x+1.2,player.root.position.z,{name:"Foe",bot:null});
      foe.alive=true; foe.hp=foe.maxHp;
      setClass(player,"clubman");
      await wait(900);
      const facingFoe=Math.abs(Math.atan2(foe.root.position.x-player.root.position.x,
        foe.root.position.z-player.root.position.z)-player.facing)<0.35;
      const cameraUntouched=Math.abs(camYaw-yaw0)<1e-9;
      const hurt=foe.hp<foe.maxHp;
      const stoppedGathering=!player.gathering;
      foe.alive=false;
      // AUTO-ATTACK MUST NOT RAZE: a building in reach with no enemy unit stays untouched
      const bld=makeBuilding(1,"house",player.root.position.x+1.6,player.root.position.z,true);
      const bhp=bld.hp; await wait(700);
      const buildingSafe=bld.hp===bhp; bld.alive=false;
      // the action grid
      const mb=document.getElementById("tb-menu");
      fire(mb,"touchstart",[T(mb,0,0,9)]); fire(mb,"touchend",[T(mb,0,0,9)]);
      await wait(120);
      const gridUp=document.getElementById("tgrid").classList.contains("on");
      const gridBtns=document.querySelectorAll("#tgrid .tgb").length;
      const gr=document.querySelector("#tgrid .tgwrap").getBoundingClientRect();
      const gridFits=gr.width<=innerWidth&&gr.height<=innerHeight;
      fire(mb,"touchstart",[T(mb,0,0,10)]); fire(mb,"touchend",[T(mb,0,0,10)]);
      await wait(120);
      const gridClosed=!document.getElementById("tgrid").classList.contains("on");
      return {gathering,chopped,cls,dist,carry:player.carry.wood,nodeBefore,nodeAfter,gT,facingFoe,cameraUntouched,hurt,stoppedGathering,buildingSafe,
        gridUp,gridBtns,gridFits,gridClosed,big:document.getElementById("tb-atk").textContent};
    });
    check(dev.name+": AUTO-GATHER — walking up to a tree starts the axe with no input (gathering="+
      auto.gathering+", chopped="+auto.chopped+", cls="+auto.cls+", carry="+auto.carry+", node "+auto.nodeBefore+"->"+auto.nodeAfter+", gatherT="+auto.gT+")",
      auto.gathering&&auto.chopped);
    check(dev.name+": AUTO-ATTACK — the body turns and swings, the CAMERA never moves",
      auto.facingFoe&&auto.hurt&&auto.cameraUntouched);
    check(dev.name+": an enemy interrupts the gathering",auto.stoppedGathering);
    check(dev.name+": auto-attack never razes a building on its own",auto.buildingSafe);
    check(dev.name+": the \u2630 grid opens, fits the screen and closes ("+auto.gridBtns+" actions)",
      auto.gridUp&&auto.gridBtns>=8&&auto.gridFits&&auto.gridClosed);
    // ---- v121: safe area, placement buttons, AIM as a toggle, a quiet feed ----
    const v121=await page.evaluate(async()=>{
      const T=(el,x,y,id)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});
      const fire=(el,type,touches)=>el.dispatchEvent(new TouchEvent(type,
        {bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:touches}));
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const st=document.getElementById("tstage");
      const vars=["--sl","--st","--sr","--sb"].map(v=>st.style.getPropertyValue(v).trim());
      // THE FEED: shout ten times and only three may survive, none of them tall
      for(let i=0;i<10;i++)msg("Line number "+i+" — a long tutorial hint that would otherwise wrap over the battlefield and hide it entirely.");
      await wait(200);
      const feed=document.getElementById("feed");
      const feedKids=feed.children.length;
      // offsetHeight, not the rect — inside the rotated stage getBoundingClientRect returns the
      // TRANSPOSED on-screen box, so a 360px-wide 34px-tall line reports a height of 360.
      const msgH=feed.children.length?feed.children[0].offsetHeight:0;
      // MSG DE-DUPE: the same warning five times leaves one
      while(feed.firstChild)feed.removeChild(feed.firstChild);
      for(let i=0;i<5;i++)msgOnce("identical warning");
      await wait(120);
      const dedup=feed.children.length;
      // AIM IS A TOGGLE for an archer, a HOLD for a clubman
      setClass(player,"archer"); await wait(120);
      const blk=document.getElementById("tb-block");
      const aimLabel=blk.textContent;
      fire(blk,"touchstart",[T(blk,0,0,20)]); fire(blk,"touchend",[T(blk,0,0,20)]);
      await wait(120);
      const latchedOn=rmbHeld;                       // still aiming after the finger lifted
      fire(blk,"touchstart",[T(blk,0,0,21)]); fire(blk,"touchend",[T(blk,0,0,21)]);
      await wait(120);
      const latchedOff=rmbHeld===false;
      setClass(player,"clubman"); await wait(150);
      const blockLabel=blk.textContent;
      fire(blk,"touchstart",[T(blk,0,0,22)]);
      const holdOn=rmbHeld;
      fire(blk,"touchend",[T(blk,0,0,22)]);
      const holdOff=rmbHeld===false;
      // PLACEMENT: rotate and cancel exist only while a ghost is down
      const rotBtn=document.getElementById("tb-rot"), canBtn=document.getElementById("tb-cancel");
      const hiddenIdle=rotBtn.classList.contains("hide")&&canBtn.classList.contains("hide");
      player.alive=true; player.hp=player.maxHp;      // a corpse cannot lay a foundation
      try{closeMenus();cancelPlacing();}catch(_){}
      setClass(player,"villager"); await wait(150);   // ...nor can a clubman
      stock[player.team].wood+=500;                   // ...nor a pauper
      pickBuild("house");                             // the menu key path isn't what this tests
      await wait(250);
      const placingNow=!!placing;
      const dbg={menuOpen:typeof menuOpen==="undefined"?null:menuOpen,cat:typeof buildMenuCat==="undefined"?"?":buildMenuCat};
      const shown=!rotBtn.classList.contains("hide")&&!canBtn.classList.contains("hide");
      const bigIsPlace=document.getElementById("tb-atk").textContent==="PLACE";
      const rot0=placing?(placing.rot||0):0;
      fire(rotBtn,"touchstart",[T(rotBtn,0,0,23)]); fire(rotBtn,"touchend",[T(rotBtn,0,0,23)]);
      await wait(120);
      const turned=placing&&Math.abs((placing.rot||0)-rot0)>0.5;
      fire(canBtn,"touchstart",[T(canBtn,0,0,24)]); fire(canBtn,"touchend",[T(canBtn,0,0,24)]);
      await wait(200);
      const cancelled=!placing;
      return {dbg,vars,feedKids,msgH:Math.round(msgH),dedup,aimLabel,latchedOn,latchedOff,
        blockLabel,holdOn,holdOff,hiddenIdle,placingNow,shown,bigIsPlace,turned,cancelled};
    });
    check(dev.name+": safe-area insets are mapped onto the rotated stage ("+v121.vars.join("/")+")",
      v121.vars.length===4&&v121.vars.every(v=>/px$/.test(v)));
    check(dev.name+": the feed stays short and each line is clamped ("+v121.feedKids+" lines, "+v121.msgH+"px tall)",
      v121.feedKids<=3&&v121.msgH>0&&v121.msgH<52);
    check(dev.name+": five identical warnings leave one ("+v121.dedup+")",v121.dedup===1);
    check(dev.name+": AIM latches for an archer ("+v121.aimLabel+"), BLOCK is a hold for melee ("+v121.blockLabel+")",
      v121.aimLabel==="AIM"&&v121.latchedOn===true&&v121.latchedOff===true&&
      v121.blockLabel==="BLOCK"&&v121.holdOn===true&&v121.holdOff===true);
    check(dev.name+": placing a foundation reveals ROTATE + CANCEL and the big button says PLACE ("+
      JSON.stringify(v121.dbg)+" placing="+v121.placingNow+" shown="+v121.shown+" big="+v121.bigIsPlace+")",
      v121.hiddenIdle&&v121.placingNow&&v121.shown&&v121.bigIsPlace);
    check(dev.name+": the foundation turns, and CANCEL abandons it",v121.turned&&v121.cancelled);
    // ---- v122: the scoreboard, and menus that fit ----
    const v122=await page.evaluate(async()=>{
      const T=(el,x,y,id)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});
      const fire=(el,type,touches)=>el.dispatchEvent(new TouchEvent(type,
        {bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:touches}));
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const sb=document.getElementById("scoreboard");
      const mb=document.getElementById("tb-menu");
      // the SCOREBOARD is a held Tab on desktop — a phone has neither, so the grid toggles it
      fire(mb,"touchstart",[T(mb,0,0,30)]); fire(mb,"touchend",[T(mb,0,0,30)]); await wait(150);
      const entry=[...document.querySelectorAll("#tgrid .tgb")].find(b=>/Scores/.test(b.textContent));
      // v124 THE THREE ESCAPES. v122 asserted the scoreboard OPENED and stopped there — which is
      // precisely why John shipped a build where it could never be closed. The grid sat at z-index
      // 45 under the scoreboard's 55, both centred, so the toggle was correct and buried. Assert
      // every way out, and assert the grid actually wins the stack.
      const tap=async(el,id)=>{fire(el,"touchstart",[T(el,0,0,id)]);fire(el,"touchend",[T(el,0,0,id)]);await wait(180);};
      const shown=()=>getComputedStyle(sb).display!=="none";
      let on=false,off=false,fits=false,offTap=false,offMenu=false,above=false;
      if(entry){
        await tap(entry,31);
        on=shown();
        {const s0=document.getElementById("tstage");
         fits=sb.offsetHeight<=(s0?s0.offsetHeight:innerHeight)&&
              sb.offsetWidth <=(s0?s0.offsetWidth :innerWidth);}
        // the grid must sit ABOVE the scoreboard, or its own entry is unreachable
        above=parseInt(getComputedStyle(document.getElementById("tgrid")).zIndex||0,10)
             > parseInt(getComputedStyle(sb).zIndex||0,10);
        // escape 1: tap the panel itself
        await tap(sb,32);
        offTap=!shown();
        // escape 2: the menu button closes it rather than opening the grid over it
        if(!offTap)await tap(sb,33);
        await tap(entry,34);                       // re-open through the grid entry
        if(!shown()){ await tap(mb,35); const e=[...document.querySelectorAll("#tgrid .tgb")]
          .find(b=>/Scores/.test(b.textContent)); if(e)await tap(e,36); }
        await tap(mb,37);
        offMenu=!shown();
        off=offTap&&offMenu;
      }
      // EVERY build category must fit the stage — Defensive has the most rows and ran off the
      // bottom of John's phone
      const bm=document.getElementById("buildmenu");
      const sizes=[];
      for(const cat of Object.keys(BUILD_CATS)){
        closeMenus(); openBuildMenu(); buildMenuCat=cat; renderBuildMenu(); await wait(90);
        sizes.push([cat,bm.offsetHeight,bm.offsetWidth]);
      }
      closeMenus();
      const worst=sizes.reduce((a,b)=>b[1]>a[1]?b:a,sizes[0]);
      // v124: measure against the STAGE, not the viewport. Inside the rotated stage innerWidth is
      // the SHORT edge, so a picker that correctly fills a 1180x545 battlefield reads as 1180 wide
      // against a 545 "viewport" and fails. Third time this transposition has cost a cycle — the
      // rule is the same every time: layout inside #tstage is measured in stage space.
      const st=document.getElementById("tstage");
      const sw=st?st.offsetWidth:innerWidth, sh=st?st.offsetHeight:innerHeight;
      return {hasEntry:!!entry,on,off,fits,offTap,offMenu,above,worst,vh:sh,vw:sw,
        allFit:sizes.every(x=>x[1]<=sh+2&&x[2]<=sw+2)};
    });
    check(dev.name+": the scoreboard opens from the grid and FITS ("+v122.hasEntry+"/"+v122.on+")",
      v122.hasEntry&&v122.on&&v122.fits);
    check(dev.name+": v124 the scoreboard CLOSES — tap the panel ("+v122.offTap+
      ") and the menu button ("+v122.offMenu+")",v122.off);
    check(dev.name+": v124 the action grid outranks the scoreboard in the stack",v122.above);
    // ---- v124: the contextual rail, the picker's escape hatch, the one-line HUD ----
    const v124=await page.evaluate(async()=>{
      const T=(el,x,y,id)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});
      const fire=(el,type,touches)=>el.dispatchEvent(new TouchEvent(type,
        {bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:touches}));
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const rail=()=>[...document.querySelectorAll("#tctx .tctxb")].map(b=>b.textContent);
      closeMenus();
      await wait(300);
      // AGE UP must be absent when the stockpile cannot pay, and present when it can — John's rule
      const tc=teamTC(MYTEAM);
      player.root.position.x=tc.x+2; player.root.position.z=tc.z+2;
      for(const k in stock[MYTEAM])stock[MYTEAM][k]=0;
      await wait(320);
      const poor=rail();
      const cost=AGES[teamAge[MYTEAM]+1].cost;
      for(const k in cost)stock[MYTEAM][k]=cost[k]+500;
      await wait(320);
      const rich=rail();
      const capped=rich.length<=3;
      // the core three never move
      const core=["tb-atk","tb-block","tb-menu"].every(id=>{
        const e=document.getElementById(id); return e&&getComputedStyle(e).display!=="none";});
      // the picker: opens full-stage, and CLOSE actually closes it
      openBuildMenu(); await wait(260);
      const pc=document.getElementById("tpickclose");
      const closeShown=getComputedStyle(pc).display!=="none";
      const bm=document.getElementById("buildmenu");
      const tile=bm.querySelector(".opt");
      const tileH=tile?tile.offsetHeight:0;
      fire(pc,"touchend",[T(pc,0,0,60)]); await wait(260);
      const closed=!menuOpen&&getComputedStyle(bm).display==="none";
      // the HUD strip: resources and the age bar share a line, the map hides behind its button
      const res=document.getElementById("resources"), age=document.getElementById("agebar");
      const sameLine=Math.abs(res.offsetTop-age.offsetTop)<6&&age.offsetLeft>res.offsetLeft;
      const mapHidden=getComputedStyle(document.getElementById("minimapwrap")).display==="none";
      const mb=document.getElementById("tmap");
      fire(mb,"touchend",[T(mb,0,0,61)]); await wait(220);
      const mapShown=getComputedStyle(document.getElementById("minimapwrap")).display!=="none";
      fire(mb,"touchend",[T(mb,0,0,62)]); await wait(160);
      // the banner promotes a warn line out of the feed
      msg("⚠ YOUR KING IS BADLY WOUNDED","warn"); await wait(240);
      const bn=document.getElementById("tbanner");
      return {poor,rich,capped,core,closeShown,closed,tileH,sameLine,mapHidden,mapShown,
        banner:bn.classList.contains("on"),feed:document.getElementById("feed").children.length};
    });
    check(dev.name+": v124 rail — AGE UP appears ONLY when the team can pay ("+
      JSON.stringify(v124.poor)+" -> "+JSON.stringify(v124.rich)+")",
      !v124.poor.includes("AGE UP")&&v124.rich.includes("AGE UP"));
    check(dev.name+": v124 rail — at most three contextual slots, core three always present",
      v124.capped&&v124.core);
    check(dev.name+": v124 picker — CLOSE exists while a menu is open and shuts it ("+
      v124.closeShown+"/"+v124.closed+")",v124.closeShown&&v124.closed);
    check(dev.name+": v124 picker — tiles are real touch targets ("+v124.tileH+"px tall)",
      v124.tileH>=44);
    check(dev.name+": v124 HUD — resources and the age bar share one line",v124.sameLine);
    check(dev.name+": v124 HUD — the map hides behind its button and toggles ("+
      v124.mapHidden+"/"+v124.mapShown+")",v124.mapHidden&&v124.mapShown);
    check(dev.name+": v124 HUD — a warn line is promoted to the banner, feed stays short ("+
      v124.feed+")",v124.banner&&v124.feed<=2);
    check(dev.name+": every build category fits the stage (worst: "+v122.worst[0]+" "+
      v122.worst[2]+"×"+v122.worst[1]+" in "+v122.vw+"×"+v122.vh+")",v122.allFit);
    await page.waitForTimeout(1200);
    const fps=await page.evaluate(()=>document.getElementById("tfps").textContent);
    console.log("  "+dev.name+" read-out: "+fps+"   (software GL — NOT a phone prediction)");
    await page.screenshot({path:path.join(ROOT,"tools","shot_mobile_"+dev.name+".png")});
    await ctx.close();
  }
  {
    // ---- v121: the four bugs John found playing from the Home Screen ----
    const inp=fs.readFileSync(path.join(ROOT,"js","06-input.js"),"utf8");
    // strip // comments first — the explanatory note above costText QUOTES the old buggy line,
    // and the first version of this check happily failed on my own documentation
    const code=inp.split("\n").filter(l=>!/^\s*\/\//.test(l)).join("\n");
    check("v121 cost text: no menu hardcodes food+gold any more (siege costs gold + WOOD)",
      /function costText\(/.test(code)&&!/cost\.food\+" food"/.test(code)&&!/cost\.food\+' food'/.test(code));
    check("v121 feed: repeated identical lines are swallowed (msgOnce)",
      /function msgOnce\(/.test(inp)&&/msgOnce\("The team stockpile can't afford/.test(inp));
  }
  {
    // ---- v120: PWA, so "Add to Home Screen" launches chrome-free on iPhone ----
    const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
    const man=JSON.parse(fs.readFileSync(path.join(ROOT,"manifest.json"),"utf8"));
    check("v120 pwa: index links a manifest and carries the Apple fullscreen meta",
      /rel="manifest"/.test(html)&&/apple-mobile-web-app-capable" content="yes"/.test(html)&&
      /apple-touch-icon/.test(html));
    check("v120 pwa: the manifest asks for fullscreen landscape with real icons ("+
      man.display+" / "+man.orientation+" / "+man.icons.length+" icons)",
      man.display==="fullscreen"&&man.orientation==="landscape"&&man.icons.length>=2&&
      man.icons.every(i=>fs.existsSync(path.join(ROOT,i.src))));
  }
  {
    // v119: John asked for HALF the right-stick sensitivity. Frame rate can't be trusted to
    // measure that in here, so assert the constants themselves.
    const src=fs.readFileSync(path.join(ROOT,"js","12-touch.js"),"utf8");
    const rx=/LOOK_RATE_X=([\d.]+),\s*LOOK_RATE_Y=([\d.]+)/.exec(src);
    check("look sensitivity halved from v117 (x "+(rx&&rx[1])+" was 2.9, y "+(rx&&rx[2])+" was 2.1)",
      !!rx&&Math.abs(+rx[1]-1.45)<1e-6&&Math.abs(+rx[2]-1.05)<1e-6);
  }
  await browser.close(); srv.close();
  console.log(fails?"\n"+fails+" MOBILE FAILURES":"\nMOBILE SPIKE OK");
  process.exit(fails?1:0);
})().catch(e=>{console.error("MOBILE CHECK CRASHED:",e);process.exit(1);});
