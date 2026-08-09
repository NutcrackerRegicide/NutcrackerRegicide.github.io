#!/usr/bin/env node
/* v132.12 — DOES A CAMP THAT IS BEING SHOT AT ACTUALLY NOTICE?
   -----------------------------------------------------------
   node tools/creepwake.js

   John: "slingers attacking wolves and wolves not aggroing." v132.10 says it fixed that. This is
   the difference between saying so and knowing.

   It drives the real updateCreep against a real unit at a real standoff, and it asserts THREE
   things, because a fix that only satisfies the first is a worse bug than the one it replaces:

     BEFORE   a ranged unit standing outside the aggro ring and NOT shooting is ignored. If this
              fails, the fix was "make aggro bigger", and every camp now drags in anything that
              walks past — including the trade carts on the Viking road, which was the whole reason
              the woken scan reaches only as far as the actual attacker.
     DURING   one hit lands, and the WHOLE PACK closes on the shooter. Not one creep — the wake
              lives on the camp state precisely so that a single stone brings all of them.
     AFTER    CAMP_WAKE seconds later the camp settles and they walk home. A cheat that never turns
              off is worse than no cheat, and a leash that never comes back is a creep loose on the
              map for the rest of the match.

   THE STANDOFF IS THE REAL ONE. An interior camp is r 11, so its aggro ring is 8.5 and its creeps
   sit 3.85 out from the centre. A slinger has range 16. Standing 18 from the centre it is 14.15
   from the nearest creep — comfortably able to shoot, comfortably outside the ring. That is the
   exact geometry in John's screenshot and it is what the shipped code could not see.            */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8302);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8302/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof campStates!=="undefined"&&campStates.length&&typeof updateBot==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} try{gameOver=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    const R={};
    const idx=CREEP_SITES.findIndex(c=>c.inner);
    const st=campStates[idx];
    R.camp={i:idx,x:st.x,z:st.z,r:st.r,aggro:+st.aggro.toFixed(1),kind:st.kind};
    const pack=st.creeps.filter(u=>u.alive);
    if(pack.length<3)return {err:"the test camp only has "+pack.length+" creeps awake"};

    // stand the shooter on the bearing of one creep's post, 18 out — outside the 8.5 ring, inside
    // a slinger's 16 of the creep itself.
    const post=pack[0].bot.post, D=18;
    const sx=st.x+Math.cos(post.a)*D, sz=st.z+Math.sin(post.a)*D;
    const gun=makeUnit(0,"slinger",sx,sz,{name:"Probe"});
    gun.root.position.set(sx,terrainHeight(sx,sz),sz);
    R.standoff={fromCentre:D,fromNearestCreep:+Math.min(...pack.map(u=>
      Math.hypot(u.root.position.x-sx,u.root.position.z-sz))).toFixed(2),
      slingerRange:CLS.slinger.rng};

    const nearest=()=>Math.min(...pack.filter(u=>u.alive).map(u=>
      Math.hypot(u.root.position.x-sx,u.root.position.z-sz)));
    // LEFT POST, NOT "IS NEAR THE SHOOTER". The first cut counted creeps within D-3 of the slinger,
    // and the slinger was deliberately placed on one creep's own bearing — so that creep scored as
    // having charged while standing perfectly still at its post. Displacement from its OWN post is
    // the only thing that means it moved.
    const offPost=()=>pack.filter(u=>u.alive&&Math.hypot(
      u.root.position.x-(st.x+Math.cos(u.bot.post.a)*u.bot.post.r),
      u.root.position.z-(st.z+Math.sin(u.bot.post.a)*u.bot.post.r))>2).length;
    // …and the PEAK, not the final state. The probe is a 70hp slinger and a woken wolf pack kills it
    // in about three seconds; once it is dead st.threat.alive goes false, the woken reach collapses
    // back to 8.5 and the rest of the pack walks home — so sampling at the END of the run measured
    // the aftermath of a successful defence and called it a failure. The probe is kept on its feet
    // for the same reason a crash-test dummy is bolted in.
    const run=(n)=>{let best=1e9,peak=0;
      for(let k=0;k<n;k++){
        T+=1/60;
        gun.hp=gun.maxHp; gun.alive=true;            // immortal probe: we are testing them, not it
        for(const u of pack)if(u.alive)updateCreep(u,1/60);
        const d=nearest(); if(d<best)best=d;
        const c=offPost(); if(c>peak)peak=c;
      }
      return {closest:+best.toFixed(2),peak};};

    // ---- BEFORE: present, in range, but not shooting -------------------------------------------
    R.before=Object.assign(run(240),{
      atPost:+Math.min(...pack.map(u=>Math.hypot(
        u.root.position.x-(st.x+Math.cos(u.bot.post.a)*u.bot.post.r),
        u.root.position.z-(st.z+Math.sin(u.bot.post.a)*u.bot.post.r)))).toFixed(2)});

    // ---- DURING: one stone lands ----------------------------------------------------------------
    dealDamage(gun,pack[0],1);
    R.woken=!!(st.wake&&T<st.wake);
    R.during=run(240);

    // ---- AFTER: the camp settles ----------------------------------------------------------------
    T=st.wake+1;
    R.after=Object.assign(run(300),{
      home:+Math.max(...pack.filter(u=>u.alive).map(u=>Math.hypot(
        u.root.position.x-st.x,u.root.position.z-st.z))).toFixed(2),
      leash:+(st.r-1.2).toFixed(1)});
    R.packN=pack.length;
    return R;
  });

  if(out.err){console.log("!! "+out.err);await b.close();srv.close();process.exit(1);}
  let bad=0; const F=ok=>{if(!ok)bad++;return ok?"   ok":"   *** FAIL";};
  console.log("\n  camp "+out.camp.i+" ("+out.camp.kind+") at ("+out.camp.x+", "+out.camp.z+")  r "+
    out.camp.r+"  aggro "+out.camp.aggro+"   pack of "+out.packN);
  console.log("  a slinger (range "+out.standoff.slingerRange+") stands "+out.standoff.fromCentre+
    " from the centre — "+out.standoff.fromNearestCreep+" from the nearest creep.");
  console.log("  It can shoot them. The aggro ring cannot see it.\n");

  console.log("  BEFORE — present and in range, but has not fired");
  console.log("    nearest creep got to "+out.before.closest+" of it; "+out.before.peak+
    " of the pack ever left post"+F(out.before.peak===0));
  console.log("    (if this fails the fix was just a bigger ring, and every cart on the road is prey)");

  console.log("\n  DURING — one stone lands");
  console.log("    the camp is awake: "+out.woken+F(out.woken));
  console.log("    nearest creep got to "+out.during.closest+" of it"+F(out.during.closest<3.5));
  console.log("    "+out.during.peak+" of "+out.packN+" came for it — the whole pack, not one"+
    F(out.during.peak>=out.packN-1));

  console.log("\n  AFTER — the wake expires");
  console.log("    furthest creep is "+out.after.home+" from the camp centre, leash is "+out.after.leash+
    F(out.after.home<=out.after.leash+0.05));

  console.log("\n  "+(bad?bad+" check(s) failed -> FAIL":"a camp under fire wakes, closes, and goes home -> PASS")+"\n");
  await b.close(); srv.close(); process.exit(bad?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
