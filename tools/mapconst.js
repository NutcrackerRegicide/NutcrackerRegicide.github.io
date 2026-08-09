#!/usr/bin/env node
/* v132 STAGE 1 — DO THE DERIVED CONSTANTS STILL AGREE WITH THEIR SOURCES?
   ----------------------------------------------------------------------
   node tools/mapconst.js

   The map rework (claude/REGICIDE-MAP-REWORK.md) changes MAP.x, MAP.z, the road spine, the bazaar
   sites and the camp sites. The resize itself is arithmetic. What bites is that several places
   hard-code values DERIVED from those and do not know they are derived — and every one of them has
   already caused a shipped defect:

     · 01-engine.js flattens the terrain at (-77, 17.46), (77, 17.46) and (0, 15.2). Those are the
       current bazaar positions, TYPED BY HAND. Move the road and every plaza sits on a slope.
     · groundY() carries the ground plane's four numbers with a comment saying they must match
       buildTerrain's PlaneGeometry. When they did not, aprons and paths clipped into the ground —
       that was v131.33.
     · the pond flats are a second copy of the pond table.
     · the bay flat is a third copy of the boss camp's position.

   THIS GATE SHIPS BEFORE THE RESIZE, ON PURPOSE. Run it on the current build and it must PASS —
   that is what proves the gate can tell agreement from disagreement. Then it is what proves the
   resize, instead of my carefulness being what proves it.

   It does NOT compare source text. It measures the CONSEQUENCE, which is the only thing that
   matters and the only thing that cannot be fooled by a careful edit that misses a caller:

     GROUNDY   raycast down onto the real terrain mesh at 600 scattered points and compare with
               groundY(x,z). They are supposed to be the same surface. Any drift in the lattice
               constants shows up here as a height difference, in world units.
     LEVEL     every site that must stand on flat ground — both Town Centres, every bazaar, every
               pond — sampled over its OWN footprint radius. A flat that has drifted off its object
               shows up as height spread across the object.
     COVER     …and the flat has to be BIGGER than the thing standing on it. A plaza centred right
               with too small a radius is a slope at the rim, which reads as the building sinking
               into a hill on one side.                                                            */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8291);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8291/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof roadPoint==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    scene.updateMatrixWorld(true);
    // ---- 1. GROUNDY vs THE DRAWN MESH ----------------------------------------------------------
    // The terrain is the one big PlaneGeometry laid flat; find it by shape rather than by a global,
    // because it is function-local to buildTerrain.
    let terr=null, best=0;
    scene.traverse(o=>{
      if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.position)return;
      if(Math.abs(o.rotation.x+Math.PI/2)>0.01)return;
      const n=o.geometry.attributes.position.count;
      if(n>best){best=n;terr=o;}
    });
    if(!terr)return {err:"could not find the terrain mesh"};
    if(typeof groundY!=="function")return {err:"groundY is not file-scope — v131.33 not applied"};
    const rc=new THREE.Raycaster(); rc.far=900;
    const down=new THREE.Vector3(0,-1,0);
    let gWorst=0, gAt=null, gN=0, gMiss=0;
    for(let i=0;i<600;i++){
      // a phyllotaxis spiral over the walkable rect: even coverage, no lattice alignment, which
      // matters because sampling exactly ON the lattice would hide interpolation error entirely
      const a=i*2.399963, rr=Math.sqrt(i/600);
      const x=Math.cos(a)*rr*(MAP.x-4), z=Math.sin(a)*rr*(MAP.z-4);
      rc.set(new THREE.Vector3(x,400,z),down);
      const h=rc.intersectObject(terr,false)[0];
      if(!h){gMiss++;continue;}
      gN++;
      const d=Math.abs(h.point.y-groundY(x,z));
      if(d>gWorst){gWorst=d;gAt=[+x.toFixed(1),+z.toFixed(1)];}
    }

    // ---- 2 & 3. LEVEL + COVER ------------------------------------------------------------------
    // Everything that must stand on flat ground, with the radius it actually occupies.
    const sites=[];
    for(let i=0;i<TCPOS.length;i++)sites.push({what:"town centre "+i,x:TCPOS[i][0],z:TCPOS[i][1],r:14});
    // v132.1 the sites carry their own plaza radius now — the Grand Bazaar's plinth is 1.32x the
    // team bazaars' — so the gate asks each one for the ground IT needs rather than assuming one
    // number covers all three. That assumption is what this gate exists to stop.
    for(const B of BAZAAR_SITES){const p=B.p();
      sites.push({what:"bazaar "+B.what,x:p.x,z:p.z,r:B.plaza});}
    if(typeof PONDS!=="undefined")for(const p of PONDS)
      sites.push({what:"pond",x:p[0],z:p[1],r:p[2]+1.3});         // water + sandy rim
    for(const s of sites){
      let lo=Infinity, hi=-Infinity;
      for(let ri=0;ri<=8;ri++)for(let si=0;si<24;si++){
        const a=si*Math.PI/12, rad=s.r*ri/8;
        const h=terrainHeight(s.x+Math.cos(a)*rad,s.z+Math.sin(a)*rad);
        if(h<lo)lo=h; if(h>hi)hi=h;
      }
      s.spread=+(hi-lo).toFixed(3);
      // and how far the level ground actually reaches, walking outward until it tilts
      let reach=0;
      const h0=terrainHeight(s.x,s.z);
      for(let rad=0.5;rad<=40;rad+=0.5){
        let flat=true;
        for(let si=0;si<16;si++){const a=si*Math.PI/8;
          if(Math.abs(terrainHeight(s.x+Math.cos(a)*rad,s.z+Math.sin(a)*rad)-h0)>0.05){flat=false;break;}}
        if(!flat)break; reach=rad;
      }
      s.reach=+reach.toFixed(1);
    }
    return {gWorst:+gWorst.toFixed(4),gAt,gN,gMiss,sites,
            plane:[MAP.x*2+110,MAP.z*2+200],map:[MAP.x,MAP.z]};
  });

  if(out.err){console.log("!! "+out.err);await b.close();srv.close();process.exit(1);}
  let bad=0;
  console.log("\n  MAP "+out.map[0]+" x "+out.map[1]+"   ground plane "+out.plane[0]+" x "+out.plane[1]+"\n");

  console.log("  GROUNDY — groundY(x,z) against a raycast onto the drawn terrain, "+out.gN+" points");
  const gOK=out.gWorst<0.01;
  if(!gOK)bad++;
  console.log("    worst disagreement "+out.gWorst+(out.gAt?"  at ("+out.gAt[0]+", "+out.gAt[1]+")":"")+
    (gOK?"   ok — same surface":"   *** FAIL: the lattice constants have drifted from buildTerrain"));
  if(out.gMiss)console.log("    ("+out.gMiss+" rays missed the mesh — the plane does not cover the walkable rect)");

  console.log("\n  LEVEL / COVER — every site that must stand on flat ground");
  console.log("    site                    needs   spread   level ground reaches");
  for(const s of out.sites){
    const okS=s.spread<=0.05, okC=s.reach>=s.r;
    if(!okS||!okC)bad++;
    console.log("    "+s.what.padEnd(22)+String(s.r).padStart(6)+"  "+String(s.spread).padStart(7)+
      "   "+String(s.reach).padStart(6)+
      (okS?"":"   *** NOT LEVEL")+(okC?"":"   *** FLAT TOO SMALL"));
  }
  console.log("\n  "+(bad?bad+" check(s) failed -> FAIL":"every derived constant agrees with its source -> PASS"));
  await b.close(); srv.close(); process.exit(bad?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
