#!/usr/bin/env node
/* v131.32 — HOW MUCH OF EACH CAMP HAS THE MOUNTAIN EATEN?
   -------------------------------------------------------
   node tools/campridge.js

   John, on a corner camp: "corner camps have been overtaken by mountains, wolves are clipping
   through mountains."

   Both halves of that are one fact. v131.28 closed "mountains never collide" as not-a-bug, and the
   evidence was sound for the FIELD — the map clamp is the mountain collider, its own comment says
   so, the smoketest asserts it, and no ridge geometry exists more than 40 units inside the walkable
   boundary. But the camps are the stated exception and I did not act on it: camp pockets are
   walkable by inCampGround(), they are OUTSIDE the border clamp, and they sit in the ring's own
   footprint. Inside a camp there is nothing between a wolf and a mountain at all.

   So this measures the thing itself rather than the generator. Sample a polar grid over each camp
   pocket's floor, raycast DOWN from above onto the real merged ridge meshes, and count the points
   where rock stands over a wolf's head:

     ROCK@KNEE   a ridge surface higher than 1.3 above the camp floor — a wolf standing there is
                 inside the mountain, which is the clipping
     ROCK@ANY    any ridge surface at all, however shallow — the skirt, i.e. how much of the pocket
                 has been eaten even where it is still walkable

   Per camp, so the corner camps John is looking at can be told apart from the boss bay, and by
   radius band, so "the rim is furred" reads differently from "the middle is buried".              */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_campridge");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8276);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:900,height:560}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8276/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    scene.updateMatrixWorld(true);
    // the ridge is three merged meshes sharing RIDGE_MAT; two of them are function-local and are
    // only reachable through the scene graph, so find them by material rather than by name
    const ridge=[];
    scene.traverse(o=>{if(o.isMesh&&o.material===RIDGE_MAT)ridge.push(o);});
    if(!ridge.length)return {err:"no meshes on RIDGE_MAT — the ring did not build"};
    const rc=new THREE.Raycaster(); rc.far=800;
    const down=new THREE.Vector3(0,-1,0);
    const rows=[];
    for(let ci=0;ci<CAMPS.length;ci++){
      const C=CAMPS[ci];
      let n=0, knee=0, any=0;
      const bands=[[0,0.5,0,0],[0.5,0.8,0,0],[0.8,1.0,0,0]];   // lo, hi, n, knee
      for(let ri=1;ri<=26;ri++){
        const fr=ri/26, rad=C.r*fr;
        const steps=Math.max(8,Math.round(2*Math.PI*rad/3.0));
        for(let si=0;si<steps;si++){
          const a=si*2*Math.PI/steps;
          const x=C.x+Math.cos(a)*rad, z=C.z+Math.sin(a)*rad;
          const floor=terrainHeight(x,z);
          rc.set(new THREE.Vector3(x,floor+300,z),down);
          const h=rc.intersectObjects(ridge,false)[0];
          n++;
          const B=bands.find(bb=>fr>bb[0]&&fr<=bb[1]); if(B)B[2]++;
          if(!h)continue;
          any++;
          if(h.point.y-floor>1.3){ knee++; if(B)B[3]++; }
        }
      }
      rows.push({i:ci,boss:!!C.boss,x:C.x,z:C.z,r:C.r,n,
        knee:+(100*knee/n).toFixed(1), any:+(100*any/n).toFixed(1),
        bands:bands.map(bb=>bb[2]?+(100*bb[3]/bb[2]).toFixed(1):0)});
    }
    return {rows,meshes:ridge.length};
  });

  if(out.err){console.log("!! "+out.err);await b.close();srv.close();process.exit(1);}
  console.log("\n  "+out.meshes+" merged ridge meshes on RIDGE_MAT\n");
  console.log("  camp                      ROCK@KNEE   ROCK@ANY      by radius band (inner/mid/rim)");
  let worst=0;
  for(const r of out.rows){
    worst=Math.max(worst,r.knee);
    console.log("   "+(r.boss?"BOSS bay":"corner  ").padEnd(9)+
      ("("+r.x+","+r.z+") r"+r.r).padEnd(17)+
      String(r.knee).padStart(6)+"%    "+String(r.any).padStart(6)+"%       "+
      r.bands.map(v=>String(v).padStart(5)+"%").join(" "));
  }
  console.log("\n  ROCK@KNEE is the clipping: a wolf standing there is inside the mountain.");
  console.log("  worst pocket: "+worst.toFixed(1)+"%   -> "+(worst<=1.0?"PASS":"FAIL (target: under 1%)"));

  for(let ci=0;ci<out.rows.length;ci++){
    const r=out.rows[ci]; if(r.boss)continue;
    await page.evaluate(({x,z,rr})=>{
      for(const u of units)u.root.visible=false;
      camera.position.set(x*0.72,terrainHeight(x,z)+58,z*0.72);
      camera.lookAt(x,terrainHeight(x,z),z);
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true; scene.updateMatrixWorld(true);
      if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
    },{x:r.x,z:r.z,rr:r.r});
    await page.waitForTimeout(150);
    await page.screenshot({path:path.join(OUT,"camp"+ci+".png")});
    if(ci>=1)break;                                  // two corners is enough to look at
  }
  console.log("  rendered to _campridge/\n");
  await b.close(); srv.close(); process.exit(worst>1.0?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
