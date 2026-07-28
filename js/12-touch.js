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
  // `screen` and `navigator` are the honest tells — checking only the first two made the whole
  // bundle fail to load with "screen is not defined".
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
  if(LOW){
    try{
      composer=null;                                // 09-main falls back to renderer.render()
      renderer.shadowMap.enabled=false;
      renderer.setPixelRatio(Math.min(devicePixelRatio,PR_STEPS[prStep]));
      if(typeof setHideD==="function")setHideD(105);
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
    for(const id of ["resources","agebar","roster","carry"]){
      const el=document.getElementById(id);
      if(el)bar.appendChild(el);
    }
    // carry and the roster only earn their segment when they have something to say
    const carry=document.getElementById("carry");
    const roster=document.getElementById("roster");
    let rHot=0;
    if(roster&&typeof MutationObserver!=="undefined")
      new MutationObserver(()=>{rHot=performance.now();}).observe(
        roster,{childList:true,characterData:true,subtree:true});
    (function tickBar(){
      requestAnimationFrame(tickBar);
      if(carry)carry.classList.toggle("thidden",getComputedStyle(carry).display==="none"||
        !(typeof player!=="undefined"&&player&&player.carry&&
          (player.carry.food+player.carry.gold+player.carry.stone+player.carry.wood)>0));
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
  .tzone{position:absolute;bottom:0;height:74%;pointer-events:auto}
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
  #tauto{position:absolute;left:50%;bottom:calc(112px + var(--sb));transform:translateX(-50%);
    padding:4px 12px;
    border-radius:3px;color:#fff;background:rgba(0,0,0,.42);font-size:12px;display:none}
  #tauto.on{display:block}
  /* HUD triage — every left/top anchored panel is pushed clear of the notch via --sl/--st */
  #tstage{--sl:0px;--st:0px;--sr:0px;--sb:0px}
  /* ---------- v124 ONE STRIP ----------
     Four stacked panels down the left edge ate a quarter of a phone screen. Resources and the age
     bar are the only two you want CONSTANTLY, so they share one line; roster and carry are
     situational and now appear only when they have something to say (see syncHud below). */
  /* v124.1 ONE SOLID BAR. John: "all the stuff at the top UI wise just needs to be in one solid
     bar." v124 put resources and the age on the same LINE but they were still three separate
     parchment boxes with their own borders, on two rows, and the age bar ran under the king
     panels. They are now segments of a single strip: one background, one border, hairline
     dividers between them, and the whole thing sized to stop short of the kings. */
  .touch-mode #tbar{position:absolute;left:calc(8px + var(--sl));top:calc(6px + var(--st));
    z-index:22;display:flex;align-items:stretch;height:34px;max-width:600px;overflow:hidden;
    background:rgba(24,20,14,.86);border:2px solid #2b1d12;border-radius:5px;
    box-shadow:0 2px 0 rgba(0,0,0,.45)}
  .touch-mode #tbar>*{position:static!important;transform:none!important;margin:0!important;
    display:flex!important;align-items:center;background:none!important;border:0!important;
    border-radius:0!important;box-shadow:none!important;padding:0 10px!important;
    white-space:nowrap;font-size:12px!important;line-height:1!important;max-width:none!important;
    opacity:1;transition:none}
  .touch-mode #tbar>*+*{border-left:1px solid rgba(160,150,120,.32)!important}
  .touch-mode #tbar #agebar,.touch-mode #tbar #roster{font-size:11px!important}
  .touch-mode #tbar #carry{color:#e6c86a}
  .touch-mode #tbar>.thidden{display:none!important}
  /* THE BANNER — John: fewer lines, but the big ones unmissable */
  #tbanner{position:absolute;left:50%;top:calc(84px + var(--st));transform:translateX(-50%) translateY(-8px);
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
  .touch-mode.tmapon #minimapwrap{display:block;transform:scale(.92);transform-origin:top right;
    right:calc(62px + var(--sr));top:calc(8px + var(--st))}
  .touch-mode #kings{top:calc(10px + var(--st))}
  .touch-mode #objective{transform:scale(.8);transform-origin:top center;top:calc(74px + var(--st))}
  .touch-mode #playerhud{transform:translateX(-50%) scale(.78);bottom:calc(4px + var(--sb))}
  .touch-mode #tbtns{right:calc(10px + var(--sr));bottom:calc(12px + var(--sb))}
  .touch-mode #ttop{top:calc(5px + var(--st))}
  /* THE FEED. v120 set a font-size on #feed, but .msg carries its own — so nothing changed and
     tutorial hints covered half the battlefield. Style the ENTRIES, cap the width, and clamp
     each one to two lines; the count is trimmed in JS below. */
  /* px, not vw: inside a rotated stage the vw unit still means the VIEWPORT, which is the SHORT
     edge — 34vw came out as a 185px ribbon that wrapped every hint into six lines.
     (backticks are banned in here: this whole block is a JS template literal) */
  .touch-mode #feed{left:calc(14px + var(--sl));bottom:calc(14px + var(--sb));
    max-height:34%;max-width:360px}
  .touch-mode #feed .msg{font-size:10.5px;padding:3px 7px;line-height:1.32;
    max-height:2.9em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
    overflow:hidden;text-overflow:ellipsis}
  .touch-mode #helptoggle,.touch-mode #help,.touch-mode #questhud{display:none !important}
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
  .touch-mode #startmenu .netnote{display:none}
  .touch-mode #startmenu .verstamp{font-size:10px;opacity:.55;margin:4px 0 0}
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
  #tpickclose{position:absolute;left:50%;bottom:calc(14px + var(--sb));transform:translateX(-50%);
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
  let stickDraw=false;
  function drawClass(){return typeof isDrawClass==="function"&&player&&isDrawClass(player.cls);}
  makeStick("tzR","tsR",(ux,uy)=>{
    lookX=ux;lookY=uy;
    if(!stickDraw&&aiming&&drawClass()){stickDraw=true;}
  },()=>{
    lookX=lookY=0;
    if(stickDraw){stickDraw=false;}      // lifting the thumb looses it — tickDraw sees lmbHeld fall
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
      fpsEl.textContent=Math.round(avg)+" fps (min "+Math.round(worst)+")"+
        (LOW?" low":" high")+(prStep?" ·"+PR_STEPS[prStep].toFixed(2):"");
      fr=0;acc=0;
      if(++n%20===0)worst=999;
      stepPixelRatio(avg);
    }
  })();

  // v124: give resolution back only when the frame rate genuinely asks. Two consecutive half-second
  // windows under 45 fps step down; eight consecutive windows (4s) comfortably over 55 step back up.
  // The asymmetry is deliberate — dropping should be quick, recovering should be slow, or the
  // renderer oscillates every time you walk past a melee.
  let prLow=0,prHigh=0;
  function stepPixelRatio(avg){
    if(!LOW)return;                       // ?gfx=high owns its own ratio
    if(avg<45){ prHigh=0; if(++prLow>=2&&prStep<PR_STEPS.length-1){prLow=0;setPR(prStep+1);} }
    else if(avg>55){ prLow=0; if(++prHigh>=8&&prStep>0){prHigh=0;setPR(prStep-1);} }
    else { prLow=0; prHigh=0; }
  }
  function setPR(step){
    prStep=step;
    try{
      renderer.setPixelRatio(Math.min(devicePixelRatio,PR_STEPS[step]));
      fit(true);                          // setPixelRatio alone does not resize the backing store
      console.log("[touch] pixel ratio ->",PR_STEPS[step]);
    }catch(e){}
  }

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
        if(n.classList.contains("warn")||n.classList.contains("gold")){
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
