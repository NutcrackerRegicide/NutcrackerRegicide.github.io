/* v125 dev-only: the DESKTOP one-bar HUD, in a real mouse-and-keyboard browser.
   mobilecheck.js covers the phone layout; this is its counterpart. It boots a solo battle in a
   desktop viewport with NO touch, and asserts the layout John asked for — bar along the bottom,
   frame read-out at the top centre, feed and quest top-left, minimap and controls behind buttons,
   and the compact roster / age line the phone uses.

   Two things it deliberately checks that a layout test would not think to:
     · that NONE of the mobile layer is present. "Button rail only meant for mobile so exclude that"
       is a requirement, and the way that requirement breaks is a touch-detection change that hands
       a desktop the phone build — which no positive assertion about the bar would ever catch.
     · that ?ui=classic still gives the untouched v124 HUD. An escape hatch nobody tests is not an
       escape hatch.

   Run it after ANY change to 13-deskui.js, css/style.css, or the shared branches in 07-ai/08-ui. */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
const VIEWS=[
  {name:"1080p", w:1920,h:1080},   // the common case
  {name:"laptop",w:1366,h:768},    // the narrow one — where the strip has to start giving way
  {name:"tall",  w:1280,h:1024}    // an old 5:4 panel: the bar must not eat the battlefield
];
const PORT=8133;                   // NOT 8132 — mobilecheck may be running in the background
(async()=>{
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(PORT);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"]});
  let fails=0;
  const check=(n,c)=>{console.log((c?"  PASS":"  FAIL")+" — "+n);if(!c)fails++;};

  for(const dev of VIEWS){
    // hasTouch:false / isMobile:false is the point: 12-touch must decline and 13-deskui must take it
    const ctx=await browser.newContext({viewport:{width:dev.w,height:dev.h},
      hasTouch:false,isMobile:false,deviceScaleFactor:1});
    const page=await ctx.newPage();
    page.on("pageerror",e=>console.log("  PAGE ERROR ("+dev.name+"): "+e.message));
    await page.goto("http://localhost:"+PORT+"/index.html",{waitUntil:"load"});
    await page.waitForFunction(()=>typeof units!=="undefined",null,{timeout:30000});

    // ---- the handshake: desktop takes the bar, the mobile layer stays out ----
    const mode=await page.evaluate(()=>({
      bar:document.documentElement.classList.contains("bar-mode"),
      touch:document.documentElement.classList.contains("touch-mode"),
      // the ENTIRE mobile layer, by its own element ids. If a touch-detection change ever hands a
      // desktop the phone build, this is the assertion that says so.
      stage:!!document.getElementById("tstage"),
      pad:!!document.getElementById("touchpad"),
      rail:!!document.getElementById("tctx"),
      btns:!!document.getElementById("tbtns"),
      grid:!!document.getElementById("tgrid"),
      sticks:!!document.getElementById("tsticks"),
      dbar:!!document.getElementById("dbar")
    }));
    check(dev.name+": the desktop bar takes over and the MOBILE layer is entirely absent — no "+
      "stage, no thumb zones, no button rail, no action grid "+JSON.stringify(mode),
      mode.bar&&!mode.touch&&mode.dbar&&
      !mode.stage&&!mode.pad&&!mode.rail&&!mode.btns&&!mode.grid&&!mode.sticks);

    // v128.9: the name screen comes first on a fresh profile. CONTINUE accepts the prefilled name.
  await page.evaluate(()=>{const ns=document.getElementById("namescreen");
    if(ns&&getComputedStyle(ns).display!=="none")document.getElementById("btnname").click();}).catch(()=>{});
  await page.waitForTimeout(250);
  await page.waitForSelector("#btnsolo",{state:"visible",timeout:8000}).catch(()=>{});
    await page.click("#btnsolo").catch(async()=>{
      await page.evaluate(()=>document.getElementById("btnsolo").click()).catch(()=>{});
    });
    await page.waitForTimeout(2600);
    const live=await page.evaluate(()=>({inMenu:typeof inMenu==="undefined"?null:inMenu,
      alive:!!(player&&player.alive)}));
    check(dev.name+": a solo battle starts from a click ("+JSON.stringify(live)+")",
      live.inMenu===false&&live.alive===true);

    // ---- the strip ----
    // No rotated stage here, so getBoundingClientRect is honest — but offset* is used anyway to
    // stay in one dialect with mobilecheck, where the rect lies.
    const strip=await page.evaluate(()=>{
      const bar=document.getElementById("dbar");
      const b=bar.getBoundingClientRect();
      const seg=id=>{const e=document.getElementById(id);return e?{in:!!bar.contains(e),
        w:e.offsetWidth,h:e.offsetHeight}:null;};
      return {barB:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
        vw:innerWidth,vh:innerHeight,
        res:seg("resources"),kings:seg("kings"),age:seg("agebar"),roster:seg("roster"),
        hud:seg("playerhud"),map:seg("dmap"),help:seg("dhelp"),
        hudParent:document.getElementById("playerhud").parentElement.id};
    });
    const flush=strip.barB[1]+strip.barB[3]>=strip.vh-1;
    const spans=strip.barB[2]>=strip.vw-2&&strip.barB[0]<=1;
    const slim=strip.barB[3]<=56;              // a HUD strip, not a second window
    const allIn=["res","kings","age","roster","hud","map","help"]
      .every(k=>strip[k]&&strip[k].in);
    check(dev.name+": v125 the strip is ONE bar flush to the bottom edge, spanning the window, "+
      "with every segment inside it "+JSON.stringify({bar:strip.barB,flush,spans,slim,
        hudParent:strip.hudParent}),
      flush&&spans&&slim&&allIn&&strip.hudParent==="dbar");

    // ---- the unit panel is DEAD CENTRE, not centred in the leftover space ----
    // This is what the two balance groups buy, and the way it breaks is silent: it drifts by
    // however wide the transient segments happen to be.
    const centre=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      // Measure THE BAR, not the panel around it. The panel's midpoint can sit dead on the screen
      // centre while the bar itself is 100px left of it, because the class name occupies the left
      // half — which is exactly what the first version of this layout did, and exactly what a
      // panel-midpoint assertion would have called a pass.
      const hpbar=document.getElementById("phpbar");
      const mid=()=>{const r=hpbar.getBoundingClientRect();return r.left+r.width/2;};
      const before=mid();
      // Force the widest state the bar can reach: a five-digit treasury AND a full carry.
      // Set the STOCK, not just the text. updateResHud is event-driven rather than per-frame, so a
      // bare text write looks like it holds — until a villager deposits mid-wait and rewrites the
      // numbers from the real stockpile, which is why this passed on one viewport and not the other
      // two. Funding it means every rewrite is a wide one.
      const rIds=["rfood","rgold","rstone","rwood"];
      const old=rIds.map(id=>document.getElementById(id).textContent);
      const stOld=JSON.stringify(stock[MYTEAM]);
      for(const k in stock[MYTEAM])stock[MYTEAM][k]=24680;
      for(const id of rIds)document.getElementById(id).textContent="24680";
      const cw=document.getElementById("carry");
      const cOld=cw.style.display; cw.style.display="block";
      document.getElementById("carrytxt").textContent="19 stone (FULL)";
      await wait(260);
      const after=mid();
      const kb=[...document.querySelectorAll("#kings .kingbox")].map(c=>
        [c.offsetLeft,c.offsetWidth]);
      const gL=document.getElementById("dbarL");
      const gRight=gL.offsetLeft+gL.clientWidth;
      const crownsWhole=kb.length===2&&kb.every(([l,w])=>w>0&&l>=gL.offsetLeft-2&&l+w<=gRight+2);
      // FIVE DIGITS, not the exact number we wrote: villagers keep depositing and the team keeps
      // spending, so the figures drift to 24080 / 24605 within the wait. What the check needs is
      // that all four were WIDE while the crowns were measured, not that they were untouched.
      const fatWide=((document.getElementById("resources").textContent
        .match(/\b\d{5}\b/g))||[]).length===4;
      try{const o=JSON.parse(stOld); for(const k in o)stock[MYTEAM][k]=o[k];}catch(_){}
      rIds.forEach((id,n)=>{document.getElementById(id).textContent=old[n];});
      cw.style.display=cOld;
      await wait(200);
      return {before:Math.round(before),after:Math.round(after),want:Math.round(innerWidth/2),
        crownsWhole,fatWide,kb,gRight};
    });
    check(dev.name+": v125 the HEALTH BAR itself is DEAD CENTRE and STAYS there when the widest "+
      "transient segments appear "+JSON.stringify({before:centre.before,after:centre.after,
        want:centre.want}),
      Math.abs(centre.before-centre.want)<=3&&Math.abs(centre.after-centre.want)<=3);
    check(dev.name+": v125 a five-digit treasury does NOT clip a crown out of the strip "+
      JSON.stringify({crowns:centre.kb,groupRight:centre.gRight}),
      centre.crownsWhole&&centre.fatWide);

    // ---- the crowns ARE the meters ----
    const crown=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const l0=document.querySelector("#kb0 .lbl"), l1=document.querySelector("#kb1 .lbl");
      kings[0].hp=kings[0].maxHp*0.62; kings[1].hp=kings[1].maxHp*0.18;
      await wait(200);
      const hp0=parseFloat(l0.style.getPropertyValue("--hp")),
            hp1=parseFloat(l1.style.getPropertyValue("--hp"));
      const pct0=document.querySelector("#kb0 .kpct").textContent,
            pct1=document.querySelector("#kb1 .kpct").textContent;
      const hurt=l1.classList.contains("hurt")&&!l0.classList.contains("hurt");
      kings[0].hp=kings[0].maxHp; kings[1].hp=kings[1].maxHp;
      await wait(220);
      const refilled=parseFloat(l0.style.getPropertyValue("--hp"))>99;
      return {hp0,hp1,pct0,pct1,hurt,refilled,
        glyphs:l0.textContent.trim()==="♔"&&l1.textContent.trim()==="♚",
        clipped:(getComputedStyle(l0).webkitBackgroundClip||
                 getComputedStyle(l0).backgroundClip)==="text",
        noBar:getComputedStyle(document.querySelector("#kb0 .bar")).display==="none"};
    });
    check(dev.name+": v125 crown — the glyph IS the meter, with the percentage beside it ("+
      crown.hp0+"% "+crown.pct0+" / "+crown.hp1+"% "+crown.pct1+", refills "+crown.refilled+")",
      Math.abs(crown.hp0-62)<2&&Math.abs(crown.hp1-18)<2&&crown.refilled&&
      crown.pct0==="62%"&&crown.pct1==="18%"&&crown.clipped&&crown.noBar);
    check(dev.name+": v125 crown — yours stays ♔ and theirs ♚, and a dying king pulses",
      crown.glyphs&&crown.hurt);

    // ---- the top of the screen ----
    const top=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const f=document.getElementById("dfps");
      const boot=f.textContent;
      await wait(1200);
      const fb=f.getBoundingClientRect(), cs=getComputedStyle(f);
      const qh=document.getElementById("questhud").getBoundingClientRect();
      const fd=document.getElementById("feed").getBoundingClientRect();
      return {text:f.textContent,boot,
        fpsMid:Math.round(fb.left+fb.width/2),want:Math.round(innerWidth/2),fpsTop:Math.round(fb.top),
        bare:cs.borderTopWidth==="0px"&&(cs.backgroundColor==="rgba(0, 0, 0, 0)"||
             cs.backgroundColor==="transparent"),
        questTop:Math.round(qh.top),questLeft:Math.round(qh.left),questH:Math.round(qh.height),
        feedTop:Math.round(fd.top),feedLeft:Math.round(fd.left),vh:innerHeight};
    });
    check(dev.name+": v125 read-out — a frame counter exists on DESKTOP at last, bare lettering "+
      "at the top centre, and it updates "+JSON.stringify({text:top.text,mid:top.fpsMid,
        want:top.want,top:top.fpsTop}),
      // NOT "the string changed": a steady frame rate renders the identical read-out every
      // window, which is the exact trap that produced a false failure in mobilecheck. "It is no
      // longer the boot placeholder" is the honest test that the loop ran.
      /^\d+ fps \(min \d+\)$/.test(top.text)&&top.boot!==undefined&&top.text!=="--"&&
      Math.abs(top.fpsMid-top.want)<=3&&top.fpsTop<20&&top.bare);
    check(dev.name+": v125 corner — the quest is pinned TOP-left as ONE line with the feed "+
      "beneath it "+JSON.stringify({quest:[top.questLeft,top.questTop,top.questH],
        feed:[top.feedLeft,top.feedTop]}),
      top.questTop<30&&top.questLeft<30&&top.questH<=34&&
      top.feedTop>=top.questTop+top.questH-2&&top.feedLeft<30&&top.feedTop<top.vh/2);

    // ---- the minimap and the controls, behind buttons ----
    const btns=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const mw=document.getElementById("minimapwrap"), hp=document.getElementById("help");
      const shown=e=>getComputedStyle(e).display!=="none";
      const map0=shown(mw), help0=shown(hp);
      document.getElementById("dmap").click(); await wait(220);
      const map1=shown(mw);
      const mb=mw.getBoundingClientRect();
      const topRight=mb.top<40&&mb.left+mb.width>innerWidth-40;
      document.getElementById("dmap").click(); await wait(220);
      const map2=shown(mw);
      document.getElementById("dhelp").click(); await wait(220);
      const help1=shown(hp);
      const hb=hp.getBoundingClientRect();
      const centred=Math.abs((hb.left+hb.width/2)-innerWidth/2)<=3&&
                    Math.abs((hb.top+hb.height/2)-innerHeight/2)<=3;
      // H is the documented key and must still work — the button is an addition, not a replacement
      dispatchEvent(new KeyboardEvent("keydown",{key:"h"})); await wait(220);
      const help2=shown(hp);
      const oldToggle=shown(document.getElementById("helptoggle"));
      return {map0,map1,map2,topRight,help0,help1,help2,centred,oldToggle};
    });
    check(dev.name+": v125 minimap — hidden by default, the 🗺 button opens it TOP-RIGHT and "+
      "closes it again "+JSON.stringify(btns),
      btns.map0===false&&btns.map1===true&&btns.topRight&&btns.map2===false);
    check(dev.name+": v125 controls — the panel starts CLOSED, ? opens it CENTRED, H still closes "+
      "it, and the old corner toggle is gone",
      btns.help0===false&&btns.help1===true&&btns.centred&&btns.help2===false&&!btns.oldToggle);

    // ---- the compact roster and age line, John's explicit call ----
    const info=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      if(typeof updateRoster==="function")updateRoster();
      await wait(120);
      const rt=document.getElementById("roster").textContent.replace(/\s+/g," ").trim();
      const foe=(MYTEAM===BLUE)?RED:BLUE;
      const foeAge=AGES[teamAge[foe]].name.toUpperCase().replace(/ AGE$| ERA$/,"");
      // your countdown shows; theirs must not exist at all
      ageResT[MYTEAM]=42; ageResT[foe]=77;
      if(typeof updateAgeHud==="function")updateAgeHud();
      await wait(140);
      const at=document.getElementById("agebar").textContent.replace(/\s+/g," ").trim();
      ageResT[MYTEAM]=0; ageResT[foe]=0;
      return {rt,at,foeAge};
    });
    // ONE colour swatch and ONE pair of counts = one team. Two of either is the old desktop line.
    const oneTeam=(info.rt.match(/⛏/g)||[]).length===1&&(info.rt.match(/⚔/g)||[]).length===1;
    check(dev.name+": v125 roster — YOUR team only on desktop too, no enemy composition (\""+
      info.rt+"\")",oneTeam&&!/BRONZE|STONE|IRON|CLASSICAL/.test(info.rt));
    check(dev.name+": v125 age — your age, their age, and only YOUR countdown (\""+info.at+"\")",
      /⏳42s/.test(info.at)&&/vs/.test(info.at)&&info.at.includes(info.foeAge)&&
      !/77/.test(info.at));

    // ---- the gathering caption, lower centre ----
    // John: "the gather UI for desktop should be the same as mobile, showing up at lower center of
    // screen with the resource icon and the (0/20)." Three things have to be true: it appears only
    // while there is something to say, it names the resource and its capacity, and it CLEARS the
    // strip — the phone version originally sat at bottom:78px and printed "gathering" across the
    // word VILLAGER.
    const gather=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const el=document.getElementById("dauto");
      const shown=()=>getComputedStyle(el).display!=="none";
      const c=player.carry;
      const c0={...c}, g0=player.gathering;
      // STAND AT THE TREE. The player spawns inside the Town Centre's deposit radius, and 09-main
      // auto-deposits every frame you are in it — so a carry written by the harness was banked and
      // zeroed before the next rAF, and the caption honestly read 0/20 for ever. Nothing was wrong
      // with the caption; the test was standing in the wrong place.
      const p0={x:player.root.position.x,z:player.root.position.z};
      const tc=teamTC(MYTEAM);
      const node=nodes.filter(n=>n.type==="wood"&&n.amount>0)
        .sort((a,b)=>dist2(b.x,b.z,tc.x,tc.z)-dist2(a.x,a.z,tc.x,tc.z))[0];
      player.root.position.x=node.x; player.root.position.z=node.z;
      for(const k in c)c[k]=0;
      player.gathering=null;
      await wait(200);
      const idle=shown();                                  // nothing to say: silent
      // gathering with an EMPTY satchel must still read 0-of-capacity, naming the node type
      player.gathering=node;
      await wait(200);
      const zero=el.textContent;
      // ...and count up as the load comes in
      c.wood=7;
      await wait(200);
      const some=el.textContent;
      const b=el.getBoundingClientRect();
      const barTop=document.getElementById("dbar").getBoundingClientRect().top;
      const clears=b.bottom<=barTop-4;
      const centred=Math.abs((b.left+b.width/2)-innerWidth/2)<=3;
      const lower=b.top>innerHeight*0.6;
      // hands full says so
      const cap=carryCap(player);
      c.wood=cap;
      await wait(200);
      const full=el.textContent;
      // and it goes when the satchel empties and the hands come off the tree
      for(const k in c)c[k]=0;
      player.gathering=null;
      await wait(220);
      const gone=shown();
      for(const k in c0)c[k]=c0[k];
      player.gathering=g0;
      player.root.position.x=p0.x; player.root.position.z=p0.z;
      return {idle,zero,some,full,gone,cap,clears,centred,lower,
        box:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
        barTop:Math.round(barTop)};
    });
    check(dev.name+": v125.1 gather — the caption names the resource and counts to capacity, "+
      "starting at 0 on an empty satchel "+JSON.stringify({zero:gather.zero,some:gather.some,
        full:gather.full,cap:gather.cap}),
      // NOT an exact 7: standing at a live tree, the sim's own gather tick keeps adding while we
      // wait, which is the whole point of the read-out. Assert the FORM and that it climbed.
      gather.zero==="⛏ gathering  🪵 0/"+gather.cap&&
      /^⛏ gathering {2}🪵 \d+\/20$/.test(gather.some)&&
      parseInt(gather.some.match(/🪵 (\d+)/)[1],10)>=7&&
      /hands full/.test(gather.full));
    check(dev.name+": v125.1 gather — it is silent with nothing to say, and sits at the LOWER "+
      "CENTRE clear of the strip "+JSON.stringify({idle:gather.idle,gone:gather.gone,
        box:gather.box,barTop:gather.barTop}),
      gather.idle===false&&gather.gone===false&&gather.clears&&gather.centred&&gather.lower);
    // and the strip must NOT also carry the haul — one copy, in the place you are looking
    const noDup=await page.evaluate(()=>{
      const cw=document.getElementById("carry");
      return {inBar:!!document.getElementById("dbar").contains(cw),
        shown:getComputedStyle(cw).display!=="none"};
    });
    check(dev.name+": v125.1 gather — the haul is NOT also a segment of the strip "+
      JSON.stringify(noDup),!noDup.inBar&&!noDup.shown);

    // ---- PRIORITY: a narrow window drops the hint, never the age or the roster ----
    // Flexbox shrinks in proportion, which on a 1366 laptop produced "STONE vs" with the enemy age
    // cut off and a roster reading "⛏ 49 ·". Both of those are information; the key-hint line is a
    // reminder. Assert the ranking, at the narrowest width the game is likely to see.
    // (v125.1 dropped the haul off the strip entirely, so the ladder is two rungs now, not three.)
    const squeeze=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const gR=document.getElementById("dbarR");
      const age=document.getElementById("agebar"), ros=document.getElementById("roster");
      const whole=e=>e.scrollWidth<=e.clientWidth+1;    // nothing of it is cut off internally
      await wait(400);
      // "does anything spill out of the group" measured by RECTS, not scrollWidth: the group is
      // justify-content:flex-end so it overflows LEFT, and scrollWidth is blind to start-side
      // overflow — it reported a comfortable fit while the hint was sliced in half.
      const gb=gR.getBoundingClientRect();
      const kids=[...gR.children].filter(e=>e.offsetParent!==null);
      const spill=kids.filter(e=>{const r=e.getBoundingClientRect();
        return r.left<gb.left-1||r.right>gb.right+1;}).map(e=>e.id||e.className);
      return {fits:spill.length===0,spill,
        ageShown:age.offsetWidth>0,ageWhole:whole(age),rosWhole:whole(ros),
        ageTxt:age.textContent.replace(/\s+/g," ").trim(),
        rosTxt:ros.textContent.replace(/\s+/g," ").trim(),
        // the hint is either whole or absent — a hard-cut "E gather · B b" is the failure mode
        tipShown:document.getElementById("ptip").offsetWidth>0,
        tipWhole:whole(document.getElementById("ptip")),
        mapSeen:document.getElementById("dmap").offsetWidth>0,
        helpSeen:document.getElementById("dhelp").offsetWidth>0,
        w:innerWidth};
    });
    check(dev.name+": v125 priority — the right group FITS, and the age line and roster are whole "+
      "whatever has to be dropped to make room "+JSON.stringify(squeeze),
      squeeze.fits&&squeeze.ageShown&&squeeze.ageWhole&&squeeze.rosWhole&&
      squeeze.mapSeen&&squeeze.helpSeen&&
      (!squeeze.tipShown||squeeze.tipWhole));

    // ---- nothing in the bottom band collides ----
    const clash=await page.evaluate(()=>{
      const b=id=>{const e=document.getElementById(id);if(!e)return null;
        const r=e.getBoundingClientRect();
        return getComputedStyle(e).display==="none"?null:[r.left,r.top,r.width,r.height];};
      const bar=b("dbar");
      const ov=(a,c)=>!!a&&!!c&&a[0]<c[0]+c[2]&&c[0]<a[0]+a[2]&&a[1]<c[1]+c[3]&&c[1]<a[1]+a[3];
      const hits=["feed","questhud","objective","minimapwrap","dfps","lockhint"]
        .filter(id=>ov(bar,b(id)));
      return {bar,hits};
    });
    check(dev.name+": v125 nothing floating over the battlefield overlaps the strip"+
      (clash.hits.length?" ("+clash.hits.join(", ")+")":""),clash.hits.length===0);

    await page.screenshot({path:path.join(__dirname,"shot_desk_"+dev.name+".png")});
    await ctx.close();
  }

  // ---- THE ESCAPE HATCH. An untested fallback is not a fallback. ----
  {
    const ctx=await browser.newContext({viewport:{width:1600,height:900},hasTouch:false});
    const page=await ctx.newPage();
    await page.goto("http://localhost:"+PORT+"/index.html?ui=classic",{waitUntil:"load"});
    await page.waitForFunction(()=>typeof units!=="undefined",null,{timeout:30000});
    const cl=await page.evaluate(()=>{
      const res=document.getElementById("resources").getBoundingClientRect();
      const hp=document.getElementById("help");
      return {bar:!!document.getElementById("dbar"),
        barMode:document.documentElement.classList.contains("bar-mode"),
        fps:!!document.getElementById("dfps"),
        resTop:Math.round(res.top),resLeft:Math.round(res.left),
        mapShown:getComputedStyle(document.getElementById("minimapwrap")).display!=="none",
        helpShown:getComputedStyle(hp).display!=="none"};
    });
    check("?ui=classic — the v124 desktop HUD is untouched: stockpile back at the top-left, map "+
      "always on, no strip, no read-out "+JSON.stringify(cl),
      !cl.bar&&!cl.barMode&&!cl.fps&&cl.resTop<24&&cl.resLeft<24&&cl.mapShown);
    // the classic roster must still carry BOTH teams — the compact branch is class-gated, and a
    // gate that fires when neither class is present would be silent
    const rt=await page.evaluate(async()=>{
      await new Promise(r=>setTimeout(r,300));
      if(typeof updateRoster==="function")updateRoster();
      return document.getElementById("roster").textContent.replace(/\s+/g," ").trim();
    });
    check("?ui=classic — the long roster survives, both teams and their ages (\""+rt+"\")",
      (rt.match(/⛏/g)||[]).length===2);
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(fails?"\n"+fails+" DESKTOP FAILURES":"\nDESKTOP UI OK");
  process.exit(fails?1:0);
})();
