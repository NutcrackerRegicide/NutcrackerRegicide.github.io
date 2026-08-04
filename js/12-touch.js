/* REGICIDE PVP — 12-touch.js — MOBILE (v121)
   Twin-stick touch controls, forced landscape, AUTO-GATHER + AUTO-ATTACK, a one-button action
   grid for the desktop hotkeys, a mobile performance tier and an FPS read-out.
   Self-contained: nothing else in the game references this file and it early-returns on anything
   that isn't a touchscreen, so deleting it leaves the desktop build unchanged.

   v119, from John's second handset test. Three fixes:
     1. FORCED LANDSCAPE, SILENTLY. v118 asked the phone to rotate and his wouldn't — rotation
        lock, or an in-app browser that ignores it. Asking was always the wrong move: the game
        now ROTATES ITSELF 90° in CSS so a portrait viewport still presents a landscape
        battlefield. No notice, no gate, nothing to dismiss.
     2. TOUCH DETECTION WAS TOO NARROW. Tapping a link gave touch controls; pasting the same URL
        into Safari or Brave gave mouse-and-keyboard. Those browsers can report a FINE pointer
        with HOVER (Request Desktop Website does exactly this), and v118 required both coarse
        AND no-hover. Now any real touchscreen counts, with the sub-signals OR'd.
     3. The right stick turned twice as fast as it should.

   Design constraints that keep this cheap:
   · movement synthesises keys.w/a/s/d from the stick vector, so the existing movement code AND
     the {t:"input"} net packet (which sends w/a/s/d as bits) work untouched — multiplayer is free
   · the look stick writes camYaw/camPitch under the same clamps as the desktop mousemove handler
   · attack/block set lmbHeld/rmbHeld, the same flags the mouse sets */
(function(){
  // Inert outside a browser: the node smoketest loads every js/ file as one bundle and stubs a
  // minimal document + location, so those two alone are NOT enough to prove we're in a browser.
  // `screen` is the tell that actually discriminates — checking only the first two made the whole
  // bundle fail to load with "screen is not defined".
  // v125: `navigator` is NO LONGER a tell. Node 22 defines a global navigator, so that clause is
  // now always false under the smoketest and `screen` is carrying the whole guard on its own. It is
  // kept because an OR of four cheap checks costs nothing and older runtimes still lack it — but do
  // not add a fifth tell that a future Node might also define and call the guard hardened.
  // (tools/smoketest.js asserts this explicitly, so the day `screen` is defined too, it says so
  // rather than silently reparenting a stubbed DOM under every test in the file.)
  if(typeof document==="undefined"||typeof location==="undefined"||
     typeof screen==="undefined"||typeof navigator==="undefined")return;

  // ---------- should we be here at all? ----------
  // v119: the sub-signals are OR'd, not AND'd. A phone in "Request Desktop Website" mode reports
  // a fine pointer WITH hover — v118 required coarse AND no-hover and so handed John desktop
  // controls whenever he pasted the URL instead of tapping a link. A device with real touch
  // points that is either coarse, hover-less, small or on a mobile UA is a phone.
  const q=new URLSearchParams(location.search);
  const forced=q.get("touch");
  const mm=s=>typeof matchMedia==="function"&&matchMedia(s).matches;
  const touchCapable=(navigator.maxTouchPoints||0)>0||"ontouchstart" in window;
  const looksMobile=mm("(pointer: coarse)")||mm("(hover: none)")||
    Math.min(screen.width,screen.height)<=900||
    /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent||"");
  const TOUCH=forced==="1"?true:forced==="0"?false:(touchCapable&&looksMobile);
  if(!TOUCH)return;
  document.documentElement.classList.add("touch-mode");

  // ---------- FORCED LANDSCAPE ----------
  // The phone will not give us a landscape viewport, so we rotate the game into one. Everything
  // the game owns moves inside a #tstage that is sized to the viewport's TRANSPOSE and rotated
  // 90°. Two consequences handled below: the renderer must be sized to the stage (not the
  // window), and touch deltas arrive in SCREEN space and have to be mapped into stage space.
  const VW=1180;                      // the logical landscape width the HUD is tuned for
  const NOROT=q.get("rotate")==="0";  // ?rotate=0 opts out entirely
  let DIR=+1;                         // +1 = clockwise, -1 = anticlockwise
  try{const d=localStorage.getItem("reg_touch_dir");if(d)DIR=+d;}catch(_){}
  let ROT=false;                      // is the stage currently rotated?

  const stage=document.createElement("div");
  stage.id="tstage";
  while(document.body.firstChild)stage.appendChild(document.body.firstChild);
  document.body.appendChild(stage);
  // The floating stick rings live OUTSIDE the stage, unrotated: they're positioned straight from
  // clientX/clientY, and being circles they have no orientation to get wrong.
  const sticks=document.createElement("div");
  sticks.id="tsticks";
  sticks.innerHTML='<div class="tstick" id="tsL"><i></i><b></b></div>'+
                   '<div class="tstick" id="tsR"><i></i><b></b></div>';
  document.body.appendChild(sticks);

  let mv=document.querySelector('meta[name="viewport"]');
  if(!mv){mv=document.createElement("meta");mv.name="viewport";document.head.appendChild(mv);}
  function setViewport(){
    // When we're going to rotate, pick a viewport width such that 100vh lands on VW — then the
    // rotated stage is exactly VW wide and the HUD sits at the proportions it was tuned for.
    const dw=screen.width||innerWidth, dh=screen.height||innerHeight;
    const willRotate=!NOROT&&innerHeight>innerWidth;
    const want=willRotate?Math.round(VW*(Math.min(dw,dh)/Math.max(dw,dh)))
                         :(innerWidth<VW?VW:0);
    mv.setAttribute("content",want?("width="+want+", user-scalable=no, viewport-fit=cover")
      :"width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover");
  }
  setViewport();

  // stage geometry: rotated => the stage is the viewport transposed
  function stageSize(){return ROT?{w:innerHeight,h:innerWidth}:{w:innerWidth,h:innerHeight};}
  function layoutStage(){
    ROT=!NOROT&&innerHeight>innerWidth;
    const s=stageSize();
    stage.style.width=s.w+"px"; stage.style.height=s.h+"px";
    // rotate(90) translateY(-100%)  maps stage(a,b) -> screen(H-b, a)
    // rotate(-90) translateX(-100%) maps stage(a,b) -> screen(b, W-a)
    stage.style.transform=!ROT?"none"
      :(DIR>0?"rotate(90deg) translateY(-100%)":"rotate(-90deg) translateX(-100%)");
    document.documentElement.classList.toggle("rotated",ROT);
  }
  // screen-space delta -> stage-space delta, so a thumb pushed "up the phone" is still forward
  function mapDelta(dx,dy){return ROT?{x:DIR*dy,y:-DIR*dx}:{x:dx,y:dy};}

  // ---------- THE DYNAMIC ISLAND ----------
  // The cutout is hardware; nothing can remove it. What we CAN do is stop the HUD hiding behind
  // it. v120 asked for `viewport-fit=cover` without the matching safe-area padding, so the age
  // bar read "…E AGE" in every one of John's screenshots.
  // The twist: env(safe-area-inset-*) is in SCREEN space, and the HUD lives in a ROTATED stage.
  //   rotate(90) maps stage(a,b) -> screen(H-b, a), so screen TOP is the stage's LEFT edge —
  //   which is exactly where the island lands once the phone is turned. Anticlockwise flips it.
  const probe=document.createElement("div");
  probe.style.cssText="position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;"+
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(probe);
  function applySafeArea(){
    const cs=getComputedStyle(probe);
    const t=parseFloat(cs.paddingTop)||0, r=parseFloat(cs.paddingRight)||0;
    const b=parseFloat(cs.paddingBottom)||0, l=parseFloat(cs.paddingLeft)||0;
    // screen edge -> stage edge
    let SL,ST,SR,SB;
    if(!ROT){SL=l;ST=t;SR=r;SB=b;}
    else if(DIR>0){SL=t;ST=r;SR=b;SB=l;}   // clockwise
    else          {SL=b;ST=l;SR=t;SB=r;}   // anticlockwise
    const P=6; // a little breathing room beyond the cutout itself
    stage.style.setProperty("--sl",(SL?SL+P:0)+"px");
    stage.style.setProperty("--st",(ST?ST+P:0)+"px");
    stage.style.setProperty("--sr",(SR?SR+P:0)+"px");
    stage.style.setProperty("--sb",(SB?SB+P:0)+"px");
  }

  // ---------- the performance tier ----------
  // The post stack (bloom -> grade -> vignette) is three extra full-screen passes; shadows are a
  // second render of everything near the player. ?gfx=high keeps them.
  //
  // v124 THE BLUR. v116 pinned the mobile pixel ratio at 0.7 as a guess, before anyone knew what a
  // phone could do with this scene. Inside the 1180x545 rotated stage on a 3x handset that is about
  // 826x382 real pixels stretched over a 2532px screen — John: "graphics feel a little blurry
  // compared to the desktop version." His own read-out says 60 fps / min 50, so the guess was too
  // conservative. Start SHARP and only give resolution back if the frame rate actually asks for it:
  // a late-game 50v50 push may still need the old budget, and that is the case 0.7 was chosen for.
  const PR_STEPS=[1.0,0.85,0.7];
  let prStep=0;
  const LOW=q.get("gfx")!=="high";

  // ---------- v124.13 BATTERY SAVER ----------
  // John: "this game seems to drain iPhone battery pretty fast." It will — a 3D WebGL scene on a
  // phone is expensive by nature — but the audit found three avoidable costs:
  //   1. NO FRAME CAP. rAF was given its head, so a 120Hz ProMotion handset rendered 120 frames a
  //      second for a game that reads fine at 30.
  //   2. NOTHING PAUSED when backgrounded. rAF stops on its own, but the audio graph kept running
  //      and the host's 33ms sim interval kept firing with the screen off.
  //   3. v124 took the pixel ratio from a fixed 0.7 to 1.0 — (1/0.7)^2 = 2.04x the pixels shaded
  //      every frame. That was the sharpness John asked for, and it is the single biggest change
  //      in drain between v123 and v124. It has to be HIS choice, not a number I pick quietly.
  // So: one switch that bundles all three, defaulting ON so a stranger's phone is not cooked by a
  // game they opened out of curiosity — with a one-tap escape for when he wants to look at it.
  let saver=true;
  try{const v=localStorage.getItem("reg_saver"); if(v!==null)saver=v==="1";}catch(_){}
  if(q.get("saver")==="0")saver=false;
  if(q.get("saver")==="1")saver=true;
  const SAVER_FPS=30, FULL_FPS=60;   // FULL is still capped: 120Hz buys nothing here
  function saverPR(){return saver?2:0;}          // index into PR_STEPS: 0.7 vs 1.0
  function saverHide(){return saver?88:105;}     // pull the cull line in a little
  function applySaver(){
    try{
      prStep=saverPR();
      const pr=Math.min(devicePixelRatio,PR_STEPS[prStep]);
      // v124.13a: 06-input's pixel filter used to restore a hardcoded 1.0 when switched off,
      // which quietly threw away the saver's ratio. It now reads this instead.
      window.__basePR=pr;
      if(typeof pixelMode==="undefined"||!pixelMode)renderer.setPixelRatio(pr);
      if(typeof setHideD==="function")setHideD(saverHide());
      fit(true);
      // v128.1: the saver moves the drawing buffer under the outlines. Their width is in DEVICE
      // pixels, so without this the lines keep the pre-toggle weight — and a phone render at 0.7
      // showed what that costs: they thin to roughly one pixel and disappear entirely.
      if(window.__syncInk)window.__syncInk();
      try{localStorage.setItem("reg_saver",saver?"1":"0");}catch(_){}
      console.log("[touch] battery saver",saver?"ON":"OFF");
    }catch(e){}
  }
  if(LOW){
    try{
      composer=null;                                // 09-main falls back to renderer.render()
      renderer.shadowMap.enabled=false;
      prStep=saverPR();
      window.__basePR=Math.min(devicePixelRatio,PR_STEPS[prStep]);
      renderer.setPixelRatio(window.__basePR);
      if(typeof setHideD==="function")setHideD(saverHide());
      if(window.__syncInk)window.__syncInk();
    }catch(e){console.warn("[touch] perf tier partial:",e);}
  }

  // ---------- THE FIT ----------
  // A <meta viewport> change does not apply synchronously, so sizing the renderer on the next
  // line reads a stale innerWidth. Re-fit on a retry schedule and on every viewport event; some
  // in-app browsers fire neither resize nor orientationchange, hence the poll.
  // force: v124's adaptive pixel ratio needs a resize even when the CSS size has NOT changed —
  // setPixelRatio alone does not reallocate the drawing buffer.
  function fit(force){
    layoutStage();
    applySafeArea();
    const s=stageSize();
    const w=Math.max(1,s.w), h=Math.max(1,s.h);
    if(!force&&fit.last&&fit.last.w===w&&fit.last.h===h&&fit.last.rot===ROT)return;
    fit.last={w,h,rot:ROT};
    camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h,true);
    if(composer)composer.setSize(w,h);
  }
  // NOTE: every wiring below calls fit with NO argument on purpose. Handing it straight to
  // addEventListener would pass the Event object as `force` and re-allocate the drawing buffer on
  // every scroll-driven viewport nudge.
  const refit=()=>fit();
  addEventListener("resize",()=>{setViewport();fit();});
  addEventListener("orientationchange",()=>{setViewport();setTimeout(refit,120);setTimeout(refit,400);});
  if(window.visualViewport)visualViewport.addEventListener("resize",refit);
  for(const d of [0,50,150,350,700,1200,2000])setTimeout(refit,d);
  setInterval(refit,500); // backstop for browsers that fire no viewport events at all

  // ---------- v124.13 THE FRAME CAP ----------
  // Wrap requestAnimationFrame itself rather than touching 09-main's loop: the cap then applies to
  // every rAF consumer in the game at once, desktop stays byte-identical (this file never loads
  // there), and there is exactly one place to change the rule. A skipped frame re-requests without
  // running its callback, so the sim's own clock.getDelta() simply sees a longer dt — no drift.
  // The gate has to be per-FRAME, not per-callback. The first version kept one `last` timestamp
  // and re-requested any callback that arrived early — but this game has five independent rAF
  // consumers (the sim tick, the touch tick, syncPad, syncPick, tickBar). They shared that one
  // timestamp, so whichever fired first claimed the slot and starved the rest: the read-out stopped
  // updating entirely and the game would have crawled. Batch every callback registered for a frame
  // and release them TOGETHER when the interval is up.
  // (Safe to return 0 rather than a real handle: nothing in this codebase calls
  // cancelAnimationFrame — checked before writing this.)
  // v124.13a THE HALF-RATE TRAP — John: "there is no way to get back to 60fps."
  // The gate was `1000/(target+0.5)`: 16.53ms for a 60fps target. A 60Hz display delivers frames
  // 16.67ms apart NOMINALLY, but the real timestamps jitter by a millisecond either way — so any
  // frame arriving at 16.4ms was rejected, and the next candidate was a whole vsync later at
  // 33.3ms. The cap silently halved 60 to 30, and 30 to 20 (which is exactly the "min 20" that
  // has been sitting in his read-out). A frame-rate gate must be LOOSE enough to admit the frame
  // it wants and tight enough to reject the next one up; 0.8 of the period clears both, because
  // the interval it must reject is always at most half the one it must accept.
  const CAP_SLACK=0.8;
  (function capFrames(){
    const raf=window.requestAnimationFrame.bind(window);
    let pending=[], scheduled=false, last=0;
    function pump(t){
      scheduled=false;
      const want=(1000/(saver?SAVER_FPS:FULL_FPS))*CAP_SLACK;
      if(t-last<want){ if(pending.length){scheduled=true;raf(pump);} return; }
      last=t;
      const run=pending; pending=[];
      for(const cb of run){ try{cb(t);}catch(e){} }
    }
    window.requestAnimationFrame=function(cb){
      pending.push(cb);
      if(!scheduled){scheduled=true;raf(pump);}
      return 0;
    };
    // exposed for the harness: the gate cannot be measured by counting frames under software GL,
    // but its THRESHOLD is the whole bug and that is pure arithmetic.
    window.__capInfo=function(){
      const target=saver?SAVER_FPS:FULL_FPS;
      return {target:target, want:(1000/target)*CAP_SLACK, period:1000/target};
    };
  })();

  // ---------- v124.13 STOP WORKING WHEN NOBODY IS LOOKING ----------
  // rAF halts on its own when the page hides, so rendering stops — but the WebAudio graph keeps
  // running and, for a host, the 33ms sim interval keeps firing with the screen off. Suspend the
  // audio context on hide and resume on show. The sim is deliberately left alone for a HOST: its
  // guests are still playing and would freeze.
  document.addEventListener("visibilitychange",()=>{
    const hidden=document.visibilityState==="hidden";
    try{
      const ac=(typeof Sound!=="undefined")&&(Sound.ctx||Sound.context||Sound._ctx);
      if(ac&&ac.state){
        if(hidden&&ac.state==="running"&&ac.suspend)ac.suspend();
        else if(!hidden&&ac.state==="suspended"&&ac.resume)ac.resume();
      }
    }catch(e){}
    // and stop the music element outright — an <audio> tag plays on regardless of rAF
    try{
      const mu=document.querySelector("audio");
      if(mu){ if(hidden&&!mu.paused){mu._wasPlaying=true;mu.pause();}
              else if(!hidden&&mu._wasPlaying){mu._wasPlaying=false;mu.play().catch(()=>{});} }
    }catch(e){}
  });

  // ---------- pointer lock does not exist here ----------
  mouseLocked=true;
  const hint=document.getElementById("lockhint");
  if(hint)hint.style.display="none";
  const cross=document.getElementById("crosshair");
  if(cross)cross.style.display="block";
  try{canvasEl.requestPointerLock=function(){};}catch(e){}

  // ---------- the pad (inside the stage, so it rotates with the game) ----------
  const pad=document.createElement("div");
  pad.id="touchpad";
  pad.innerHTML=
    '<div class="tzone" id="tzL"></div>'+
    '<div class="tzone" id="tzR"></div>'+
    // v124 THE CONTEXTUAL RAIL. column-reverse, so the first child sits at the BOTTOM: the three
    // core buttons never move (muscle memory is the whole point of a fixed rail) and the
    // contextual slots stack ABOVE them, appearing and vanishing as you walk.
    '<div id="tbtns">'+
      '<div class="tbtn tbig" id="tb-atk">CHARGE</div>'+
      '<div class="tbtn" id="tb-block">BLOCK</div>'+
      '<div class="tbtn tmenu" id="tb-menu">\u2630</div>'+
      '<div class="tbtn tplace hide" id="tb-rot">\u21bb</div>'+
      '<div class="tbtn tplace hide" id="tb-cancel">\u2715</div>'+
      '<div id="tctx"></div>'+
    '</div>'+
    '<div id="tgrid"><div class="tgwrap"><div class="tgtitle">ACTIONS</div><div class="tgrows"></div>'+
      '<div class="tgclose">CLOSE</div></div></div>'+
    '<div id="tauto"></div>'+
    // v124.7: the draw ring on the FIRE button is under your thumb and behind your hand. John asked
    // for it where he is already looking — directly above the unit panel.
    '<div id="tdraw"><i></i><span></span></div>'+
    // v124: lives OUTSIDE #tbtns deliberately. syncPad hides the whole pad whenever a menu owns
    // the screen, and CANCEL only appears while placing — so until now the only way out of a build
    // menu on a phone was to pick something. Third instance of the same bug shape as the v118
    // rotate gate and the v122 scoreboard: an interface with no escape hatch.
    '<div id="tbanner"></div>'+
    '<div id="tmap">🗺</div>'+
    '<div id="ttop"><span id="tfps">--</span><span id="tflip">⟲</span><span id="tfull">⛶</span></div>';
  stage.appendChild(pad);
  // v124.1 THE FOURTH STACKING-CONTEXT BUG. The picker's CLOSE button shipped inside #touchpad,
  // which carries z-index:30 and therefore OPENS A STACKING CONTEXT — so the button's own z-index:57
  // could never climb past the menu's 52. It rendered, faintly, UNDERNEATH the menu: John could see
  // a ghost of it behind the unit panel and reported "no way to leave the grid menu". A child can
  // never out-rank its parent's context, whatever number you write on it. It hangs off the STAGE.
  const pickCloseEl=document.createElement("div");
  pickCloseEl.id="tpickclose";
  pickCloseEl.textContent="✕ CLOSE";
  stage.appendChild(pickCloseEl);

  // v124.1 ONE SOLID BAR — physically reparent the four HUD panels into a single strip rather than
  // positioning four boxes to look adjacent. Adjacent boxes drift the moment any of them changes
  // width, which is exactly what John saw: the age bar ran off under the king panels.
  (function oneBar(){
    const bar=document.createElement("div");
    bar.id="tbar";
    const host=document.getElementById("resources");
    if(!host||!host.parentNode)return;
    host.parentNode.insertBefore(bar,host);
    // v124.2: the KINGS join the strip. They were a separate centred panel at top:10, which put
    // three things in the same band — the bar, the two king boxes and the fps read-out — all
    // overlapping. Two royal health bars ARE top-line information; they belong in the one bar
    // rather than beside it.
    // v124.4: the read-out and the map button come INSIDE the bar too. They were the last two
    // things floating in the top band, which is what kept producing collisions with it.
    // v124.9: the unit panel joins the strip too — one bar, not a bar with a box floating over it.
    // v124.10: and it must sit DEAD CENTRE. Auto margins centre a flex item in the LEFTOVER space,
    // which drifts every time a transient segment (roster, carry) appears or goes — the panel slid
    // 66px right the moment the roster hid itself. Two wrapper groups of equal flex weight put it
    // on the true centre line and hold it there whatever else is showing.
    const gL=document.createElement("div"), gR=document.createElement("div");
    gL.id="tbarL"; gR.id="tbarR";
    bar.appendChild(gL);
    const hud=document.getElementById("playerhud");
    if(hud)bar.appendChild(hud);
    bar.appendChild(gR);
    // v124.13a THE CROWNS GO FIRST. John: "some things get pushed off screen where they are not
    // visible (red king crown) ... due to there being 4 digit resources." The left group is
    // flex:1 1 0 with overflow:hidden, so once its contents outgrow their half of the strip the
    // browser clips the LAST child — and with resources first, that was the red crown. Both
    // stockpiles crossing 1000 is not an edge case, it is the mid-game.
    // Two changes, and the ordering is the one that actually guarantees it:
    //   1. The kings lead the group and never shrink. Whatever else happens, the objective of the
    //      game stays on screen.
    //   2. Resources follow and are allowed to shrink, so a 5-digit stockpile costs a clipped
    //      digit on the least urgent number rather than a whole crown.
    // (Done by DOM order, not the `order` property: the divider rule is "#tbarL>*+*", which paints
    // on the second CHILD, so reordering visually with `order` would have hung a stray divider off
    // the left edge of the strip.)
    for(const id of ["kings","resources"]){
      const el=document.getElementById(id); if(el)gL.appendChild(el);
    }
    // carry is deliberately NOT here: v124.7 put the haul on the gathering caption, where your eyes
    // already are, so a second copy in the strip is just width spent on "Carrying: —".
    for(const id of ["agebar","roster","ttop","tmap"]){
      const el=document.getElementById(id); if(el)gR.appendChild(el);
    }
    // ...and the frame counter leaves it for the top centre, as plain lettering. It is a developer
    // read-out, not a control: it does not need a box, and it was the widest thing in the strip.
    const fps=document.getElementById("tfps");
    if(fps)stage.appendChild(fps);
    // v124.2: "♔ KING OSRIC (YOUR KING)" is 210px of text that says the same thing every match.
    // Compress to the crown alone and carry the ONE bit that matters — whose king it is — in its
    // colour. Done with an observer rather than a one-off rewrite because 10-net relabels both
    // boxes when you join as RED, and a static rewrite would be silently undone (or would undo it).
    for(const id of ["kb0","kb1"]){
      const lbl=document.querySelector("#"+id+" .lbl");
      if(!lbl)continue;
      const shorten=()=>{
        const t=(lbl.textContent||"").trim();
        // Only re-read ownership from a FULL label. The observer fires on its own rewrite, and the
        // first version then tested "♔" for the word YOUR, found none, and flipped every crown to
        // the enemy glyph on the very next tick — a rule that destroyed its own evidence.
        if(t.length>2){
          const mine=/YOUR/i.test(t);
          lbl.classList.toggle("mine",mine);
          lbl.classList.toggle("foe",!mine);
        }
        const want=lbl.classList.contains("mine")?"♔":"♚";
        if(t!==want)lbl.textContent=want;
      };
      if(typeof MutationObserver!=="undefined")
        new MutationObserver(shorten).observe(lbl,{childList:true,characterData:true,subtree:true});
      shorten();
    }
    // carry and the roster only earn their segment when they have something to say
    const roster=document.getElementById("roster");
    let rHot=0;
    if(roster&&typeof MutationObserver!=="undefined")
      new MutationObserver(()=>{rHot=performance.now();}).observe(
        roster,{childList:true,characterData:true,subtree:true});
    // v124.3: drain the crowns. Read the kings straight off the sim rather than parsing the width
    // updateKingBars just wrote — one less thing to stay in step with, and it works on a guest
    // where the bar is driven from the snapshot.
    // v124.4: a number beside each crown, in that king's colour. The crown alone reads as "roughly
    // half"; at a glance mid-fight John wanted the actual figure, and a percentage is the one thing
    // a glyph genuinely cannot say.
    const crowns=[["kb0",0],["kb1",1]].map(([id,t])=>{
      const box=document.getElementById(id);
      let pct=box.querySelector(".kpct");
      if(!pct){pct=document.createElement("span");pct.className="kpct";box.appendChild(pct);}
      return [box.querySelector(".lbl"),t,pct];
    });
    function drainCrowns(){
      if(typeof kings==="undefined"||!kings)return;
      for(const [el,t,pctEl] of crowns){
        const k=kings[t];
        if(!el||!k)continue;
        const pct=Math.max(0,Math.min(1,(k.hp||0)/(k.maxHp||1)));
        const s=(pct*100).toFixed(1)+"%";
        if(el._hp!==s){
          el._hp=s;
          el.style.setProperty("--hp",s);
          el.classList.toggle("hurt",pct>0&&pct<0.25);
          // round, but never round a living king to 0% — that reads as "already dead"
          const shown=pct>0?Math.max(1,Math.round(pct*100)):0;
          if(pctEl)pctEl.textContent=shown+"%";
        }
      }
    }
    // v124.8: the age line was still showing the DESKTOP copy until the first age event. 09-main
    // calls updateAgeHud() during init — and 12-touch loads AFTER it, so "touch-mode" was not on
    // <html> yet and the desktop branch won. Re-render once now, and again whenever the ages or
    // your countdown actually change (the countdown ticks every second while advancing, and
    // nothing else was refreshing it between age-ups).
    let ageSig="";
    function tickAgeLine(){
      if(typeof teamAge==="undefined"||typeof updateAgeHud!=="function")return;
      const foe=(MYTEAM===BLUE)?RED:BLUE;
      const sig=teamAge[MYTEAM]+"/"+teamAge[foe]+"/"+Math.ceil(Math.max(0,ageResT[MYTEAM]||0));
      if(sig===ageSig)return;
      ageSig=sig;
      try{updateAgeHud();}catch(e){}
    }
    (function tickBar(){
      requestAnimationFrame(tickBar);
      drainCrowns();
      tickAgeLine();
      if(roster)roster.classList.toggle("thidden",performance.now()-rHot>4000);
    })();
  })();

  const css=document.createElement("style");
  css.textContent=`
  html,body{overflow:hidden}
  #tstage{position:fixed;left:0;top:0;transform-origin:0 0;overflow:hidden}
  #tsticks{position:fixed;inset:0;z-index:80;pointer-events:none}
  /* above the HUD (10-20), BELOW the start menu (60) and the overlays (50) — the pad must never
     swallow a tap meant for a menu button */
  #touchpad{position:absolute;inset:0;z-index:30;pointer-events:none;
    font:600 13px/1 system-ui,-apple-system,sans-serif;-webkit-user-select:none;user-select:none;
    touch-action:none;-webkit-tap-highlight-color:transparent}
  /* the two thumb zones. The right one stops short of the button column so a thumb on ATTACK
     never also starts steering the camera. */
  /* v124.6: the thumb zones stop at the strip. They sit at z-index 30 against the bar's 22, so
     without this a thumb aimed at the map or the fullscreen button would be swallowed by the
     camera stick instead — the same class of bug as the v117 pad over the start menu. */
  .tzone{position:absolute;bottom:var(--tbarfull);height:70%;pointer-events:auto}
  #tzL{left:0;width:46%}
  #tzR{left:46%;width:36%}
  .tstick{position:absolute;left:0;top:0;display:none}
  .tstick i,.tstick b{position:absolute;display:block;border-radius:50%;
    border:2px solid rgba(255,255,255,.55);background:rgba(255,255,255,.10)}
  .tstick i{width:124px;height:124px;margin:-62px 0 0 -62px}
  .tstick b{width:56px;height:56px;margin:-28px 0 0 -28px;background:rgba(255,255,255,.30)}
  #tsR i{border-color:rgba(255,226,170,.6)} #tsR b{background:rgba(255,226,170,.34)}
  #tbtns{position:absolute;right:10px;bottom:12px;display:flex;flex-direction:column-reverse;
    align-items:center;gap:9px;pointer-events:none}
  .tbtn{pointer-events:auto;width:62px;height:62px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;
    background:rgba(20,24,20,.45);border:2px solid rgba(255,255,255,.55);
    text-shadow:0 1px 2px #000;letter-spacing:.5px}
  .tbtn.tbig{width:92px;height:92px;font-size:14px;background:rgba(120,30,26,.55)}
  /* v124 THE DRAW RING — a conic sweep behind the FIRE label, driven by --draw in degrees.
     Deliberately drawn on a ::before so it never fights the label's own text-shadow. */
  .tbtn.tbig{position:relative;isolation:isolate}
  .tbtn.tbig::before{content:"";position:absolute;inset:-4px;border-radius:50%;z-index:-1;
    opacity:0;transition:opacity .12s linear}
  .tbtn.tbig.drawing::before{opacity:1;
    background:conic-gradient(rgba(255,226,170,.92) var(--draw,0deg),rgba(0,0,0,0) 0)}
  .tbtn.tbig.full::before{background:conic-gradient(rgba(255,120,90,.95) 360deg,rgba(0,0,0,0) 0)}
  .tbtn.on{background:rgba(255,255,255,.45);color:#111;text-shadow:none}
  #ttop{position:absolute;left:50%;top:5px;transform:translateX(-50%);display:flex;gap:8px;align-items:center}
  #tfps{padding:3px 9px;border-radius:3px;color:#fff;background:rgba(0,0,0,.45);
    font:600 12px/1.4 ui-monospace,monospace}
  #tflip,#tfull{pointer-events:auto;padding:3px 9px;border-radius:3px;color:#fff;
    background:rgba(0,0,0,.45);font-size:14px}
  /* v124 THE CONTEXTUAL SLOTS. John chose the parchment look so the controls read as part of the
     game world rather than bolted on — but these are things a thumb hits while being charged, so
     the ink stays near-black and the parchment near-opaque. Legibility beats theme at 60fps. */
  #tctx{display:flex;flex-direction:column-reverse;align-items:center;gap:9px;pointer-events:none}
  .tbtn.tctxb{pointer-events:auto;width:auto;min-width:78px;height:44px;border-radius:4px;
    padding:0 12px;font:bold 12px/1 "Trebuchet MS",sans-serif;letter-spacing:1px;
    background:rgba(232,217,176,.93);color:#2b1d12;border:2px solid #2b1d12;
    text-shadow:none;box-shadow:0 3px 0 rgba(0,0,0,.45);
    animation:ctxin .16s ease-out}
  .tbtn.tctxb.on{background:#c9b177;color:#2b1d12}
  @keyframes ctxin{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
  .tbtn.tmenu{width:52px;height:52px;font-size:20px;background:rgba(20,24,20,.55)}
  .tbtn.tplace{width:52px;height:52px;font-size:22px;background:rgba(30,60,110,.55)}
  #tb-cancel{background:rgba(120,40,34,.6)}
  .tbtn.hide{display:none}
  /* the action grid: one button, everything the 21 desktop hotkeys reach */
  /* v124: was z-index 45, UNDER the scoreboard's 55 — and both are centred, so an open scoreboard
     covered the grid completely. The Scores toggle was correct and physically unreachable: tapping
     the visible backdrop hit the grid's own dismiss handler, closing the grid and leaving the
     scoreboard up. The grid must always win the stack; nothing it opens may ever bury it. */
  #tgrid{position:absolute;inset:0;z-index:58;display:none;align-items:center;justify-content:center;
    background:rgba(10,14,8,.72);pointer-events:auto}
  #tgrid.on{display:flex}
  .tgwrap{background:#e8d9b0;border:3px solid #2b1d12;border-radius:5px;padding:14px 16px;
    box-shadow:0 4px 0 rgba(0,0,0,.5);max-width:86%}
  .tgtitle{font:bold 13px/1 "Trebuchet MS",sans-serif;color:#2b1d12;letter-spacing:2px;
    text-align:center;margin-bottom:10px;opacity:.7}
  .tgrows{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;max-width:640px}
  .tgb{min-width:98px;padding:12px 10px;text-align:center;border:2px solid #2b1d12;border-radius:4px;
    background:#d9c48f;color:#2b1d12;font:bold 13px/1.2 "Trebuchet MS",sans-serif}
  .tgb small{display:block;font-weight:normal;font-size:10px;opacity:.62;margin-top:3px}
  .tgclose{margin-top:11px;text-align:center;padding:9px;border:2px solid #2b1d12;border-radius:4px;
    background:#c9b177;color:#2b1d12;font:bold 12px/1 "Trebuchet MS",sans-serif;letter-spacing:1px}
  /* what the automation is doing, so it never feels like the game is possessed */
  /* v124: was bottom:78px, which sat straight on top of #playerhud's title — John's field shot
     had "gathering" printed across the word VILLAGER. #playerhud is bottom-anchored and centred
     too, so this has to clear its full scaled height (~62px) plus the safe-area inset. */
  #tauto{position:absolute;left:50%;bottom:calc(var(--tbarfull) + 34px);
    transform:translateX(-50%);padding:4px 12px;
    border-radius:3px;color:#fff;background:rgba(0,0,0,.42);font-size:12px;display:none}
  /* THE DRAW BAR — sits directly above the unit panel, in the parchment language of the HUD */
  #tdraw{position:absolute;left:50%;bottom:calc(var(--tbarfull) + 10px);
    transform:translateX(-50%);width:232px;height:15px;display:none;align-items:center;
    background:#5a4632;border:2px solid var(--ink);border-radius:3px;
    box-shadow:0 2px 0 rgba(0,0,0,.45);overflow:hidden}
  #tdraw.on{display:flex}
  #tdraw>i{display:block;height:100%;width:0;background:#e0c23a;transition:width .06s linear}
  #tdraw.full>i{background:#ff7a4a}
  #tdraw>span{position:absolute;left:0;right:0;text-align:center;
    font:bold 10px/1 "Trebuchet MS",sans-serif;letter-spacing:1px;color:#2b1d12}
  /* below the minimum the bar reads as "this will not fire" rather than pretending it is charging */
  #tdraw.weak>i{background:#8f8570}
  #tauto.on{display:block}
  /* HUD triage — every left/top anchored panel is pushed clear of the notch via --sl/--st */
  /* v124.7 BUG: --tbarfull was declared on .touch-mode (the <html> element) as
     calc(var(--tbarh) + var(--sb)) — but --sb is declared HERE, on #tstage, a DESCENDANT. A custom
     property on an ancestor cannot read one defined further down the tree: --sb resolved to nothing
     on <html>, --tbarfull became invalid, and every calc() built on it silently fell back — which
     put the picker's CLOSE button 46px BELOW the bottom of the screen. Both live on #tstage now,
     beside the insets they depend on. */
  #tstage{--sl:0px;--st:0px;--sr:0px;--sb:0px;
    --tbarh:34px; --tbarfull:calc(var(--tbarh) + var(--sb))}
  /* ---------- v124 ONE STRIP ----------
     Four stacked panels down the left edge ate a quarter of a phone screen. Resources and the age
     bar are the only two you want CONSTANTLY, so they share one line; roster and carry are
     situational and now appear only when they have something to say (see syncHud below). */
  /* v124.1 ONE SOLID BAR. John: "all the stuff at the top UI wise just needs to be in one solid
     bar." v124 put resources and the age on the same LINE but they were still three separate
     parchment boxes with their own borders, on two rows, and the age bar ran under the king
     panels. They are now segments of a single strip: one background, one border, hairline
     dividers between them, and the whole thing sized to stop short of the kings. */
  /* ---------- v124.4 THE FULL-WIDTH PARCHMENT BAR ----------
     John: "bar is black and font is black so hard for a human to read. Bar should match bottom bar
     style. It should sit at top of screen as is but go all the way across the screen. Map and fps
     counter should be included inside the bar."
     The dark bar was my invention and it fought the game's own look — every other panel is
     parchment with dark ink, which is why the ink-on-dark text was unreadable. This is now the
     same .panel treatment as the VILLAGER box at the bottom, edge to edge, and it swallows the
     read-out and the map button so nothing is left floating beside it to collide with. */
  /* v124.6: the strip moved to the BOTTOM, under the unit panel. Everything anchored to the bottom
     edge — the unit panel, the button rail, the automation caption, the picker's CLOSE and the two
     thumb zones — has to clear it, and the message feed swaps to the top where the strip used to
     be. --tbarh is the single number they all read, so the bar's height is changed in one place. */
  /* v124.7: FLUSH. v124.6 sat the bar at bottom:var(--sb), which left the safe-area inset as a
     visible strip of battlefield under it. The convention for an edge-anchored bar is the opposite:
     the BACKGROUND runs to the physical edge and the inset becomes internal padding, so the bar
     looks flush while its contents still clear the home indicator. --tbarfull is what everything
     stacked above it now reads. */
  .touch-mode #tbar{position:absolute;left:0;right:0;bottom:0;top:auto;
    z-index:22;display:flex;align-items:center;overflow:hidden;
    height:var(--tbarfull);padding:0 calc(4px + var(--sr)) var(--sb) calc(4px + var(--sl));
    background:var(--parch);border:0;border-top:3px solid var(--ink);border-radius:0;
    box-shadow:0 -3px 0 rgba(0,0,0,.35), inset 0 0 0 2px var(--parch2);
    color:var(--ink)}
  .touch-mode #tbar>*,.touch-mode #tbarL>*,.touch-mode #tbarR>*{position:static!important;transform:none!important;margin:0!important;
    display:flex!important;align-items:center;background:none!important;border:0!important;
    border-radius:0!important;box-shadow:none!important;padding:0 7px!important;
    white-space:nowrap;font-size:12px!important;line-height:1!important;max-width:none!important;
    color:var(--ink)!important;opacity:1;transition:none;height:100%}
  /* dividers go BETWEEN segments inside each group, not between the three top-level boxes */
  .touch-mode #tbarL>*+*,.touch-mode #tbarR>*+*{
    border-left:1px solid rgba(43,29,18,.22)!important}
  .touch-mode #tbar>#playerhud{border-left:1px solid rgba(43,29,18,.22)!important;
    border-right:1px solid rgba(43,29,18,.22)!important}
  /* equal flex weight either side => the unit panel lands on the true centre line */
  .touch-mode #tbarL,.touch-mode #tbarR{display:flex;align-items:center;height:100%;
    flex:1 1 0;min-width:0;overflow:hidden}
  .touch-mode #tbarR{justify-content:flex-end}
  /* v124.2 PRIORITY INSIDE THE STRIP. The bar is capped so it never reaches the fps read-out, and
     when the transient segments (roster, carry) appear the total exceeds that cap. Whatever gets
     clipped must be the LEAST important thing, not whatever happens to be last in the DOM — the
     first version clipped the king health bars, which are the whole objective of the game.
     Resources and the kings hold their size; the age bar and the transients give way. */
  /* v124.9 THE UNIT PANEL, IN THE STRIP. Class name and a slim health bar; the key hints go —
     "E gather · B build · Space attack" is desktop copy and there is no keyboard here. */
  /* v124.10: CENTRED in the strip, not jammed against the left edge — it lived in the middle of
     the screen for every version before this one and that is where the eye goes for it. Auto
     margins on both sides split the strip's free space evenly around it, which centres it without
     taking it out of the flow (absolute positioning would have let it ride over its neighbours the
     moment a segment grew). For that to work nothing else may claim the slack, hence agebar losing
     its flex-grow below. */
  .touch-mode #tbar #playerhud{flex:0 0 auto;min-width:118px;gap:7px}
  .touch-mode #tbar #playerhud #ptip{display:none!important}
  .touch-mode #tbar #playerhud #pclass{font-size:11px!important;font-weight:bold;letter-spacing:.5px}
  /* v124.11: 56px was a token gesture — the strip has room and this is the one number you check
     mid-fight. Nearly triple, and taller so the fill reads at a glance. */
  .touch-mode #tbar #playerhud .bar{width:150px;height:13px!important;border-width:2px!important;
    border-radius:3px!important;background:#5a4632}
  /* the frame counter: top centre, no box, deliberately faint */
  .touch-mode #tfps{position:absolute;left:50%;top:calc(4px + var(--st));transform:translateX(-50%);
    z-index:21;background:none!important;padding:0!important;pointer-events:none;
    font:600 11px/1 ui-monospace,monospace!important;color:#f2ead4;opacity:.5;
    text-shadow:0 1px 2px rgba(0,0,0,.7)}
  /* v124.13a: kings hold their size, resources give way — see the ordering note in oneBar().
     tabular-nums stops the whole strip twitching sideways every time a digit ticks over. */
  .touch-mode #tbar #kings    {order:0;flex:0 0 auto}
  .touch-mode #tbar #resources{order:1;flex:0 1 auto;min-width:0;overflow:hidden;
    font-variant-numeric:tabular-nums;gap:6px!important}
  .touch-mode #tbar #agebar   {order:3;flex:0 1 auto;min-width:0;overflow:hidden;
    text-overflow:ellipsis;gap:7px}
  .touch-mode #tbar .agemine{font-size:12px;letter-spacing:.5px}
  .touch-mode #tbar .agefoe {font-size:12px;letter-spacing:.5px;color:#8a3a30}
  .touch-mode #tbar .agevs  {font-size:10px;opacity:.5;letter-spacing:1px}
  .touch-mode #tbar .agecd  {font-size:12px;font-weight:bold;color:#8a6a12;
    background:rgba(224,169,46,.22);padding:3px 6px;border-radius:3px}
  .touch-mode #tbar #roster   {order:4;flex:0 1 auto;min-width:0;overflow:hidden}
  /* the read-out and the map ride at the far right INSIDE the bar — margin-left:auto is what
     pushes them there, and it is why nothing can collide with them any more */
  .touch-mode #tbar #ttop     {order:6;flex:0 0 auto;gap:8px}
  .touch-mode #tbar #tmap     {order:7;flex:0 0 auto}
  .touch-mode #tbar #tflip,.touch-mode #tbar #tfull{background:rgba(43,29,18,.10)!important;
    color:var(--ink)!important;padding:5px 8px!important;border-radius:3px;font-size:14px}
  .touch-mode #tbar #tmap{width:auto!important;height:auto!important;border:0!important;
    background:none!important;color:var(--ink)!important;font-size:19px!important;
    padding:0 8px!important}
  .touch-mode #tbar #agebar,.touch-mode #tbar #roster{font-size:11px!important}
  /* v124.10: was "#tbar>.thidden" — the segments are one level deeper now that the balance groups
     exist, so the hide silently stopped applying and an empty "Carrying: —" sat in the strip. */
  .touch-mode #tbar .thidden{display:none!important}
  /* v124.2 THE KINGS, in the bar. Full-width titles ("KING OSRIC (YOUR KING)") cost 210px each and
     say the same thing every match — the crown, the colour and the bar carry all of it. */
  /* v124.13a: 10px either side + an 8px gap was 36px of air around two glyphs. Trimmed to buy
     the resource block room before anything has to shrink at all. */
  .touch-mode #tbar #kings{gap:5px!important;padding:0 7px!important}
  /* the king boxes are GRANDchildren of the strip, so the "#tbar>*" reset above never reached
     them and each crown kept sitting on its own parchment panel */
  .touch-mode #tbar .kingbox{width:auto!important;padding:0!important;display:flex!important;
    align-items:center;gap:5px;background:none!important;border:0!important;
    border-radius:0!important;box-shadow:none!important}
  /* ---------- v124.3 THE CROWN IS THE METER ----------
     John's idea, and a better one than a crown next to a bar: fill the crown glyph itself with its
     team colour and let it DRAIN to black from the top as that king takes damage, like an
     hourglass running out. One glyph now carries three things the old layout needed four elements
     for — whose king, which team, and how close he is to dying — and the separate health bar can
     go entirely, which buys back 150px of the strip.
     Done with background-clip:text: the gradient is painted through the glyph's own shape, so the
     "sand" drains along the crown's silhouette rather than down a rectangle. --hp is written per
     frame in JS below. */
  .touch-mode #tbar .kingbox .lbl{font-size:25px!important;margin:0!important;
    line-height:1!important;letter-spacing:0!important;
    --hp:100%; --col:#6f86d6;
    /* the "spent" half is a light stone grey now that the bar is parchment — on the old dark bar
       it had to be a dark grey, and simply inverting the bar behind it would have made an emptied
       crown vanish. Whatever the bar colour, the empty half has to CONTRAST with it. */
    background:linear-gradient(to top,var(--col) 0,var(--col) var(--hp),
      #b3a68c var(--hp),#b3a68c 100%);
    -webkit-background-clip:text;background-clip:text;
    color:transparent!important;-webkit-text-fill-color:transparent;
    filter:drop-shadow(0 1px 0 rgba(43,29,18,.55))}
  /* the number, in the king's own colour — John: "blue font next to blue king crown would say 50%" */
  .touch-mode #tbar .kpct{font:bold 11px/1 "Trebuchet MS",sans-serif;letter-spacing:0;
    min-width:38px;text-align:left}
  .touch-mode #tbar #kb0 .kpct{color:#2f57c9}
  .touch-mode #tbar #kb1 .kpct{color:#b4291b}
  /* under a quarter health the crown pulses — you should not have to read a number to know */
  .touch-mode #tbar .kingbox .lbl.hurt{animation:crownpulse 1.15s ease-in-out infinite}
  @keyframes crownpulse{0%,100%{filter:drop-shadow(0 1px 0 rgba(43,29,18,.55))}
    50%{filter:drop-shadow(0 1px 0 rgba(43,29,18,.55)) drop-shadow(0 0 7px rgba(200,30,20,.95))}}
  .touch-mode #tbar #kb0 .lbl{--col:#6f86d6}   /* Blue crown  */
  .touch-mode #tbar #kb1 .lbl{--col:#d05a4c}   /* Red crown   */
  /* the bar was the meter; the crown is the meter now */
  .touch-mode #tbar .kingbox .bar{display:none!important}
  /* the read-out moves off the centre line it was sharing with the kings */
  .touch-mode #ttop{left:auto!important;right:calc(62px + var(--sr))!important;
    transform:none!important}
  /* THE BANNER — John: fewer lines, but the big ones unmissable */
  /* v124.6: the feed owns the top-left now, so the banner drops to a third of the way down where
     it cannot sit on top of it */
  #tbanner{position:absolute;left:50%;top:calc(30% + var(--st));transform:translateX(-50%) translateY(-8px);
    z-index:44;padding:10px 22px;border-radius:4px;opacity:0;pointer-events:none;
    background:rgba(232,217,176,.96);color:#2b1d12;border:2px solid #2b1d12;
    box-shadow:0 3px 0 rgba(0,0,0,.45);max-width:70%;text-align:center;
    font:bold 14px/1.25 "Trebuchet MS",sans-serif;
    transition:opacity .18s ease,transform .18s ease}
  #tbanner.on{opacity:1;transform:translateX(-50%) translateY(0)}

  #tbanner.warn{background:rgba(150,58,44,.96);color:#ffe9df;border-color:#2b1d12}
  /* THE MAP — behind a tap. John's pick: maximum clear screen during a fight. */
  #tmap{position:absolute;z-index:31;right:calc(10px + var(--sr));top:calc(8px + var(--st));
    width:44px;height:44px;border-radius:5px;pointer-events:auto;display:flex;
    align-items:center;justify-content:center;font-size:20px;
    background:rgba(20,24,20,.55);border:2px solid rgba(255,255,255,.55);color:#fff}
  .touch-mode #minimapwrap{display:none}
  /* v124.8: the map opens TOP-RIGHT. v124.6 moved it to the bottom to sit near its button when the
     strip went down there — and put it straight under the ATTACK button, which is the one place on
     the screen a thumb is guaranteed to be. The button can live at the bottom; the map it opens
     should not. */
  .touch-mode.tmapon #minimapwrap{display:block;transform:scale(.92);transform-origin:top right;
    right:calc(10px + var(--sr));top:calc(10px + var(--st));bottom:auto!important;z-index:26}
  .touch-mode #objective{transform:scale(.8);transform-origin:top center;top:calc(74px + var(--st))}
  /* v124.6: everything bottom-anchored now sits above the strip */
  .touch-mode #tbtns{right:calc(10px + var(--sr));
    bottom:calc(var(--tbarfull) + 10px)}
  /* THE FEED. v120 set a font-size on #feed, but .msg carries its own — so nothing changed and
     tutorial hints covered half the battlefield. Style the ENTRIES, cap the width, and clamp
     each one to two lines; the count is trimmed in JS below. */
  /* px, not vw: inside a rotated stage the vw unit still means the VIEWPORT, which is the SHORT
     edge — 34vw came out as a 185px ribbon that wrapped every hint into six lines.
     (backticks are banned in here: this whole block is a JS template literal) */
  /* v124.6: the feed swaps to the TOP-LEFT, where the strip used to live. It reads bottom-up in
     the DOM, so column-reverse keeps the newest line nearest the top edge rather than sinking. */
  .touch-mode #feed{left:calc(14px + var(--sl));top:calc(12px + var(--st));bottom:auto;
    display:flex;flex-direction:column-reverse;max-height:34%;max-width:360px}
  .touch-mode #feed .msg{font-size:10.5px;padding:3px 7px;line-height:1.32;
    max-height:2.9em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
    overflow:hidden;text-overflow:ellipsis}
  .touch-mode #helptoggle,.touch-mode #help{display:none !important}
  /* ---------- v124.10 THE QUEST, PINNED ----------
     John: "can we pin whatever quest is active to the message board section, thought to use
     hamburger menu to track right now." It was hidden outright on touch since v116 — the panel is
     desktop-positioned beside the unit box, which on a phone landed under the button rail. It
     belongs with the feed: the top-left corner is where you already look for "what is going on",
     and a quest is a standing instruction rather than a passing line. */
  /* v124.11: dressed as a FEED LINE, not a panel. John: "format of quest table should match format
     of message board... quest should just be one line." It shares the corner with the feed, so
     looking like a different species of object made the corner read as two competing widgets.
     Same background, same left-border accent (gold, since a quest IS the standing objective), same
     type size — it just never scrolls away. */
  .touch-mode #questhud{position:absolute!important;display:block!important;
    left:calc(14px + var(--sl))!important;top:calc(12px + var(--st))!important;
    bottom:auto!important;min-width:0!important;max-width:380px!important;
    background:rgba(30,22,12,.82)!important;color:#f2e7c8!important;
    border:0!important;border-left:4px solid var(--gold)!important;border-radius:3px!important;
    box-shadow:none!important;padding:5px 10px!important;z-index:12;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* ONE line: the level and the posting sit inline instead of stacking */
  .touch-mode #qlvl,.touch-mode #qtext{display:inline!important;font-size:12px!important;
    margin:0!important;color:#f2e7c8!important;font-weight:normal!important}
  .touch-mode #qlvl{color:#e8c53a!important;font-weight:bold!important}
  .touch-mode #qlvl::after{content:" · "; opacity:.45}
  .touch-mode #qbuffs{display:none!important}   /* buffs live on the scoreboard, not the corner */
  /* and the feed drops below it, so the two stack like one column of lines */
  .touch-mode #feed{top:calc(44px + var(--st))!important}
  /* ---------- v124.1 THE MAIN MENU FITS ----------
     John: "some stuff is off screen at game start and gets even worse if you open up play with
     friends, host, join game as the menu just continues to expand vertically but the screen has no
     room for it." Two separate faults. The overlay centres its content with no scroll, so anything
     taller than the stage loses BOTH ends — the title off the top, the version stamp off the
     bottom. And every disclosure row adds height to a column that was already overflowing.
     Fix: scroll from the top, and shrink desktop-sized type to phone-sized. */
  .touch-mode .overlay{justify-content:flex-start;overflow-y:auto;-webkit-overflow-scrolling:touch;
    padding:calc(10px + var(--st)) 12px calc(18px + var(--sb));gap:10px}
  .touch-mode #startmenu h1{font-size:26px!important;letter-spacing:3px;margin:0}
  .touch-mode #startmenu .tagline{font-size:12px!important;margin:0 0 8px!important;max-width:520px}
  .touch-mode .overlay p{font-size:12px}
  .touch-mode .startbtns{width:min(460px,72%);gap:7px}
  .touch-mode .startbtns button,.touch-mode #joinrow button{font-size:14px;padding:9px 14px}
  .touch-mode .playbtn{font-size:19px!important;padding:13px 16px!important}
  .touch-mode .optline{font-size:11px}
  .touch-mode .optline button.pick{font-size:12px;padding:6px 10px}
  .touch-mode #hostrow,.touch-mode #joinrow{width:min(460px,72%)}
  .touch-mode #joinrow input,.touch-mode #joinrow select{font-size:13px;padding:8px 10px}
  /* the deploy note is desktop advice — on a phone the game is already served over HTTPS */
  .touch-mode #setupscreen .netnote{display:none}
  /* v128.9: the shields must never wrap or shrink below a thumb — three across is the design,
     and a stacked column pushes SOLO off the top of a 590x273 landscape stage. */
  .touch-mode .shields{gap:8px}
  .touch-mode .shield{width:clamp(76px,19vw,120px)}
  .touch-mode .shield .shsub{display:none}      /* no room, and the label already says it */
  .touch-mode .gametitle{font-size:clamp(19px,4.4vw,30px) !important;letter-spacing:2px}
  .touch-mode .undertitle{gap:8px}
  .touch-mode .linkbtn{font-size:12px;padding:8px 14px}
  .touch-mode .backbtn{font-size:12px;padding:8px 14px}
  .touch-mode .bigpick{min-width:150px;padding:12px 16px;font-size:14px}
  .touch-mode .nameask{font-size:clamp(17px,4vw,26px);margin-bottom:18px}
  .touch-mode #namerow{width:min(420px,90vw)}
  .touch-mode #startmenu .verstamp,.touch-mode #setupscreen .verstamp{font-size:10px;opacity:.55;margin:4px 0 0}
  .touch-mode #whoami{font-size:12px}
  .touch-mode #optbox{max-height:82%;overflow-y:auto;font-size:13px}
  .touch-mode #howtobox{max-height:88%;font-size:13px}
  /* v122 THE MENUS FIT NOW. #buildmenu/#classmenu/#smithmenu are fixed-size desktop panels — the
     DEFENSIVE category has the most rows and ran off the bottom of a phone. Cap them to the stage
     and let them scroll; the scoreboard gets the same treatment. */
  /* ---------- v124 THE PICKER ----------
     Build, Class, the Town Board and the Blacksmith were four separately-styled desktop panels —
     the responsive pass on the watch list since v116. They all render the same .opt / .cost /
     .cant markup, so ONE set of rules turns all four into the same full-screen picker: big tiles,
     cost always legible, unaffordable obviously dead. Learn it once, it works everywhere — and
     none of the menu LOGIC is touched, so the desktop build is byte-identical. */
  .touch-mode #buildmenu,.touch-mode #classmenu,.touch-mode #smithmenu{
    position:absolute;inset:0;max-width:none;max-height:none;transform:none;
    border:0;border-radius:0;background:rgba(18,15,11,.94);
    overflow-y:auto;-webkit-overflow-scrolling:touch;z-index:52;
    padding:calc(6px + var(--st)) calc(14px + var(--sr)) calc(78px + var(--sb)) calc(14px + var(--sl))}
  .touch-mode #buildmenu h3,.touch-mode #classmenu h3,.touch-mode #smithmenu h3{
    position:sticky;top:0;margin:0 0 12px;padding:12px 4px;font-size:15px;letter-spacing:2px;
    text-align:center;color:#e8d9b0;background:rgba(18,15,11,.97);
    border-bottom:1px solid rgba(160,150,120,.35);z-index:2}
  /* the tiles. A 1180-wide stage takes three across. */
  .touch-mode #buildmenu .opt,.touch-mode #classmenu .opt,.touch-mode #smithmenu .opt{
    display:inline-flex;flex-direction:column;align-items:flex-start;justify-content:space-between;
    width:calc(33.33% - 14px);min-height:64px;margin:0 6px 10px;padding:10px 12px;vertical-align:top;
    background:rgba(232,217,176,.95);color:#2b1d12;border:2px solid #2b1d12;border-radius:5px;
    box-shadow:0 3px 0 rgba(0,0,0,.45);gap:6px;font-size:13px;line-height:1.25}
  .touch-mode #buildmenu .opt small,.touch-mode #classmenu .opt small,
  .touch-mode #smithmenu .opt small{display:block;opacity:.62;font-size:11px}
  .touch-mode #buildmenu .opt .cost,.touch-mode #classmenu .opt .cost,
  .touch-mode #smithmenu .opt .cost{align-self:stretch;text-align:right;font-size:12px;
    padding-top:5px;border-top:1px solid rgba(43,29,18,.22)}
  /* unaffordable is a STATE, not a whisper — .45 opacity over a battlefield read as "already built" */
  .touch-mode #buildmenu .opt.cant,.touch-mode #classmenu .opt.cant,
  .touch-mode #smithmenu .opt.cant{opacity:1;background:rgba(90,80,62,.6);color:#cfc4a6;
    border-color:rgba(43,29,18,.5);box-shadow:none}
  .touch-mode #buildmenu .opt.cant .cost,.touch-mode #classmenu .opt.cant .cost,
  .touch-mode #smithmenu .opt.cant .cost{color:#ffb9a6}
  /* the number badges are for a keyboard nobody here has */
  .touch-mode #buildmenu .key,.touch-mode #classmenu .key,.touch-mode #smithmenu .key{display:none}
  .touch-mode #buildmenu .hint,.touch-mode #classmenu .hint,.touch-mode #smithmenu .hint{
    display:block;clear:both;padding:8px 4px;text-align:center;font-size:11px;color:#9c9075}
  /* the escape hatch — see the note by #tpickclose in the markup */
  /* z-index 62: above the picker (52) AND above the scoreboard (55) and the grid (58). It is a
     direct child of #tstage now, so this number actually means something. */
  #tpickclose{position:absolute;left:50%;bottom:calc(var(--tbarfull) + 12px);
    transform:translateX(-50%);
    display:none;z-index:62;padding:13px 30px;border-radius:5px;
    background:#c9b177;color:#2b1d12;border:2px solid #2b1d12;
    box-shadow:0 3px 0 rgba(0,0,0,.5);pointer-events:auto;
    font:bold 13px/1 "Trebuchet MS",sans-serif;letter-spacing:2px}
  #tpickclose.on{display:block}
  .touch-mode #scoreboard{
    max-height:86%;max-width:92%;overflow-y:auto;-webkit-overflow-scrolling:touch;
    top:50%;left:50%;transform:translate(-50%,-50%);font-size:12.5px}
  .touch-mode #scoreboard{z-index:55}
  /* v124: the affordance for "tap to close". A pseudo-element, deliberately — showScoreboard()
     rebuilds innerHTML on every open, so any injected button element would be wiped. The whole
     panel is the tap target; this only has to SAY so. */
  .touch-mode #scoreboard.tscore::after{content:"\\2715  tap to close";position:sticky;bottom:0;
    display:block;margin:10px -18px -12px;padding:8px;text-align:center;font-size:11px;
    letter-spacing:1px;color:#d8cfae;background:rgba(12,10,8,.92);
    border-top:1px solid rgba(160,150,120,.3)}
  `;
  document.head.appendChild(css);
  layoutStage();

  const fpsEl=document.getElementById("tfps");

  // ---------- which way is up? ----------
  // Which way John turns the phone is his business, not something a script can know when the OS
  // refuses to report it. One button flips the rotation, and it is remembered.
  document.getElementById("tflip").addEventListener("touchend",e=>{
    e.preventDefault(); DIR=-DIR;
    try{localStorage.setItem("reg_touch_dir",String(DIR));}catch(_){}
    fit.last=null; fit();
  },{passive:false});
  document.getElementById("tfull").addEventListener("touchend",e=>{
    e.preventDefault();
    const el=document.documentElement;
    const rq=el.requestFullscreen||el.webkitRequestFullscreen;
    if(rq)Promise.resolve(rq.call(el)).then(()=>{
      if(screen.orientation&&screen.orientation.lock)screen.orientation.lock("landscape").catch(()=>{});
    }).catch(()=>{});
    setTimeout(fit,300);
  },{passive:false});

  // ---------- the twin sticks ----------
  // Both float: the stick appears wherever the thumb lands, which on a phone is the difference
  // between playable and fighting the UI.
  const DEAD=13, RANGE=52;
  function makeStick(zoneId,stickId,onVec,onEnd){
    const zone=document.getElementById(zoneId), st=document.getElementById(stickId);
    const ring=st.querySelector("i"), knob=st.querySelector("b");
    let id=null, ox=0, oy=0;
    zone.addEventListener("touchstart",e=>{
      if(id!==null)return;
      const t=e.changedTouches[0];
      id=t.identifier; ox=t.clientX; oy=t.clientY;
      st.style.display="block";                       // drawn in SCREEN space, never rotated
      ring.style.left=knob.style.left=ox+"px"; ring.style.top=knob.style.top=oy+"px";
      e.preventDefault();
    },{passive:false});
    zone.addEventListener("touchmove",e=>{
      for(const t of e.changedTouches){
        if(t.identifier!==id)continue;
        const dx=t.clientX-ox, dy=t.clientY-oy, m=Math.hypot(dx,dy);
        const c=m>RANGE?RANGE/m:1;
        knob.style.left=(ox+dx*c)+"px"; knob.style.top=(oy+dy*c)+"px";
        const v=mapDelta(dx,dy);                      // ...but STEERING is in stage space
        onVec(m<DEAD?0:v.x/RANGE, m<DEAD?0:v.y/RANGE);
      }
      e.preventDefault();
    },{passive:false});
    const end=e=>{
      for(const t of e.changedTouches){
        if(t.identifier!==id)continue;
        id=null; st.style.display="none"; onEnd();
      }
    };
    zone.addEventListener("touchend",end);
    zone.addEventListener("touchcancel",end);
  }

  // LEFT: movement. v124 writes a REAL vector into moveVec — full 360 degrees, speed proportional
  // to deflection. The boolean keys are still mirrored from it, because they remain the fallback an
  // old host walks a guest with (and several bits of code still read keys.w to mean "am I moving").
  moveVec.analog=true;
  makeStick("tzL","tsL",(ux,uy)=>{
    moveVec.x=ux; moveVec.z=uy;
    const T=0.38;
    keys.a=ux<-T; keys.d=ux>T; keys.w=uy<-T; keys.s=uy>T;
  },()=>{
    moveVec.x=moveVec.z=0;
    keys.w=keys.a=keys.s=keys.d=false;
  });

  // RIGHT: camera. Rate-based — held deflection turns at a speed, integrated per frame.
  // v119: HALVED on John's note (was 2.9 / 2.1 rad-per-sec at full deflection).
  let lookX=0, lookY=0;
  const LOOK_RATE_X=1.45, LOOK_RATE_Y=1.05;
  // v124.1 THE DRAW MOVED TO THE STICK. John, field-testing v124: "archer charge on mobile feels a
  // little odd because currently I cannot move look camera after holding down aimed charged."
  // Correct, and unfixable where it was — FIRE sits under the right thumb and so does the camera
  // stick, and nobody has three thumbs. While AIM is latched the right zone now DRAWS as well as
  // steers: press to nock, slide to aim, lift to loose. One continuous gesture, which is how
  // twin-stick shooters have always done charge shots. The FIRE button still works for anyone who
  // reaches for it.
  // v124.7: the v124.1 version armed the draw on ANY touch of the look zone, so John was loosing
  // arrows every time he glanced around — "I am now firing arrows when I'm just trying to look."
  // Two gates fix it without taking the gesture away:
  //   ARM  — the thumb must rest for 200ms before the bow even starts coming back, so a flick to
  //          look never begins a draw at all;
  //   MIN  — releasing under a quarter draw CANCELS instead of firing. A slow camera pan crosses
  //          the arm delay but nowhere near the minimum, so it still costs you no arrow.
  // A tap on the FIRE button keeps looseing a weak shot: that press is unambiguous.
  const DRAW_ARM=200, DRAW_MIN=0.25;
  let stickDraw=false, stickDownAt=0, armTimer=null;
  function drawClass(){return typeof isDrawClass==="function"&&player&&isDrawClass(player.cls);}
  makeStick("tzR","tsR",(ux,uy)=>{
    lookX=ux;lookY=uy;
    if(!stickDraw&&!armTimer&&aiming&&drawClass()){
      stickDownAt=performance.now();
      armTimer=setTimeout(()=>{armTimer=null;if(aiming&&drawClass())stickDraw=true;},DRAW_ARM);
    }
  },()=>{
    lookX=lookY=0;
    if(armTimer){clearTimeout(armTimer);armTimer=null;}
    if(stickDraw){
      // under the minimum this was a look, not a shot — throw the charge away rather than loose it
      if(player&&(player._drawT||0)/DRAW_FULL<DRAW_MIN)player._drawT=0;
      stickDraw=false;                   // tickDraw sees lmbHeld fall and looses whatever is left
    }
  });

  // ---------- the action pad ----------
  function hold(id,down,up){
    const el=document.getElementById(id);
    el.addEventListener("touchstart",e=>{el.classList.add("on");down();e.preventDefault();},{passive:false});
    const off=e=>{el.classList.remove("on");up();e.preventDefault();};
    el.addEventListener("touchend",off,{passive:false});
    el.addEventListener("touchcancel",off,{passive:false});
  }
  // The big button is CONTEXTUAL. With attacks automatic it would otherwise be dead weight —
  // but John was right that siege still needs a hand: a catapult or trebuchet has to be AIMED
  // and LOOSED by the player, and a ranged unit's aimed shot hits harder than its auto-fire.
  //   lobbing siege, aiming  -> FIRE      (looses the stone at the mark)
  //   troops rallied to you  -> CHARGE    (the F warcry — the biggest thing a player does)
  //   otherwise              -> ATTACK    (razing buildings; auto-attack only handles UNITS)
  let manualAtk=false, lastFill=-1;
  function bigMode(){
    if(placing)return "place";     // v121: laying a foundation owns the pad
    if(!player||!player.alive)return "atk";
    if(siegeAim||aiming)return "fire";
    if(hasRallied())return "charge";
    return "atk";
  }
  function hasRallied(){
    if(typeof units==="undefined")return false;
    for(const v of units)if(v.alive&&v.rally&&v.team===player.team&&(v.rallyBy===player||!v.rallyBy))return true;
    return false;
  }
  hold("tb-atk",()=>{
    const m=bigMode();
    if(m==="place"){ confirmPlace(); return; }
    if(m==="charge"){ if(typeof soundCharge==="function")soundCharge(); return; }
    manualAtk=true;
    if(!gameOver&&player&&player.alive){if(placing)confirmPlace();else playerPrimary();}
  },()=>{manualAtk=false;});
  // v121 AIM IS A TOGGLE. John: holding it is wrong for archers and siege — you need both thumbs
  // free to steer while the shot is lined up, and a trebuchet's arc wants settling time. BLOCK
  // stays a HOLD for melee, because a block is a moment, not a stance.
  function aimClass(){return !!(player&&(player.ranged||player.cls==="catapult"||player.cls==="trebuchet"));}
  let aimLatched=false;
  (function(){
    const el=document.getElementById("tb-block");
    el.addEventListener("touchstart",e=>{
      e.preventDefault();
      if(aimClass()){aimLatched=!aimLatched;rmbHeld=aimLatched;el.classList.toggle("on",aimLatched);}
      else{rmbHeld=true;el.classList.add("on");}
    },{passive:false});
    const off=e=>{
      e.preventDefault();
      if(aimClass())return;                       // a toggle ignores the lift
      rmbHeld=false; el.classList.remove("on");
    };
    el.addEventListener("touchend",off,{passive:false});
    el.addEventListener("touchcancel",off,{passive:false});
  })();
  // ---------- v124 THE CONTEXTUAL RAIL ----------
  // John: "instead of pressing the hamburger button to age up near the town center, can we just
  // have an age up button appear next to the other buttons when near the town center?" — and then
  // the sharper version: it should appear only when the team can actually AFFORD it.
  //
  // Every slot dispatches the key the desktop build already listens for, exactly as the grid does,
  // so there remains ONE implementation of every action and nothing can drift between platforms.
  // E is in this pool rather than pinned to the rail now: with auto-gather doing the common case,
  // a permanent E button was dead weight everywhere except the few spots it means something.
  const ctxEl=document.getElementById("tctx");
  let ctxSig="";
  function syncCtx(){
    const list=(typeof availableActions==="function")?availableActions(3):[];
    const sig=list.map(a=>a.k).join("");
    if(sig===ctxSig)return;              // rebuild only when the SET changes, not every frame
    ctxSig=sig;
    ctxEl.innerHTML=list.map(a=>
      '<div class="tbtn tctxb" data-k="'+a.k+'">'+a.label+'</div>').join("");
    for(const b of ctxEl.querySelectorAll(".tctxb")){
      const k=b.dataset.k;
      if(k==="e"){
        // E is HELD in the sim (gather ticks while it is down) but several interactions fire on
        // the key EDGE, so it needs the flag AND the events — same as the old fixed button.
        b.addEventListener("touchstart",e=>{b.classList.add("on");keys.e=true;
          dispatchEvent(new KeyboardEvent("keydown",{key:"e"}));e.preventDefault();},{passive:false});
        const off=e=>{b.classList.remove("on");keys.e=false;
          dispatchEvent(new KeyboardEvent("keyup",{key:"e"}));e.preventDefault();};
        b.addEventListener("touchend",off,{passive:false});
        b.addEventListener("touchcancel",off,{passive:false});
      }else{
        b.addEventListener("touchend",e=>{
          e.preventDefault();
          dispatchEvent(new KeyboardEvent("keydown",{key:k}));
          setTimeout(()=>dispatchEvent(new KeyboardEvent("keyup",{key:k})),40);
        },{passive:false});
      }
    }
  }
  // v121 PLACEMENT. Desktop rotates a foundation with R and abandons it with Escape — a phone has
  // neither, so John could line up a wall and then had no way to turn it or back out. These two
  // appear only while a ghost is on the ground.
  document.getElementById("tb-rot").addEventListener("touchend",e=>{
    e.preventDefault();
    if(!placing)return;
    placing.rot=((placing.rot||0)+Math.PI/4)%(Math.PI*2);
    if(typeof ghost!=="undefined"&&ghost)ghost.rotation.y=placing.rot;
  },{passive:false});
  document.getElementById("tb-cancel").addEventListener("touchend",e=>{
    e.preventDefault();
    if(placing)cancelPlacing(); else closeMenus();
  },{passive:false});

  // ---------- THE ACTION GRID — v124: OVERFLOW ONLY ----------
  // Build, Class, Rally, Age Up and Interact were promoted to the contextual rail, where they cost
  // one tap instead of two and only exist when they would work. What is left here is the rare
  // stuff: the things you touch once a match or once a session. The grid stops being the primary
  // interface and becomes a short settings-ish list — but it keeps a FULL copy of every action as
  // a safety net, because a contextual rule that misjudges a situation must never strand you.
  const GRID=[
    ["F","Charge",    "hurl them at your gaze"],
    ["B","Build",     "lay a foundation"],
    ["R","Class",     "change unit at a trainer"],
    ["G","Rally",     "call your 5 nearest"],
    ["T","Age Up",    "at your Town Centre"],
    ["E","Interact",  "quest board · blacksmith"],
    // v124: this was labelled "Respawn", which it never was. Respawn is already AUTOMATIC — the
    // unit loop counts respawnT down and calls respawnUnit at zero, for the player like anyone
    // else. V picks WHERE you come back. John asked for auto-respawn; the game already did it and
    // the button was lying about what it does.
    ["V","Spawn Point","town centre / forward castle"],
    ["\u21b9","Scores", "the roster + kill tally"],
    ["M","Sound",     "volume + mute"],
    ["P","Pixel",     "retro filter"],
    ["⚡","Battery","30fps + softer · saves power"],
    ["H","Help",      "the key list"]
  ];
  const grid=document.getElementById("tgrid");
  const rows=grid.querySelector(".tgrows");
  rows.innerHTML=GRID.map(([k,n,d])=>
    '<div class="tgb" data-k="'+k.toLowerCase()+'">'+n+'<small>'+d+'</small></div>').join("");
  // v122: the SCOREBOARD was unreachable on a phone — it is a HELD Tab on desktop, and a phone has
  // no Tab and no way to hold a menu entry. It becomes a toggle here.
  let scores=false;
  function setScores(v){
    scores=!!v;
    if(typeof showScoreboard==="function")showScoreboard(scores);
    const sb=document.getElementById("scoreboard");
    if(sb)sb.classList.toggle("tscore",scores);
  }
  function tapKey(k){
    if(k==="\u21b9"){ setScores(!scores); return; }
    if(k==="\u26a1"){
      saver=!saver; applySaver();
      if(typeof msg==="function")
        msg(saver?"\u26a1 Battery saver ON \u2014 30fps, softer picture."
                 :"\u26a1 Battery saver OFF \u2014 full frame rate and sharpness.","gold");
      return;
    }
    dispatchEvent(new KeyboardEvent("keydown",{key:k}));
    setTimeout(()=>dispatchEvent(new KeyboardEvent("keyup",{key:k})),40);
  }
  function gridOpen(v){grid.classList.toggle("on",v);}
  for(const b of rows.querySelectorAll(".tgb"))
    b.addEventListener("touchend",e=>{
      e.preventDefault(); gridOpen(false);
      const k=b.dataset.k;
      if(scores&&k!=="\u21b9")setScores(false);
      tapKey(k);
    },{passive:false});
  grid.querySelector(".tgclose").addEventListener("touchend",e=>{e.preventDefault();gridOpen(false);},{passive:false});
  grid.addEventListener("touchend",e=>{if(e.target===grid){e.preventDefault();gridOpen(false);}},{passive:false});
  // v124 THE THREE ESCAPES. One way out of a panel is one bug away from no way out \u2014 the v118
  // rotate gate taught that, and the scoreboard repeated it. An open scoreboard now closes on:
  //   1. a tap anywhere on it,  2. the visible X,  3. the menu button, which closes it before
  //      it will open the grid again.
  const sbEl=document.getElementById("scoreboard");
  if(sbEl){
    sbEl.addEventListener("touchend",e=>{
      if(!scores)return;
      e.preventDefault(); e.stopPropagation(); setScores(false);
    },{passive:false});
  }
  document.getElementById("tb-menu").addEventListener("touchend",e=>{
    e.preventDefault();
    if(scores){setScores(false);return;}          // the scoreboard owns the first press
    gridOpen(!grid.classList.contains("on"));
  },{passive:false});

  // ---------- AUTO-GATHER + AUTO-ATTACK ----------
  // Both drive the SAME flags the desktop player sets by hand — player.facing, lmbHeld, keys.e —
  // rather than calling game functions directly. That matters for multiplayer: those three ride
  // the {t:"input"} packet, so a guest's automation is executed by the host with no new wire
  // format and no chance of the two disagreeing.
  const autoEl=document.getElementById("tauto");
  const REACH=3.2;            // how close you must be for a node to start working itself
  let autoFire=false, resumeNode=null, autoMsg="";
  function isGuest(){return typeof NET!=="undefined"&&NET.mode==="guest";}
  function canGather(){return player&&(player.cls==="villager"||player.cls==="oxcart");}
  function handsFull(){
    const c=player.carry;
    return (c.food+c.gold+c.stone+c.wood)>=carryCap(player);
  }
  function enemyInReach(){
    // UNITS ONLY, deliberately. tryAttack falls through to buildings when no unit is near, and
    // auto-razing whatever you happen to jog past is not what anyone wants. Buildings stay on
    // the manual button.
    if(!player||!player.alive||player.dmg<=0)return null;
    const px=player.root.position.x, pz=player.root.position.z;
    const r=(player.rng||1.6)+0.4, r2=r*r;
    let best=null,bd=r2;
    for(const v of units){
      if(!v.alive||v.team===player.team||v.garrison||v===player)continue;
      const d=dist2(px,pz,v.root.position.x,v.root.position.z);
      if(d<bd){bd=d;best=v;}
    }
    return best;
  }
  function nearestWorkNode(){
    if(!canGather()||handsFull())return null;
    const px=player.root.position.x, pz=player.root.position.z;
    let best=null,bd=REACH*REACH;
    for(const n of nodes){
      if(n.amount<=0)continue;
      if(player.cls==="oxcart"&&n.type!=="wood")continue; // the ox hauls timber only
      const d=dist2(px,pz,n.x,n.z);
      if(d<bd){bd=d;best=n;}
    }
    return best;
  }
  function autoTick(){
    autoFire=false;
    let m="";
    const live=player&&player.alive&&!inMenu&&!gameOver&&!menuOpen&&!placing;
    if(live){
      const foe=enemyInReach();
      if(foe){
        // FIGHT. Turn the BODY toward the target and swing; the CAMERA is never touched — John
        // chose that, and it is the difference between assistance and possession.
        if(player.gathering){resumeNode=player.gathering;player.gathering=null;}
        player.facing=Math.atan2(foe.root.position.x-player.root.position.x,
                                 foe.root.position.z-player.root.position.z);
        if(!aiming&&!siegeAim)autoFire=true; // while AIMING the shot is yours to loose
        m="⚔ engaging";
      }else if(canGather()){
        if(player.gathering){
          m="⛏ gathering"+(handsFull()?" — hands full":"");
        }else if(handsFull()){
          m="hands full — return to the Town Centre";
        }else{
          // resume the tree we were pulled off, else start on whatever we walked up to
          const n=(resumeNode&&resumeNode.amount>0&&
                   dist2(player.root.position.x,player.root.position.z,resumeNode.x,resumeNode.z)<REACH*REACH)
                  ?resumeNode:nearestWorkNode();
          if(n){
            resumeNode=null;
            if(isGuest()){keys.e=true;}          // the host reads held E and works the node for us
            else{player.gathering=n;player.gatherT=0;
              player.facing=Math.atan2(n.x-player.root.position.x,n.z-player.root.position.z);}
            m="⛏ gathering";
          }else if(isGuest())keys.e=false;
        }
      }
      if(!foe&&!canGather())resumeNode=null;
    }
    // v124.1: a thumb on the right stick draws the bow while it steers (see makeStick above).
    // It feeds the SAME lmbHeld flag the button does, so tickDraw, the net packet and the host all
    // see one mechanism — there is no second code path for "drew with the stick".
    lmbHeld=manualAtk||autoFire||(stickDraw&&aiming&&drawClass());
    // v124.7 THE HAUL. John: "when gathering, I can't see how many of each I have gathered, only
    // when I'm full." The carry line lives in the bottom strip, which is the wrong place to watch
    // while your eyes are on the tree — so the count rides the gathering caption itself.
    if(m&&player&&player.carry){
      const c=player.carry, cap=(typeof carryCap==="function")?carryCap(player):0;
      const held=c.food+c.gold+c.stone+c.wood;
      if(held>0){
        // v124.8: "🪵68 (68/300)" said the same number twice. Carrying ONE thing — which is almost
        // always — reads as icon + count-of-capacity and nothing else. The running total only earns
        // its place when there are several kinds in the satchel and no single count is the answer.
        const bits=[];
        if(c.food) bits.push(["🍖",c.food]);
        if(c.gold) bits.push(["🪙",c.gold]);
        if(c.stone)bits.push(["🪨",c.stone]);
        if(c.wood) bits.push(["🪵",c.wood]);
        m+="  "+(bits.length===1
          ? bits[0][0]+" "+bits[0][1]+(cap?"/"+cap:"")
          : bits.map(b=>b[0]+b[1]).join(" ")+(cap?"  "+held+"/"+cap:""));
      }
    }
    if(m!==autoMsg){autoMsg=m;autoEl.textContent=m;autoEl.classList.toggle("on",!!m);}
    // the big button relabels itself for what it would actually do right now
    const bb=document.getElementById("tb-atk");
    const mode=(player&&player.alive)?bigMode():"atk";
    const label=mode==="place"?"PLACE":mode==="fire"?"FIRE":mode==="charge"?"CHARGE":"ATTACK";
    if(bb.textContent!==label)bb.textContent=label;
    // v124 THE DRAW RING. AIM latches (v121) so both thumbs stay free to steer; FIRE is the hold.
    // The ring fills as the bow comes back, so the draw level is readable without looking away
    // from the target — which is the whole reason it is on the button and not in the HUD.
    const fill=(typeof drawFill==="function")?drawFill():0;
    if(fill!==lastFill){
      lastFill=fill;
      bb.style.setProperty("--draw",(fill*360).toFixed(0)+"deg");
      bb.classList.toggle("drawing",fill>0);
      bb.classList.toggle("full",fill>=1);
      // v124.7: and the same number as a bar above the unit panel, where you are already looking
      const dw=document.getElementById("tdraw");
      dw.classList.toggle("on",fill>0);
      dw.classList.toggle("full",fill>=1);
      dw.classList.toggle("weak",fill>0&&fill<DRAW_MIN);
      dw.firstChild.style.width=(fill*100).toFixed(0)+"%";
      dw.lastChild.textContent=fill>=1?"FULL DRAW":(fill<DRAW_MIN?"…":Math.round(fill*100)+"%");
    }
    const blk=document.getElementById("tb-block");
    const bl=aimClass()?"AIM":"BLOCK";
    if(blk.textContent!==bl)blk.textContent=bl;
    // the AIM latch has to let go when the class changes or you die, or you'd walk around aiming
    if(aimLatched&&(!aimClass()||!player||!player.alive||placing)){
      aimLatched=false; rmbHeld=false; blk.classList.remove("on");
    }
    // ROTATE / CANCEL live only while a foundation ghost is on the ground
    const ph=!!placing;
    for(const id of ["tb-rot","tb-cancel"])
      document.getElementById(id).classList.toggle("hide",!ph);
    syncCtx();   // v124: the rail re-reads what you can actually do
  }
  // v124: the picker's escape hatch rides its own loop, because syncPad has already hidden every
  // other control by the time a menu is open — which is exactly how "no way to close a build menu"
  // survived three versions.
  const pickClose=document.getElementById("tpickclose");
  pickClose.addEventListener("touchend",e=>{
    e.preventDefault();
    if(typeof cancelPlacing==="function")cancelPlacing();
    if(typeof closeMenus==="function")closeMenus();
  },{passive:false});
  (function syncPick(){
    requestAnimationFrame(syncPick);
    const open=(typeof menuOpen!=="undefined"&&!!menuOpen);
    if(open!==syncPick.was){syncPick.was=open;pickClose.classList.toggle("on",open);}
  })();

  // ---------- per-frame: integrate the look stick, report the frame rate ----------
  let fr=0,acc=0,worst=999,n=0;
  (function tick(){
    requestAnimationFrame(tick);
    const now=performance.now();
    if(!tick.last){tick.last=now;return;}
    const dt=Math.min(0.05,(now-tick.last)/1000); tick.last=now;
    if(lookX||lookY){
      camYaw-=lookX*LOOK_RATE_X*dt;
      camPitch=Math.max(-0.35,Math.min(1.25,camPitch+lookY*LOOK_RATE_Y*dt));
    }
    try{autoTick();}catch(e){}
    fr++; acc+=dt*1000;
    const fps=1/dt;
    if(dt<0.4&&fps<worst)worst=fps;
    if(acc>=500){
      const avg=fr/(acc/1000);
      // v124.13a: the read-out names the MODE, not just the numbers. "30 fps" on its own gave no
      // way to tell a device that cannot do better from a cap that was silently halving it.
      fpsEl.textContent=Math.round(avg)+" fps (min "+Math.round(worst)+") "+
        (saver?"⚡saver "+SAVER_FPS:"full "+FULL_FPS)+
        " ·"+PR_STEPS[prStep].toFixed(2)+(LOW?"":" high");
      fr=0;acc=0;
      if(++n%20===0)worst=999;
      stepPixelRatio(avg);
    }
  })();

  // v124: give resolution back only when the frame rate genuinely asks. Two consecutive half-second
  // windows under 45 fps step down; eight consecutive windows (4s) comfortably over 55 step back up.
  // The asymmetry is deliberate — dropping should be quick, recovering should be slow, or the
  // renderer oscillates every time you walk past a melee.
  // v124.12 THE BLACK FLASHES. John: "getting a lot of black screen flashes on mobile." Mine.
  // EVERY ratio change calls setPixelRatio + setSize, which REALLOCATES the WebGL drawing buffer —
  // and a reallocated buffer shows one undrawn frame. That is the flash. One is invisible; a
  // stream of them is what he saw.
  //
  // The v124 thresholds made a stream inevitable: step down after 1s under 45, back up after 4s
  // over 55. A phone reporting "60 fps (min 20)" sits exactly in that trap — the average clears 55
  // while walking, then a melee drags it under 45 — so it paced up and down forever, one black
  // frame each way.
  //
  // Three changes, and the third is the one that actually guarantees it stops:
  //   1. A WIDE dead band (38 / 58) instead of a 10-point gap, so ordinary swings sit inside it.
  //   2. Long confirmation — 3s to drop, 10s to recover — plus a 12s cooldown between ANY changes.
  //   3. A HARD BUDGET. After PR_MAX_CHANGES the ratio is frozen for the match. If my thresholds
  //      are still wrong for a device I have never held, the flashing ends anyway. An adaptive
  //      system that cannot stop adapting is worse than a fixed guess.
  // v124.13a THE ADAPTIVE RATIO IS RETIRED.
  // It was introduced in v124 to answer "the picture is blurry", tuned twice, and caused a bug
  // both times: v124.12's black flashes (every change reallocates the drawing buffer) and then
  // this round's confusion — John toggled the saver OFF and the controller quietly stepped the
  // ratio back DOWN to 0.70 behind him, so the switch looked broken. Now that there is an
  // explicit user-facing dial, a second invisible one guessing against it is strictly worse.
  // The ratio is whatever the Battery toggle says and it never moves on its own: two states,
  // both deterministic, zero reallocations after the first frame, and no more flashes by
  // construction. If a device genuinely cannot hold 60, the saver is one tap away and the
  // read-out says which mode it is in.
  function stepPixelRatio(){}

  // ---------- the controls yield to the menus ----------
  // Every menu and overlay is DOM. A stick held when one opens would leave the player walking
  // into a wall, and the zones would sit under a finger aiming at a button.
  const CTRLS=["tzL","tzR","tbtns"].map(id=>document.getElementById(id));
  let padHidden=null;
  (function syncPad(){
    requestAnimationFrame(syncPad);
    const busy=(typeof inMenu!=="undefined"&&inMenu)||
               (typeof gameOver!=="undefined"&&gameOver)||
               (typeof menuOpen!=="undefined"&&!!menuOpen)||
               (typeof player==="undefined"||!player||!player.alive);
    if(busy===padHidden)return;
    padHidden=busy;
    for(const el of CTRLS)el.style.display=busy?"none":"";
    if(busy){
      gridOpen(false);
      keys.w=keys.a=keys.s=keys.d=false; keys.e=false;
      lmbHeld=false; rmbHeld=false; lookX=lookY=0;
      for(const id of ["tsL","tsR"])document.getElementById(id).style.display="none";
      for(const b of document.querySelectorAll(".tbtn"))b.classList.remove("on");
    }
  })();

  // ---------- keep the feed to a whisper ----------
  // msg() trims to 6, which on a 1180-wide phone stage is a wall of text over the battlefield.
  // An observer trims to 3 without touching the shared msg() the desktop build relies on.
  const feedEl=document.getElementById("feed");
  const FEED_MAX=2;   // v124: two, not three — the banner below carries anything that matters
  // ---------- v124 THE BANNER ----------
  // John: "fewer, but louder for the big ones." The feed is where routine chatter goes to be
  // ignored; a king under attack or an age landing should not have to compete with it. msg() already
  // classifies its own output — "warn" and "gold" are the two kinds the game reserves for things
  // that change your decisions — so promote exactly those and leave msg() itself alone, which keeps
  // the desktop build untouched.
  // v124.7 WHAT EARNS THE MIDDLE OF THE SCREEN. v124 promoted every "warn" and "gold" line, and the
  // AI's own scouting chatter is tagged gold — so "Red riders wheel toward their workers..." took
  // over the centre of the battlefield every time a band changed its mind. John: "middle of screen
  // should only be for most important messaging (when team or enemy ages up, when Vikings spawn)."
  // An ALLOW-list, not a severity flag: severity is a property the sender chose for a feed line,
  // and it turns out to be a poor proxy for "stop what you are doing and read this."
  const BANNER_WORTHY=/\b(AGE|ERA|ADVANC|GRAND ARMY|VIKING|LONGSHIP|RAID LAND|KING IS BADLY WOUNDED|KING HAS FALLEN|REGICIDE|SLAIN THE|WAR IS WON)\b/i;
  const banner=document.getElementById("tbanner");
  let bannerT=null;
  function showBanner(text,warn){
    banner.textContent=text;
    banner.classList.toggle("warn",!!warn);
    banner.classList.add("on");
    clearTimeout(bannerT);
    bannerT=setTimeout(()=>banner.classList.remove("on"),2600);
  }
  if(feedEl&&typeof MutationObserver!=="undefined"){
    const trim=()=>{while(feedEl.children.length>FEED_MAX)feedEl.removeChild(feedEl.firstChild);};
    new MutationObserver(muts=>{
      for(const m of muts)for(const n of m.addedNodes){
        if(!n.classList)continue;
        if(BANNER_WORTHY.test(n.textContent||"")){
          showBanner(n.textContent,n.classList.contains("warn"));
          // v124.1: PROMOTED, not copied. v124 raised the line to the banner and left it in the
          // feed as well, so John read "Red riders wheel toward their workers..." twice on one
          // screen. A message belongs in exactly one place.
          n.remove();
        }
      }
      trim();
    }).observe(feedEl,{childList:true});
    trim();
  }
  // ---------- v124 the map is behind a tap ----------
  document.getElementById("tmap").addEventListener("touchend",e=>{
    e.preventDefault();
    document.documentElement.classList.toggle("tmapon");
  },{passive:false});

  console.log("[touch] mobile active — gfx",LOW?"low":"high","rot",ROT?DIR:"none");
})();
