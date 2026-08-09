#!/usr/bin/env node
/* v131.33 — ARE THERE HOLES IN THE BOTTOM OF A WALL RUN?
   ------------------------------------------------------
   node tools/wallbase.js

   John: "medieval walls still have gaps in the bottom."

   A wall is not built as a wall — it is built as a RUN of segments, chained at a spacing 06-input.js
   derives from the drawn length, and every previous look at wall geometry in this project has been
   at ONE segment. A gap between two of them is invisible to that, by construction: one segment is
   always continuous with itself.

   So this builds a real run through makeBuilding, at the game's own chain spacing, and then asks the
   only question that matters — walk along the wall and see if you can see through it:

     for each x along the run, fire a ray from OUTSIDE straight through at three heights and record
     whether it hits masonry. A gap at the base is a run of x where the low ray misses and the high
     one does not.

   Three heights, because "gaps in the bottom" is specifically about the band a body occupies:
     0.40  at grade, where a batter should be widest
     1.30  knee, the middle of a 2.6-tall body
     2.40  just under the segment box, where the batter hands over to the wall proper

   Every wall type at every age it builds, because the batter is only the Medieval form's and a fix
   there could easily leave the others.                                                            */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"_wallbase");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8281);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:1000,height:520}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8281/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof makeUnit==="function",null,{timeout:45000});
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll("body > *:not(canvas)"))el.style.display="none";
    try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const CASES=[["wood_wall",2],["wood_wall",5],["stone_wall",3],["fort_wall",4],["fort_wall",5]];
  const out=await page.evaluate((CASES)=>{
    const rows=[];
    const STEP=10.9;                       // 06-input.js chains segments at L/round(L/10.9)
    for(const [type,age] of CASES){
      if(!BLD[type])continue;
      for(const t of buildings.slice())t.alive=false;
      teamAge[0]=age;
      const Z=40, made=[];
      for(let i=-2;i<=2;i++){
        const bl=makeBuilding(0,type,i*STEP,Z,true,0);
        if(bl){bl.built=true;bl.alive=true;made.push(bl);}
      }
      if(!made.length){rows.push({type,age,err:"makeBuilding refused"});continue;}
      scene.updateMatrixWorld(true);
      const meshes=[];
      for(const bl of made)bl.body.traverse(o=>{if(o.isMesh&&o.geometry)meshes.push(o);});
      const _side=meshes.map(m=>m.material.side);
      meshes.forEach(m=>{m.material.side=THREE.DoubleSide;});
      const rc=new THREE.Raycaster(); rc.far=60;
      const gy=made[0].root.position.y;
      const res={};
      for(const hy of [0.40,1.30,2.40]){
        let n=0, miss=0, worst=0, run=0, at=null;
        // only sweep the INTERIOR of the run — the outermost half-segment at each end is a genuine
        // free end, not a joint, and scoring it would report the wall's own edge as a hole
        for(let x=-2*STEP+6.3;x<=2*STEP-6.3;x+=0.10){
          rc.set(new THREE.Vector3(x,gy+hy,Z+20),new THREE.Vector3(0,0,-1));
          const hit=rc.intersectObjects(meshes,false).length>0;
          n++;
          if(hit){ if(run>worst){worst=run;at=+(x-run*0.10).toFixed(1);} run=0; }
          else { miss++; run+=1; }
        }
        if(run>worst){worst=run;at="end";}
        res["y"+hy]={pct:+(100*miss/n).toFixed(1),widest:+(worst*0.10).toFixed(2),at};
      }
      meshes.forEach((m,i)=>{m.material.side=_side[i];});
      rows.push({type,age,res});
    }
    return rows;
  },CASES);

  console.log("\n  a run of 5 segments chained at 10.9, swept from outside at three body heights.");
  console.log("  \"see-through\" is the share of the run you can look straight through.\n");
  console.log("  type / age            y 0.40 grade        y 1.30 knee         y 2.40 shoulder");
  let bad=0;
  for(const r of out){
    if(r.err){console.log("   "+(r.type+" a"+r.age).padEnd(20)+r.err);continue;}
    const cell=k=>{const c=r.res[k];return (String(c.pct)+"%").padStart(6)+" (widest "+
      String(c.widest).padStart(5)+")";};
    const anyGap=Object.keys(r.res).some(k=>r.res[k].widest>0.4);
    if(anyGap)bad++;
    console.log("   "+(r.type+" a"+r.age).padEnd(20)+cell("y0.4")+"  "+cell("y1.3")+"  "+cell("y2.4")+
      (anyGap?"   *** FAIL":"   ok"));
  }
  console.log("\n  a \"widest\" over 0.40 is a hole a player can see daylight through at that height.");
  console.log("  "+(bad?bad+" wall form(s) with holes -> FAIL":"no wall form has a hole in it -> PASS"));

  await page.evaluate(()=>{
    for(const t of buildings.slice())t.alive=false;
    teamAge[0]=4;
    for(let i=-2;i<=2;i++){const bl=makeBuilding(0,"fort_wall",i*10.9,40,true,0); if(bl)bl.built=true;}
    for(const u of units)u.root.visible=false;
    camera.position.set(-2,terrainHeight(-2,62)+3.0,62);
    camera.lookAt(0,terrainHeight(0,40)+3.0,40);
    camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate=true; scene.updateMatrixWorld(true);
    if(typeof composer!=="undefined"&&composer)composer.render(); else renderer.render(scene,camera);
  });
  await page.waitForTimeout(150);
  await page.screenshot({path:path.join(OUT,"run-medieval.png")});
  console.log("  rendered to _wallbase/\n");
  await b.close(); srv.close(); process.exit(bad?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
