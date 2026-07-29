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
    // ---- v124.1: the MAIN MENU has to fit the stage, and every overlay has to out-rank it ----
    const menu=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const sm=document.getElementById("startmenu");
      const fits=()=>sm.scrollHeight<=sm.offsetHeight+2;
      const scrolls=getComputedStyle(sm).overflowY==="auto"||
                    getComputedStyle(sm).overflowY==="scroll";
      const h1=sm.querySelector("h1");
      // at rest NOTHING may be clipped: John lost the title off the top and the version off the
      // bottom, because .overlay centres its content and never scrolled
      const atRest=fits()&&h1.offsetTop>=0&&h1.offsetTop<sm.offsetHeight;
      // and once every disclosure is open it must at least be REACHABLE by scrolling
      document.getElementById("btnfriends").click(); await wait(200);
      const friendsFit=fits();
      document.getElementById("btnhost").click(); await wait(200);
      document.getElementById("btnjoin").click(); await wait(260);
      const reachable=scrolls;                       // expanded rows may overflow, but must scroll
      // AUDIO OPTIONS must land ON TOP of the menu, not behind it
      document.getElementById("btnoptions").click(); await wait(260);
      const os=document.getElementById("optionsscreen"), box=document.getElementById("optbox");
      const r=box.getBoundingClientRect();
      const hit=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
      const audioOnTop=getComputedStyle(os).display!=="none"&&!!hit&&os.contains(hit)&&
        (+getComputedStyle(os).zIndex>+getComputedStyle(sm).zIndex);
      document.getElementById("btnoptback").click(); await wait(200);
      // the dice rolls a NEW name in John's format
      const before=document.getElementById("myname").textContent;
      let changed=false;
      for(let i=0;i<6&&!changed;i++){
        document.getElementById("btnreroll").click(); await wait(90);
        changed=document.getElementById("myname").textContent!==before;
      }
      const after=document.getElementById("myname").textContent;
      // put the menu back the way we found it
      document.getElementById("btnjoin").click();
      const hr=document.getElementById("hostrow"); if(hr)hr.style.display="none";
      const jr=document.getElementById("joinrow"); if(jr)jr.style.display="none";
      await wait(150);
      return {atRest,friendsFit,reachable,audioOnTop,changed,shaped:/ the /.test(after),after};
    });
    check(dev.name+": v124.1 menu — nothing is clipped at rest and PLAY WITH FRIENDS still fits",
      menu.atRest&&menu.friendsFit);
    check(dev.name+": v124.1 menu — every disclosure open, the menu is still reachable by scroll",
      menu.reachable);
    check(dev.name+": v124.1 menu — AUDIO OPTIONS opens ON TOP of the start menu, not behind it",
      menu.audioOnTop);
    check(dev.name+": v124.1 menu — the dice rolls a fresh <Name> the <Epithet> ("+menu.after+")",
      menu.changed&&menu.shaped);

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
      const mapEl2=document.getElementById("minimapwrap");
      const mapShown=getComputedStyle(mapEl2).display!=="none";
      // v124.8: and it must open TOP-RIGHT, clear of the button rail — v124.6 dropped it straight
      // under ATTACK, the one place a thumb is guaranteed to be
      const mmB=[mapEl2.offsetLeft,mapEl2.offsetTop,mapEl2.offsetWidth,mapEl2.offsetHeight];
      const railEl=document.getElementById("tbtns");
      const railB=[railEl.offsetLeft,railEl.offsetTop,railEl.offsetWidth,railEl.offsetHeight];
      const mapClear=mmB[1]<130&&(mmB[0]+mmB[2]<=railB[0]||railB[0]+railB[2]<=mmB[0]||
        mmB[1]+mmB[3]<=railB[1]||railB[1]+railB[3]<=mmB[1]);
      const mapDbg=JSON.stringify({mmB,railB});
      fire(mb,"touchend",[T(mb,0,0,62)]); await wait(160);
      // the banner promotes a warn line out of the feed
      msg("⚠ YOUR KING IS BADLY WOUNDED","warn"); await wait(240);
      const bn=document.getElementById("tbanner");
      return {poor,rich,capped,core,closeShown,closed,tileH,sameLine,mapHidden,mapShown,mapClear,mapDbg,
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
    // ---- v124.1: John's four field-test notes ----
    const v1241=await page.evaluate(async()=>{
      const T=(el,x,y,id)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});
      const fire=(el,t,tt)=>el.dispatchEvent(new TouchEvent(t,
        {bubbles:true,cancelable:true,touches:tt,targetTouches:tt,changedTouches:tt}));
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      closeMenus(); await wait(200);
      // 1. ONE SOLID BAR — the four HUD panels are segments of a single strip, all on one row
      const bar=document.getElementById("tbar");
      // offsetTop/offsetHeight, NOT getBoundingClientRect: inside the rotated stage the rect is the
      // TRANSPOSED on-screen box, so a bar that is correctly one row deep reads as 490 tall in
      // portrait. Fourth time this has cost a cycle. Layout inside #tstage is measured in LAYOUT
      // space; the bar is position:absolute, so it is its children's offsetParent.
      // v124.10: the strip gained two balance-group wrappers, so the segments are grandchildren.
      // Ask about the LEAF segments and about containment, not direct parentage.
      const segIds=["resources","agebar","roster","playerhud","kings"];
      const vis=bar?segIds.map(id=>document.getElementById(id))
        .filter(c=>c&&getComputedStyle(c).display!=="none"):[];
      // offsetTop, NOT getBoundingClientRect: inside the rotated portrait stage the rect is the
      // transposed on-screen box. The balance-group wrappers are position:static, so a segment's
      // offsetParent is still #tbar and offsetTop already means what we want. FIFTH time this
      // transposition has cost a cycle — the rule never changes: layout inside #tstage is
      // measured in LAYOUT space.
      const oneRow=!!bar&&vis.length>0&&vis.every(c=>
        c.offsetTop>=-3&&c.offsetTop+c.offsetHeight<=bar.offsetHeight+3);
      const holds=bar?segIds.every(id=>bar.contains(document.getElementById(id))):false;
      // 2. a promoted line leaves the feed — it must not read twice on one screen
      const feed=document.getElementById("feed");
      feed.innerHTML="";
      // v124.7: use a line the ALLOW-list actually promotes. Routine AI chatter deliberately stays
      // in the feed now, so testing the move with "Red riders wheel toward..." tested the old rule.
      msg("⚑ Blue advances to the BRONZE AGE!","gold");
      await wait(260);
      const noDup=feed.children.length===0&&
        /BRONZE/.test(document.getElementById("tbanner").textContent);
      // 3. the picker's CLOSE must be the TOPMOST thing at its own centre. It shipped inside
      //    #touchpad (z-index:30 => its own stacking context) so its z-index:57 could not climb
      //    past the menu's 52 — it rendered underneath and John could not leave the build menu.
      openBuildMenu(); await wait(260);
      const pc=document.getElementById("tpickclose");
      const pr=pc.getBoundingClientRect();
      const hit=document.elementFromPoint(Math.round(pr.left+pr.width/2),
                                          Math.round(pr.top+pr.height/2));
      const reachable=getComputedStyle(pc).display!=="none"&&hit===pc&&
        pc.parentElement.id==="tstage";
      fire(pc,"touchend",[T(pc,0,0,70)]); await wait(220);
      const escaped=!menuOpen;
      // 4. THE DRAW ON THE STICK — one thumb must charge the bow AND steer the camera
      setClass(player,"archer"); player.atkT=0; player._drawT=0;
      const blk=document.getElementById("tb-block");
      fire(blk,"touchstart",[T(blk,0,0,71)]); fire(blk,"touchend",[T(blk,0,0,71)]);
      await wait(220);
      const zR=document.getElementById("tzR"), rb=zR.getBoundingClientRect();
      const sx=rb.left+rb.width*0.5, sy=rb.top+rb.height*0.5;
      // push along BOTH screen axes: which one maps to yaw depends on the stage rotation, and a
      // portrait drag along +x is pure pitch. What matters is that the camera moved at all.
      const yaw0=camYaw, pitch0=camPitch;
      fire(zR,"touchstart",[T(zR,sx,sy,72)]); await wait(120);
      for(let i=1;i<=8;i++){fire(zR,"touchmove",[T(zR,sx+i*7,sy+i*5,72)]); await wait(105);}
      const drew=player._drawT||0, fill=drawFill();
      const camMoved=Math.abs(camYaw-yaw0)+Math.abs(camPitch-pitch0);
      fire(zR,"touchend",[T(zR,sx+56,sy+40,72)]); await wait(320);
      // a loosed shot is proved by the cooldown the launch sets, not by counting projectiles —
      // those get culled by range and life on their own schedule
      // v124.2: the kings joined the bar, and NOTHING in the top band may overlap. John had the
      // bar, the two king boxes and the fps read-out all stacked on the same line.
      const bx=el=>[el.offsetLeft,el.offsetTop,el.offsetWidth,el.offsetHeight];
      const ov=(a,b)=>!(a[0]+a[2]<=b[0]||b[0]+b[2]<=a[0]||a[1]+a[3]<=b[1]||b[1]+b[3]<=a[1]);
      // v124.4: the read-out and the map moved INSIDE the bar, so "do they overlap it" is now the
      // wrong question — they are nested by design. What must hold instead is that both are
      // CHILDREN of the bar (nothing left floating in the top band to collide with it) and that
      // the bar spans the stage.
      const topEl=document.getElementById("ttop"), mapEl=document.getElementById("tmap");
      const barB=bx(bar),topB=bx(topEl),mapB=bx(mapEl);
      const swallowed=bar.contains(topEl)&&bar.contains(mapEl);
      const spansStage=bar.offsetWidth>=document.getElementById("tstage").offsetWidth-4;
      const kingsIn=bar.contains(document.getElementById("kings"));
      // v124.3 THE CROWN IS THE METER — it must track the king's health, keep the right glyph, and
      // stop keeping a separate bar. The glyph check matters: the first version re-read ownership
      // from its own rewritten text, so every crown flipped to the enemy's on the next observer
      // tick — a rule that destroyed the evidence it depended on.
      const l0=document.querySelector("#kb0 .lbl"), l1=document.querySelector("#kb1 .lbl");
      kings[0].hp=kings[0].maxHp*0.62; kings[1].hp=kings[1].maxHp*0.18;
      await wait(140);
      const hp0=parseFloat(l0.style.getPropertyValue("--hp")),
            hp1=parseFloat(l1.style.getPropertyValue("--hp"));
      const hurt=l1.classList.contains("hurt")&&!l0.classList.contains("hurt");
      kings[0].hp=kings[0].maxHp; kings[1].hp=kings[1].maxHp;
      await wait(160);
      const refilled=parseFloat(l0.style.getPropertyValue("--hp"))>99;
      const glyphs=l0.textContent.trim()==="♔"&&l1.textContent.trim()==="♚";
      const noBar=getComputedStyle(document.querySelector("#kb0 .bar")).display==="none";
      const clipped=(getComputedStyle(l0).webkitBackgroundClip||
                     getComputedStyle(l0).backgroundClip)==="text";
      // force the WORST case before measuring: every transient segment visible at once. That is
      // the state that clipped the kings, and a check that only ever sees the quiet bar is useless.
      const carryEl=document.getElementById("carry"), rosterEl=document.getElementById("roster");
      const c0=carryEl.className, r0=rosterEl.className;
      carryEl.classList.remove("thidden"); rosterEl.classList.remove("thidden");
      await wait(60);
      const kEl=document.getElementById("kings");
      const kingsInside=kEl.offsetLeft+kEl.offsetWidth<=bar.offsetWidth+2&&kEl.offsetLeft>=-2;
      carryEl.className=c0; rosterEl.className=r0;
      // inside the bar they must still not sit on top of EACH OTHER
      const topClean=swallowed&&spansStage&&!ov(topB,mapB);
      // ---- v124.6: the strip moved to the BOTTOM and the feed to the TOP ----
      const stg=document.getElementById("tstage");
      const hudB=bx(document.getElementById("playerhud"));
      const btnsEl=document.getElementById("tbtns");
      const btnB=bx(btnsEl);
      const feedB=bx(document.getElementById("feed"));
      const zLB=bx(document.getElementById("tzL"));
      // v124.7: FLUSH to the physical edge, not to the safe-area inset — the inset is padding
      // inside the bar now, so no strip of battlefield shows under it
      const atBottom=barB[1]+barB[3]>=stg.offsetHeight-1;
      // v124.9: the unit panel is a SEGMENT of the strip now, not a box stacked above it — so the
      // question changed from "does it clear the bar" to "is it in the bar". The button rail is
      // still stacked above.
      const hudEl=document.getElementById("playerhud");
      const hudInBar=hudEl.parentElement===bar;
      const stacked=hudInBar&&btnB[1]+btnB[3]<=barB[1]+2;
      // v124.10: and DEAD CENTRE, held there by the two equal-weight balance groups whatever
      // transient segments are showing — auto margins drifted 66px when the roster hid itself
      const hudCentred=Math.abs((hudEl.offsetLeft+hudEl.offsetWidth/2)-
        bar.offsetWidth/2)<6;
      // the active quest is pinned by the feed instead of buried in the action grid
      const qEl=document.getElementById("questhud"), fEl=document.getElementById("feed");
      const qcs=getComputedStyle(qEl);
      const questPinned=qcs.display!=="none"&&qEl.offsetTop<120&&
        qEl.offsetLeft<200&&qEl.offsetTop+qEl.offsetHeight<=fEl.offsetTop+2;
      // v124.11: dressed as a feed LINE — same background and left-border accent — and ONE line.
      // Compared against the .msg CONSTANTS rather than a live probe element: the feed's observer
      // trims itself to two children, so an injected probe was being removed before it could be
      // measured and getComputedStyle on the detached node returned nothing.
      // "one line" is a PROPERTY, not a measurement: line-height computes to "normal" here, so
      // parseFloat gave NaN and every comparison against it was quietly false. Assert the thing
      // that actually guarantees it — the text cannot wrap, and it is not overflowing.
      const questLikeMsg=qcs.backgroundColor==="rgba(30, 22, 12, 0.82)"&&
        qcs.borderLeftWidth==="4px"&&
        qcs.whiteSpace==="nowrap"&&qEl.scrollHeight<=qEl.clientHeight+2;
      const questDbg=JSON.stringify({bg:qcs.backgroundColor,bl:qcs.borderLeftWidth,
        h:qEl.offsetHeight,lh:qcs.lineHeight,fs:qcs.fontSize});
      // the health bar is a real bar now, not a token 56px sliver
      const hpBar=document.querySelector("#playerhud .bar");
      const hpWide=hpBar.offsetWidth>=120&&hpBar.offsetHeight>=11;
      // and the frame counter left the strip for the top centre, as bare lettering
      const fpsEl2=document.getElementById("tfps");
      const fpsOut=fpsEl2.parentElement.id==="tstage"&&
        fpsEl2.offsetTop<80&&
        getComputedStyle(fpsEl2).backgroundColor==="rgba(0, 0, 0, 0)";
      // your team only: no enemy composition, no repeated age name
      updateRoster();
      const rosterTxt=document.getElementById("roster").textContent;
      const rosterMine=!/BRONZE|STONE|IRON|CLASSICAL|MEDIEVAL|ENLIGHT/i.test(rosterTxt)&&
        (rosterTxt.match(/⛏/g)||[]).length===1&&(rosterTxt.match(/⚔/g)||[]).length===1;
      const feedTop=feedB[1]<stg.offsetHeight*0.35;
      // the thumb zones sit at z-index 30 against the bar's 22 — without a stop they would swallow
      // taps meant for the map and fullscreen buttons now living down there
      const zoneClears=zLB[1]+zLB[3]<=barB[1]+2;
      // ---- v124.6: the age line says two ages and YOUR clock, never theirs ----
      const foeTeam=(MYTEAM===BLUE)?RED:BLUE;
      teamAge[MYTEAM]=1; teamAge[foeTeam]=2;
      ageResT[MYTEAM]=0; ageResT[foeTeam]=0;
      updateAgeHud(); await wait(60);
      const quiet=document.getElementById("agebar").textContent;
      ageResT[foeTeam]=77;                      // THEIR advance must be invisible
      updateAgeHud(); await wait(60);
      const foeTicking=document.getElementById("agebar").textContent;
      ageResT[MYTEAM]=42;                       // MINE must show a countdown
      updateAgeHud(); await wait(60);
      const mineTicking=document.getElementById("agebar").textContent;
      ageResT[MYTEAM]=0; ageResT[foeTeam]=0; updateAgeHud();

      const ageOK=quiet===foeTicking&&                       // no enemy timer, ever
        !/\d+s/.test(quiet)&&/42s/.test(mineTicking)&&       // mine ticks, and only mine
        /BRONZE/.test(quiet)&&/IRON/.test(quiet)&&           // both ages named
        !/next:|Town Center|▰/.test(quiet);                  // the desktop copy is gone
      const topBoxes={bar:barB,ttop:topB,map:mapB,swallowed,spansStage,
        hits:ov(topB,mapB)?"ttop/map":""};
      const barOnStage=barB[0]+barB[2]<=document.getElementById("tstage").offsetWidth+2;
      return {oneRow,holds,noDup,reachable,escaped,drew,camMoved,fill,
        kingsIn,kingsInside,topClean,barOnStage,topBoxes,
        hp0,hp1,hurt,refilled,glyphs,noBar,clipped,
        atBottom,stacked,feedTop,zoneClears,ageOK,quiet,mineTicking,
        fpsOut,rosterMine,rosterTxt,hudCentred,questPinned,questLikeMsg,hpWide,questDbg,
        hpW:hpBar.offsetWidth,barH:bar.offsetHeight,

        shot:player.atkT>0,reset:player._drawT||0};
    });
    check(dev.name+": v124.1 HUD — resources, age, roster and carry are ONE strip on one row",
      v1241.oneRow&&v1241.holds);
    check(dev.name+": v124.1 feed — a promoted line is MOVED to the banner, never duplicated",
      v1241.noDup);
    check(dev.name+": v124.2 HUD — the king bars live IN the strip and are not clipped by it ("+
      v1241.kingsIn+"/"+v1241.kingsInside+")",v1241.kingsIn&&v1241.kingsInside);
    check(dev.name+": v124.3 crown — the glyph IS the health meter, draining as the king is hurt ("+
      v1241.hp0+"% / "+v1241.hp1+"%, refills "+v1241.refilled+", separate bar gone "+v1241.noBar+")",
      Math.abs(v1241.hp0-62)<1.5&&Math.abs(v1241.hp1-18)<1.5&&v1241.refilled&&
      v1241.noBar&&v1241.clipped);
    check(dev.name+": v124.3 crown — yours stays ♔ and theirs stays ♚, and a dying king pulses",
      v1241.glyphs&&v1241.hurt);
    check(dev.name+": v124.9 layout — the strip is at the BOTTOM, the unit panel is IN it and the "+
      "rail sits above",v1241.atBottom&&v1241.stacked);
    check(dev.name+": v124.10 layout — the unit panel sits DEAD CENTRE of the strip",
      v1241.hudCentred);
    check(dev.name+": v124.10 quest — the active posting is pinned above the feed, not buried in "+
      "the action grid",v1241.questPinned);
    check(dev.name+": v124.11 quest — styled as a feed line and kept to ONE line "+v1241.questDbg,
      v1241.questLikeMsg);
    check(dev.name+": v124.11 HUD — the health bar is full width ("+v1241.hpW+"px)",v1241.hpWide);
    check(dev.name+": v124.9 HUD — the frame counter is bare lettering at the top centre, out of "+
      "the strip",v1241.fpsOut);
    check(dev.name+": v124.9 roster — YOUR team only, no enemy composition, no repeated age (\""+
      v1241.rosterTxt+"\")",v1241.rosterMine);
    check(dev.name+": v124.6 layout — the feed moved to the top, and the thumb zones stop at the "+
      "strip so its buttons stay tappable",v1241.feedTop&&v1241.zoneClears);
    check(dev.name+": v124.8 layout — the strip is slim ("+v1241.barH+"px) and the map opens "+
      "top-right, clear of the button rail "+v124.mapDbg,v1241.barH<=40&&v124.mapClear);
    check(dev.name+": v124.6 age — your age, their age, and only YOUR countdown (\""+
      v1241.quiet+"\" -> \""+v1241.mineTicking+"\")",v1241.ageOK);
    // ---- v124.7 — its OWN evaluate. Sharing one page.evaluate with the checks above meant this
    // block inherited whatever they left behind (an AIM latch already on, a banner already showing,
    // a player standing on the town centre) and three unrelated checks started failing for reasons
    // that had nothing to do with the code under test. Isolated setup, isolated teardown.
    const v1247=await page.evaluate(async()=>{
      const T=(el,x,y,id)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});
      const fire=(el,t,tt)=>el.dispatchEvent(new TouchEvent(t,
        {bubbles:true,cancelable:true,touches:tt,targetTouches:tt,changedTouches:tt}));
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      closeMenus(); cancelPlacing(); await wait(250);
      // the banner is an ALLOW-list; the haul rides the caption; the draw demands intent
      const feedEl2=document.getElementById("feed"), bnEl=document.getElementById("tbanner");
      feedEl2.innerHTML=""; bnEl.classList.remove("on");
      msg("Red riders wheel toward their workers...","gold"); await wait(200);
      const chatterQuiet=!bnEl.classList.contains("on")&&feedEl2.children.length===1;
      msg("⚑ Blue advances to the BRONZE AGE!","gold"); await wait(200);
      const bigLoud=bnEl.classList.contains("on");
      // the gathering caption must carry the count. Stand AWAY from the town centre or the haul is
      // banked the instant it exists — that cost a debugging cycle.
      setClass(player,"villager");
      player.root.position.x=0; player.root.position.z=100;
      player.carry.wood=17; player.carry.food=3;
      player.gathering={amount:99,type:"wood",x:player.root.position.x,z:player.root.position.z};
      await wait(360);
      const cap=document.getElementById("tauto").textContent;
      // v124.8: one resource reads "icon count/cap" with no repeated number; several fall back to
      // per-icon counts plus a single running total
      const haulShown=/🪵\s*17/.test(cap)&&/3/.test(cap)&&/20\/20/.test(cap)&&!/\(20/.test(cap);
      player.gathering=null; player.carry.wood=0; player.carry.food=0;
      // a FLICK of the look stick must not loose an arrow; a real hold must
      setClass(player,"archer"); player.atkT=0; player._drawT=0;
      const blkEl=document.getElementById("tb-block");
      // AIM is a LATCH (v121), so tapping it blindly turns it OFF when an earlier check left it on
      // — which silently made every draw below fire nothing. Assert the state, don't toggle it.
      for(let i=0;i<3&&!aiming;i++){
        fire(blkEl,"touchstart",[T(blkEl,0,0,80+i)]); fire(blkEl,"touchend",[T(blkEl,0,0,80+i)]);
        await wait(200);
      }
      const zr=document.getElementById("tzR"), zb=zr.getBoundingClientRect();
      const zx=zb.left+zb.width*0.5, zy=zb.top+zb.height*0.5;
      const drive=async(id,holdMs,steps)=>{
        player.atkT=0; player._drawT=0;
        fire(zr,"touchstart",[T(zr,zx,zy,id)]); await wait(holdMs);
        for(let i=1;i<=steps;i++){fire(zr,"touchmove",[T(zr,zx+i*6,zy,id)]); await wait(110);}
        const barOn=document.getElementById("tdraw").classList.contains("on");
        fire(zr,"touchend",[T(zr,zx+steps*6,zy,id)]); await wait(320);
        return {fired:player.atkT>0,barOn};
      };
      const flick=await drive(81,60,1);      // inside the arm delay
      const pan=await drive(82,240,1);       // armed, but nowhere near the minimum
      const real=await drive(83,250,7);      // a genuine draw
      const drawSane=!flick.fired&&!pan.fired&&real.fired&&real.barOn;
      return {chatterQuiet,bigLoud,haulShown,cap,drawSane,
        flickFired:flick.fired,panFired:pan.fired,realFired:real.fired};
    });
    check(dev.name+": v124.7 banner — AI chatter stays in the feed, an age-up takes the centre",
      v1247.chatterQuiet&&v1247.bigLoud);
    check(dev.name+": v124.7 haul — the gathering caption carries the count (\""+
      v1247.cap+"\")",v1247.haulShown);
    check(dev.name+": v124.7 draw — a flick ("+v1247.flickFired+") and a slow pan ("+
      v1247.panFired+") loose NOTHING; a real draw ("+v1247.realFired+") does",v1247.drawSane);
    check(dev.name+": v124.2 HUD — nothing in the top band overlaps: bar, read-out and map button "+
      JSON.stringify(v1241.topBoxes),v1241.topClean&&v1241.barOnStage);
    check(dev.name+": v124.1 picker — CLOSE is the topmost element at its own centre and escapes ("+
      v1241.reachable+"/"+v1241.escaped+")",v1241.reachable&&v1241.escaped);
    check(dev.name+": v124.1 draw — one thumb charges the bow AND steers ("+
      v1241.drew.toFixed(2)+"s drawn, camera moved "+v1241.camMoved.toFixed(2)+
      ", ring "+v1241.fill.toFixed(2)+", loosed on lift: "+v1241.shot+")",
      v1241.drew>0.3&&v1241.camMoved>0.1&&v1241.fill>0.2&&v1241.shot&&v1241.reset===0);
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
