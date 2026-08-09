#!/usr/bin/env node
/* v132.2 RECONNAISSANCE — WHAT GROUND DOES THE VIKING ROAD ACTUALLY HAVE TO CROSS?
   --------------------------------------------------------------------------------
   node tools/vikingsurvey.js

   This runs BEFORE the ribbon exists. It is not a gate and it does not pass or fail; it is the
   survey you send out before you build the road, and it exists because every previous "it will
   probably be fine" in this project has been wrong when measured:

     · the mountain ring ate the corner camps (v131.32) — nobody checked what the ring overlapped
     · the bay flat drifted 10 units off the bay (v132.0) — nobody checked the derived constant
     · the batter left 22–34% see-through holes (v131.28) — nobody put a ray through it

   Five questions, all of which change the geometry if the answer is bad:

     WALKABLE   every metre of both branches has to be inside walkable(), or the road draws across
                ground units are clamped out of and the path leads nowhere.
     GRADE      a swept ribbon draped to groundY looks stretched and reads as a smear wherever the
                ground climbs faster than about 25%. Worst grade and where.
     JUNCTION   the two roads leave the SAME throne, so near the base they must overlap. How much,
                and over what length, decides whether polygonOffset is enough or the spine needs
                moving.
     MOUNTAIN   the ring is drawn per-instance with a camp-pocket rejection. Any peak sitting on
                the route is a road that runs into a cliff.
     CAMPS      the route's far end is supposed to stop at the MOUTH of the boss bay, not inside
                the boss's own ground. Measure the distance to every camp centre.                  */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8293);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8293/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof vikingPoint==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    scene.updateMatrixWorld(true);
    const HW=2.6;                 // the half-width the ribbon is being designed at
    const res=[];
    for(const team of [0,1]){
      const P=[]; const N=400;
      for(let i=0;i<=N;i++)P.push(vikingPoint(team,i/N));
      // ---- length, walkability, grade -------------------------------------------------------
      let len=0, offMap=0, firstOff=null, worstGrade=0, gradeAt=null;
      for(let i=0;i<=N;i++){
        const p=P[i];
        if(typeof walkable==="function"&&!walkable(p.x,p.z)){offMap++;if(!firstOff)firstOff=[+p.x.toFixed(1),+p.z.toFixed(1),+(i/N).toFixed(3)];}
        if(i){const d=Math.hypot(p.x-P[i-1].x,p.z-P[i-1].z); len+=d;
          const dh=Math.abs(terrainHeight(p.x,p.z)-terrainHeight(P[i-1].x,P[i-1].z));
          const g=d>0.001?dh/d:0;
          if(g>worstGrade){worstGrade=g;gradeAt=[+p.x.toFixed(1),+p.z.toFixed(1)];}}
      }
      // ---- the junction: how close does this branch run to the King's Road ribbon? ------------
      // measured as centre-to-centre distance against the King's Road's own half-width (~4.8) plus
      // this ribbon's, so "overlap" means the two painted surfaces actually share ground.
      let overlapLen=0, worstOverlap=0, sepAt=null, sep=1e9;
      for(let i=0;i<=N;i++){
        const p=P[i]; let d=1e9;
        for(let k=0;k<=600;k++){const q=roadPoint(k/600); const dd=Math.hypot(p.x-q.x,p.z-q.z); if(dd<d)d=dd;}
        const ov=(4.85+HW)-d;
        if(ov>0){ overlapLen+=len/N; if(ov>worstOverlap)worstOverlap=ov; }
        else if(d<sep){sep=d;sepAt=+(i/N).toFixed(3);}
      }
      // ---- mountains sitting on the route -----------------------------------------------------
      // the ring is instanced cones; find every mesh whose world position is within the corridor
      // and stands proud of the local ground.
      const hits=[];
      scene.traverse(o=>{
        if(!o.isMesh||!o.geometry||!o.geometry.boundingSphere&&!o.geometry.computeBoundingSphere)return;
        if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
        const c=o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        const rad=o.geometry.boundingSphere.radius*Math.max(o.scale.x,o.scale.z);
        if(rad<8)return;                                     // peaks only, not props
        if(c.y-terrainHeight(c.x,c.z)<6)return;              // and it must stand proud
        let d=1e9,at=0;
        for(let i=0;i<=N;i++){const dd=Math.hypot(c.x-P[i].x,c.z-P[i].z); if(dd<d){d=dd;at=i/N;}}
        if(d<rad+HW)hits.push({d:+d.toFixed(1),r:+rad.toFixed(1),t:+at.toFixed(2),
                               at:[+c.x.toFixed(0),+c.z.toFixed(0)]});
      });
      // ---- where the far end lands relative to every camp --------------------------------------
      const endp=P[N], camps=CAMPS.map(c=>({r:c.r,boss:!!c.boss,
        d:+Math.hypot(endp.x-c.x,endp.z-c.z).toFixed(1)})).sort((a,b)=>a.d-b.d).slice(0,3);
      res.push({team,len:+len.toFixed(1),offMap,firstOff,
        worstGrade:+worstGrade.toFixed(3),gradeAt,
        overlapLen:+overlapLen.toFixed(1),worstOverlap:+worstOverlap.toFixed(2),
        sep:+sep.toFixed(1),sepAt,hits:hits.slice(0,6),
        lo:+Math.min(...P.map(p=>terrainHeight(p.x,p.z))).toFixed(2),
        hi:+Math.max(...P.map(p=>terrainHeight(p.x,p.z))).toFixed(2),camps});
    }
    // the King's Road's own numbers, for scale
    let klen=0; let kp=roadPoint(0);
    for(let i=1;i<=400;i++){const q=roadPoint(i/400);klen+=Math.hypot(q.x-kp.x,q.z-kp.z);kp=q;}
    return {res,klen:+klen.toFixed(1),
      bz:BAZAAR_SITES.filter(b=>b.team!==undefined).map(b=>{const p=b.p();
        return {what:b.what,at:[+p.x.toFixed(1),+p.z.toFixed(1)],plaza:b.plaza};})};
  });

  console.log("\n  the King's Road is "+out.klen+" units of arc, half-width 4.55-5.10.\n");
  for(const r of out.res){
    console.log("  BRANCH "+(r.team?"RED   (+x)":"BLUE  (-x)"));
    console.log("    arc length            "+r.len+"   ("+Math.round(r.len/out.klen*100)+"% of the King's Road)");
    console.log("    ground                "+r.lo+" .. "+r.hi+"   (rise "+(r.hi-r.lo).toFixed(2)+")");
    console.log("    WALKABLE              "+(r.offMap?r.offMap+" of 401 samples OUTSIDE walkable()  <<< "+
        (r.firstOff?"first at ("+r.firstOff[0]+", "+r.firstOff[1]+") t="+r.firstOff[2]:"")
      :"all 401 samples inside"));
    console.log("    GRADE worst           "+(r.worstGrade*100).toFixed(1)+"%"+
        (r.gradeAt?"  at ("+r.gradeAt[0]+", "+r.gradeAt[1]+")":"")+
        (r.worstGrade>0.25?"   <<< steep: the ribbon will smear here":"   ok for a draped ribbon"));
    console.log("    JUNCTION with the King's Road");
    console.log("      surfaces share ground for "+r.overlapLen+" units of the branch"+
      (r.overlapLen>0?", overlapping by up to "+r.worstOverlap+"":""));
    console.log("      once clear, the closest the two ever come again is "+r.sep+" (at t="+r.sepAt+")");
    console.log("    MOUNTAINS on the route  "+(r.hits.length?r.hits.length+" !!":"none"));
    for(const h of r.hits)console.log("      peak r"+h.r+" at ("+h.at[0]+", "+h.at[1]+"), "+h.d+" from the spine at t="+h.t);
    console.log("    far end, nearest camps  "+r.camps.map(c=>(c.boss?"BOSS":"camp")+" r"+c.r+" at "+c.d).join(" | "));
    console.log("");
  }
  console.log("  the two team bazaars sit at:");
  for(const b of out.bz)console.log("    "+b.what.padEnd(6)+"("+b.at[0]+", "+b.at[1]+")  plaza r"+b.plaza);
  console.log("");
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
