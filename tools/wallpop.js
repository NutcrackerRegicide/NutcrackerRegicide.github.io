#!/usr/bin/env node
/* v131.34 — CAN YOU GET ON TOP OF A WALL WITHOUT USING THE RAMP?
   --------------------------------------------------------------
   node tools/wallpop.js

   John: "the ramps on the walls dont even have to be used, you can kind of just walk up to wall and
   pop up on to the top of it which is kind of janky."

   Two claims, and they pull in opposite directions, so a probe that only tests one of them is how
   you fix the pop by breaking the ramp:

     THE POP    walking at the curtain anywhere OTHER than the ramp must leave you on the ground.
     THE RAMP   walking up the ramp lane must still put you on the deck at 4.00.

   So this drives a real player body with the game's own moveUnit + the real per-frame height hug,
   at a spread of offsets along a real wall run, and reports the height each one ends at. Ground is
   a pass everywhere except the ramp lane, where 4.00 is the pass.

   The hug is the thing under test and it lives in renderFrame, so it is reproduced here from
   09-main.js rather than called -- driving whole frames would bring the AI, the netcode and the
   composer along for a geometry question. If that line changes, this one has to change with it.  */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8286);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8286/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    const WX=0, WZ=40;
    for(const t of buildings.slice())t.alive=false;
    teamAge[0]=5;
    if(!walkable(WX,WZ-16)||!walkable(WX,WZ+16))return {err:"test site not walkable"};
    const made=[];
    for(let i=-1;i<=1;i++){const bl=makeBuilding(0,"fort_wall",WX+i*10.9,WZ,true,0);
      if(bl){bl.built=true;bl.alive=true;made.push(bl);}}
    if(!made.length)return {err:"makeBuilding refused fort_wall"};
    const deck=made[0].root.position.y+4.0;

    // the hug, reproduced from 09-main.js — see the header
    const hug=(u)=>{
      let wf=(typeof wallFloorAt==="function")?wallFloorAt(u.root.position.x,u.root.position.z):null;
      if(wf!==null&&!(u.root.position.y>wf-1.2))wf=null;
      u.root.position.y=(wf!==null)?wf:terrainHeight(u.root.position.x,u.root.position.z);
    };
    const drive=(x0,z0,dz)=>{
      const u=makeUnit(0,"villager",x0,z0,{name:""});
      u.isPlayer=true; u.spd=6;
      u.root.position.set(x0,terrainHeight(x0,z0),z0);
      let top=u.root.position.y;
      for(let k=0;k<900;k++){
        moveUnit(u,0,dz,1/60); hug(u);
        if(u.root.position.y>top)top=u.root.position.y;
      }
      const end=u.root.position.y, gy=terrainHeight(u.root.position.x,u.root.position.z);
      u.alive=false; u.root.visible=false; if(u.root.parent)u.root.parent.remove(u.root);
      return {top:+top.toFixed(2),end:+end.toFixed(2),over:+(end-gy).toFixed(2)};
    };
    // v132.20 THE RAMP TURNED NINETY DEGREES, so the lane it occupies turned with it: it is now the
    // narrow strip |lx| <= WALL_RAMP_HX (1.1) running back in z from the deck edge. Everywhere ELSE
    // along the curtain must still leave you on the ground — so the offsets below skip the ramp
    // lane instead of skipping a range of x.
    const rows=[];
    for(const lx of [-9,-6,-4,-2.6,2.6,4,6,9]){
      rows.push({lx,back:drive(WX+lx,WZ-16,+1),front:drive(WX+lx,WZ+16,-1)});
    }
    // v132.20 AND NOW IT DOES RISE TOWARD THE WALL. The note that used to stand here recorded the
    // opposite — "the ramp rises along x, not toward the wall… you climb a wall ramp by walking
    // ALONG the back of the wall" — and that WAS true, and it is the reason John could not find the
    // ramp at all: one you approach sideways is one nobody uses. It is perpendicular now, so the
    // drive is the obvious one: stand behind the wall on the ramp's centreline and walk at it.
    // ONE LEG, because a perpendicular ramp lands ON the deck rather than beside it — the old
    // two-leg drive existed only because the along-the-wall ramp shared 0.6 of z with the deck and
    // its top was a landing you had to turn off.
    const rampDrive=()=>{
      const z0=WZ-9.6;                       // just behind the ramp's foot at model z -9.4
      const u=makeUnit(0,"villager",WX,z0,{name:""});
      u.isPlayer=true; u.spd=6;
      u.root.position.set(WX,terrainHeight(WX,z0),z0);
      let top=u.root.position.y;
      for(let k=0;k<900&&u.root.position.z-WZ<-2.4;k++){
        moveUnit(u,0,1,1/60); hug(u);
        if(u.root.position.y>top)top=u.root.position.y;
      }
      const r={top:+top.toFixed(2),end:+u.root.position.y.toFixed(2),
               x:+(u.root.position.x-WX).toFixed(1),z:+(u.root.position.z-WZ).toFixed(1)};
      u.alive=false; u.root.visible=false; if(u.root.parent)u.root.parent.remove(u.root);
      return r;
    };
    return {rows,deck:+deck.toFixed(2),ramp:rampDrive()};
  });

  if(out.err){console.log("!! "+out.err);await b.close();srv.close();process.exit(1);}
  console.log("\n  a real body driven at a 3-segment Enlightenment curtain. deck height is "+out.deck+".");
  console.log("  the ramp lane is model |x| <= 1.1, running back in z. Everywhere else must");
  console.log("  leave you on the ground.\n");
  console.log("   model x    walking AT the wall from BEHIND      from the FRONT");
  let bad=0;
  for(const r of out.rows){
    const okB=r.back.over<1.0, okF=r.front.over<1.0;   // walking AT a wall never lifts you
    if(!okB||!okF)bad++;
    console.log("   "+String(r.lx).padStart(6)+"     ends "+String(r.back.end).padStart(6)+
      " ("+String(r.back.over).padStart(5)+" over ground)"+(okB?"  ok ":" FAIL")+
      "     ends "+String(r.front.end).padStart(6)+" ("+String(r.front.over).padStart(5)+")"+
      (okF?"  ok":"  FAIL"));
  }
  const rampOK=out.ramp.end>out.deck-0.15;
  if(!rampOK)bad++;
  console.log("\n   THE RAMP, walked straight at the wall on its centreline:");
  console.log("     tops out at "+out.ramp.top+", ends at "+out.ramp.end+
    " standing at model ("+out.ramp.x+", "+out.ramp.z+")   deck is "+out.deck+
    (rampOK?"   ok":"   *** FAIL"));
  console.log("\n  "+(bad?bad+" check(s) wrong -> FAIL":"the ramp is the only way up, and it works -> PASS"));
  await b.close(); srv.close(); process.exit(bad?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
