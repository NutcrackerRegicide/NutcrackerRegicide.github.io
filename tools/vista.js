/* REGICIDE PVP — tools/vista.js — LOOK AT THE GAME (v128)
   -------------------------------------------------------
   node tools/vista.js [outdir]

   Dev-only, not part of the verify chain. Renders the real world from a handful of fixed
   camera setups so a graphics change can be EYEBALLED instead of argued about. Every shot is
   deterministic (the world build is seeded, and the game loop is frozen before the first
   capture), so two runs of this tool differ only by what actually changed in the renderer.

   Shots are chosen to cover the things a stylised-cartoon pass has to get right:
     · a wide meadow    — ground colour, grass density, fog, sky
     · a town           — building silhouettes, roof reds, road paving
     · a forest edge    — canopy greens against the ground greens
     · a close crowd    — how the toon ramp reads on characters at gameplay distance
     · a low sun angle  — whether the ramp bands cleanly or muddies                          */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=process.argv[2]||path.join(ROOT,"_vista");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{
    const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}
    catch(e){r.writeHead(404);r.end();}
  }).listen(8127);
  const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:1100,height:620}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message+"\n"+(e.stack||"").split("\n").slice(0,4).join("\n")));
  page.on("console",m=>{const t=m.text();if(/error|fail|undefined/i.test(t))console.log("[console] "+t.slice(0,180));});
  await page.goto("http://localhost:8127/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){}
    window.requestAnimationFrame=()=>0;      // freeze: the loop would re-render from its own camera
  });
  await page.waitForTimeout(600);
  // let the world settle a little so villagers are out working, then freeze again
  await page.evaluate(()=>{try{for(let i=0;i<120;i++)tickBody(true);}catch(e){}});
  await page.waitForTimeout(200);

  const TC=await page.evaluate(()=>{const t=teamTC(0);return t?[t.x,t.z]:[-175,0];});
  const SHOTS=[
    {name:"01-meadow",   pos:[  20, 14,  60], look:[  10, 2,  10]},
    {name:"02-town",     pos:[TC[0]+34, 20, TC[1]+40], look:[TC[0], 3, TC[1]]},
    {name:"03-forest",   pos:[ -40, 12, -60], look:[ -70, 4, -95]},
    {name:"04-crowd",    pos:[TC[0]+14,  6, TC[1]+16], look:[TC[0]+2, 2.2, TC[1]+2]},
    // v131 …AND THE FIFTH SHOT NOW ACTUALLY GETS A LOW SUN. `hour` is the dial 02-world.js's
    // setSunHour() exposes: 0 is §3.1's 49.4° noon, 1 is 21° with the warm rig and the long
    // shadows. Every shot before this one had the SAME hardcoded light written into the block
    // below, so "05-lowsun" was a second copy of 01-meadow with the camera moved and it tested
    // nothing at all. The shot is left where it stands so the pair against _baseline_v129.4 is
    // still the same vantage; what changed is the hour, which is the whole point of the shot.
    {name:"05-lowsun",   pos:[  60,  7,  10], look:[  10, 2.5, 10], hour:1},
    {name:"06-wide",     pos:[   0, 60, 130], look:[   0, 0, 0]},
    // v131.1 …AND A SEVENTH, BECAUSE THE HOUR WAS LANDING AND THE PICTURE WAS NOT SHOWING IT.
    // 05-lowsun proves the RAMP at a grazing sun — that is what the header above says it is for and
    // it now does it. What it cannot show is the other half of what a low sun buys, because §3.1's
    // azimuth puts the sun behind the camera on that vantage: every shadow in frame is cast into
    // the distance, hidden behind the thing that throws it. A shot can be lit at 21° and still
    // photograph no shadow at all, which is how "the low sun vantage tests nothing" survives being
    // fixed once. The reference this is chasing (AoE Online) gets most of its depth from long
    // shadows running ACROSS the ground toward the viewer, and nothing in the six frames had one.
    // So: same hour, camera moved DOWN-SUN of the subject and turned back toward it, which is where
    // a shadow runs at the lens instead of away from it. Sun ground bearing is 33.7° off world X
    // (atan2(80,120)), so shadows lie along (-0.83,-0.55) and this eye sits on that line at 20° off,
    // looking back up it.
    // THE 20° IS THE WHOLE FRAMING AND IT WAS PICKED BY SHOOTING FOUR OF THEM. Dead into the sun and
    // every shadow hides behind its own caster again, one axis rotated; square across it and they
    // run out of frame sideways. At 20° they rake diagonally across open meadow and the near stand
    // is backlit, which is also the angle that puts the sun disc in the top of the frame — free, and
    // the only shot in the set where the light source is visible at all.
    // AND IT LOOKS ACROSS THE MEADOW, NOT INTO THE WOOD. A shadow needs somewhere flat and open to
    // land; the first framing put a broadleaf crown across the near third and photographed a tree.
    // IT IS AN ADDITION, NOT A MOVE. 05-lowsun stays exactly where it was so its pair against
    // _baseline_v129.4 is still the same vantage; this one has no baseline and artcheck will render
    // it without a pair, which is correct — there is nothing in the v129.4 freeze to compare it to.
    {name:"07-downsun",  pos:[ -34, 10, -52], look:[  14, 2.0, 12], hour:1}
  ];
  for(const s of SHOTS){
    await page.evaluate(({pos,look,hour})=>{
      camera.position.set(pos[0],pos[1],pos[2]);
      camera.lookAt(look[0],look[1],look[2]);
      camera.updateProjectionMatrix();
      if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
      // v129.5 THE SUN HAS TO FOLLOW THE SHOT, OR THIS TOOL PHOTOGRAPHS A LIE.
      // The shadow camera is a tight ±70 box that `renderFrame` re-centres on the player every
      // frame (09-main.js:785). This tool freezes requestAnimationFrame, so renderFrame never runs
      // and the box stays parked at the world origin — while the town and crowd shots sit ~175
      // units away at the blue Town Centre. Those shots rendered with NO SHADOWS AT ALL, and the
      // game has had working shadows the whole time. Anyone judging "the units look like they are
      // floating" off these images was judging the harness, not the game. Re-centre on the shot's
      // look-at point using renderFrame's own offsets before asking for the shadow map.
      // v131 THE LIGHT IS NO LONGER WRITTEN DOWN HERE. This block used to hardcode (120,168,80) —
      // a second copy of §3.1's vector, in the harness, where nobody tuning the real rig would ever
      // find it, and where it silently made "05-lowsun" a duplicate of the noon shots for three
      // versions. setSunHour(t, x, z) in 02-world.js is the one door: it aims the box AND sets the
      // hour, and it moves _SUN_OFF itself so the change survives an unfrozen game loop.
      if(typeof setSunHour==="function"){
        setSunHour(hour||0,look[0],look[2]);
      }else if(typeof sun!=="undefined"&&sun&&sun.target){
        sun.target.position.set(look[0],0,look[2]);
        sun.target.updateMatrixWorld();
        sun.position.set(look[0]+120,168,look[2]+80);
        sun.updateMatrixWorld();
      }
      if(typeof renderer!=="undefined"){
        renderer.shadowMap.needsUpdate=true;
        if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
      }
    },s);
    await page.waitForTimeout(120);
    await page.screenshot({path:path.join(OUT,s.name+".png")});
    console.log("shot",s.name);
  }
  // v131.2 THIS READ-OUT HAD BEEN PRINTING "1 draw calls · 1 triangles" AND NOBODY NOTICED,
  // WHICH MEANS §9.3'S ENTIRE BUDGET WAS WRITTEN IN A NUMBER THIS TOOL COULD NO LONGER PRODUCE.
  // Two faults, and they compounded:
  //   · `renderer.info.render` is reset at the top of every renderer.render(), and the LAST thing
  //     a composer frame draws is the grade's full-screen pass — one triangle, one call. So the
  //     read below was reporting the output quad, every time, ever since the composer went in.
  //     The 607/174,803 in artcheck's BASE_METRICS is from before that and IS a scene pass, so the
  //     baseline was never wrong; the measurement quietly stopped being the same measurement.
  //   · It also sampled wherever the loop left the camera — 07-downsun, a vantage that has no
  //     baseline at all. The 607 was taken at 06-wide. Re-aim before measuring or the number is
  //     not comparable with the thing it is printed beside.
  // BOTH NUMBERS NOW, EACH LABELLED WITH HOW IT WAS TAKEN, because they answer different questions
  // and this project has already been burned once by two measurements wearing one name (see the
  // note at artcheck.js BASE_METRICS). `render:` is the scene pass at 06-wide — the like-for-like
  // against the freeze, and the line artcheck parses. `frame:` is the whole composer chain, which
  // is what the game actually submits; §9.1 prices the post stack at +14 calls independent of scene.
  const WIDE=SHOTS.find(s=>s.name==="06-wide");
  const stats=await page.evaluate(({pos,look})=>{
    camera.position.set(pos[0],pos[1],pos[2]);
    camera.lookAt(look[0],look[1],look[2]);
    camera.updateProjectionMatrix();
    if(typeof applyLOD==="function")try{applyLOD();}catch(e){}
    if(typeof setSunHour==="function")setSunHour(0,look[0],look[2]);
    renderer.shadowMap.needsUpdate=true;
    // autoReset is left ON for this one: it resets at the top of render() and AFTER the shadow
    // pass (§9.1), so this is the camera pass alone — exactly how the 607 was captured.
    renderer.render(scene,camera);
    const sceneCalls=renderer.info.render.calls, sceneTris=renderer.info.render.triangles;
    let frameCalls=null,frameTris=null;
    if(typeof composer!=="undefined"&&composer){
      renderer.info.autoReset=false; renderer.info.reset();
      renderer.shadowMap.needsUpdate=true; composer.render();
      frameCalls=renderer.info.render.calls; frameTris=renderer.info.render.triangles;
      renderer.info.autoReset=true;
    }
    return {calls:sceneCalls,tris:sceneTris,frameCalls,frameTris,
      geos:renderer.info.memory.geometries,texs:renderer.info.memory.textures,
      objs:scene.children.length};
  },WIDE);
  console.log("render: "+stats.calls+" draw calls · "+stats.tris+" triangles · "+
    stats.geos+" geometries · "+stats.texs+" textures · "+stats.objs+" scene children"+
    "   (scene pass at 06-wide)");
  if(stats.frameCalls!==null)
    console.log("frame : "+stats.frameCalls+" draw calls · "+stats.frameTris+
      " triangles   (whole composer chain incl. shadow + post, same vantage)");
  await browser.close(); srv.close();
  process.exit(0);
})();
