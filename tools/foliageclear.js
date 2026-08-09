#!/usr/bin/env node
/* v131.30 — IS ANYTHING STILL GROWING WHERE IT SHOULD NOT BE?
   -----------------------------------------------------------
   node tools/foliageclear.js

   §8.7 asks for "zero props within 1.5 tiles of any building footprint or road", and names bazaar
   plazas and pond water specifically. "Zero" is a countable claim, so this counts rather than
   photographs — a render of one bazaar cannot tell you about the other two, the three ponds, or the
   fifty buildings a match puts down.

   Every instanced foliage layer registers itself in FOLIAGE_LAYERS, so this walks all of them,
   decomposes each instance matrix, skips the ones already collapsed to zero scale, and asks where
   the LIVE ones are standing. Four static zones, then the runtime one:

     PLAZA   the three bazaar decks (the v131.29 rebuild is 7.4 of deck on an 8.6 step)
     POND    the three ponds, at water radius + rim
     ROAD    the King's Road polyline
     THRONE  both Town Centre yards
     BUILDING  place real buildings of every type and count what is left inside their footprints,
               before and after makeBuilding runs — which is the only way to tell a working runtime
               clear from a world-gen radius that happens to cover the same ground.

   A zero-scale instance is how an InstancedMesh hides one piece without disturbing the rest, so
   "live" here means scale > 0.001 and not "exists".                                              */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_foliage");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8266);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:900,height:560}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8266/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    if(typeof FOLIAGE_LAYERS==="undefined")return {err:"FOLIAGE_LAYERS missing — patch not applied"};
    const m=new THREE.Matrix4();
    // every LIVE instance across every registered layer
    const live=()=>{
      const P=[];
      for(const L of FOLIAGE_LAYERS){
        for(let i=0;i<L.inst.count;i++){
          L.inst.getMatrixAt(i,m);
          const e=m.elements;
          const sx=Math.hypot(e[0],e[1],e[2]);           // the x basis length IS the x scale
          if(sx<0.001)continue;                          // already collapsed
          P.push([e[12],e[14]]);
        }
      }
      return P;
    };
    const L0=live();
    const inDisc=(P,cx,cz,r)=>{let n=0;const rr=r*r;
      for(const [x,z] of P){const dx=x-cx,dz=z-cz;if(dx*dx+dz*dz<rr)n++;}return n;};
    const zones={PLAZA:0,POND:0,ROAD:0,THRONE:0};
    for(const q of neutralMarkets)zones.PLAZA+=inDisc(L0,q.x,q.z,10.5);
    for(const p of PONDS)zones.POND+=inDisc(L0,p[0],p[1],p[2]+2.4);
    for(let i=0;i<=40;i++){const r=roadPoint(i/40);zones.ROAD+=inDisc(L0,r.x,r.z,9);}
    for(const t of TCPOS)zones.THRONE+=inDisc(L0,t[0],t[1],34);

    // ---- the runtime half: real buildings, on ground that HAS foliage on it ----
    // Picked by walking outward from the map centre until a spot is found that is legal to build on
    // and actually has greenery standing in it — a "no violations" result over bare lawn proves
    // nothing at all.
    const rows=[];
    for(const type of ["house","barracks","blacksmith","stable","tower"]){
      const def=BLD[type]; if(!def)continue;
      const rad=Math.max((typeof bSteer==="function")?bSteer(def):0,def.rBlock||def.r||0)
        *((typeof BSCALE!=="undefined"&&BSCALE[type])||1)+1.5;
      let site=null;
      for(let k=0;k<4000&&!site;k++){
        const a=k*2.399963, rr2=6+k*0.16;                // a phyllotaxis sweep: even, no clustering
        const x=Math.cos(a)*rr2, z=Math.sin(a)*rr2;
        if(Math.abs(x)>MAP.x-20||Math.abs(z)>MAP.z-20)continue;
        if(!foliageClear(x,z))continue;                  // somewhere world-gen did NOT already clear
        if(inDisc(live(),x,z,rad)>0)site=[x,z];
      }
      if(!site){rows.push({type,skip:"no vegetated legal site found"});continue;}
      const before=inDisc(live(),site[0],site[1],rad);
      const bl=makeBuilding(0,type,site[0],site[1],true,0);
      const after=inDisc(live(),site[0],site[1],rad);
      rows.push({type,r:+rad.toFixed(2),before,after,x:+site[0].toFixed(1),z:+site[1].toFixed(1)});
      if(bl){bl.alive=false;}
    }
    return {total:L0.length,layers:FOLIAGE_LAYERS.length,zones,rows};
  });

  if(out.err){console.log("!! "+out.err);await b.close();srv.close();process.exit(1);}
  console.log("\n  "+out.layers+" registered foliage layers, "+out.total+" live instances\n");
  console.log("  STATIC ZONES — live foliage standing inside ground that must be clear:");
  let bad=0;
  for(const k in out.zones){
    const v=out.zones[k];
    if(v)bad++;
    console.log("    "+k.padEnd(8)+String(v).padStart(6)+(v?"   *** FAIL":"   ok"));
  }
  console.log("\n  RUNTIME — a building placed on vegetated ground, before and after makeBuilding:");
  for(const r of out.rows){
    if(r.skip){console.log("    "+r.type.padEnd(12)+r.skip);continue;}
    const ok=r.after===0;
    if(!ok)bad++;
    console.log("    "+r.type.padEnd(12)+"at ("+String(r.x).padStart(7)+","+String(r.z).padStart(7)+
      ")  r "+String(r.r).padStart(5)+"   before "+String(r.before).padStart(4)+
      " -> after "+String(r.after).padStart(4)+(ok?"   ok":"   *** FAIL"));
  }
  console.log("\n  "+(bad?bad+" zone(s) still growing through -> FAIL":"nothing grows where it should not -> PASS"));

  for(const [nm,cam,look] of [
    ["bazaar",[10,4.5,32],[0,4.0,15]],
    ["pond",  [-105,14,104],[-105,0.5,82]]]){
    await page.evaluate(({cam,look})=>{
      for(const u of units)u.root.visible=false;
      camera.position.set(cam[0],terrainHeight(cam[0],cam[2])+cam[1],cam[2]);
      camera.lookAt(look[0],terrainHeight(look[0],look[2])+look[1],look[2]);
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true; scene.updateMatrixWorld(true);
      if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
    },{cam,look});
    await page.waitForTimeout(150);
    await page.screenshot({path:path.join(OUT,"foliage-"+nm+".png")});
  }
  console.log("  rendered to _foliage/\n");
  await b.close(); srv.close(); process.exit(bad?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
