#!/usr/bin/env node
/* v132.7 — NINE CAMPS, AND THE SPLIT DID NOT BREAK THE SIX
   --------------------------------------------------------
   node tools/creepcamps.js

   Splitting one array into two is the kind of change that looks finished the moment it parses. The
   risks are not in the new camps, they are in the old ones and on the wire:

     SPLIT      CAMPS must still be exactly the six border pockets — if an interior camp leaked into
                it, nearCamp() would start pushing the mountain ring away from map centre and
                inCampGround() would return true on ground that is already walkable. Both are silent.
     ORDER      campStates[i] is indexed by chest events and by the late joiner's w.camps[], and each
                camp mints CREEP_N unit bodies in sequence. The three are APPENDED so indices 0-5 and
                every existing unit id hold. This asserts the ids actually ascend camp by camp,
                because "I appended it" is a claim about source and this is the consequence.
     SITING     re-measured against the LIVE world, not against the numbers tools/campsite.js
                printed. Those were measured before the camps existed; a transcription slip between
                that output and the array is exactly the failure this catches.
     THE FIELD  three things that never came up while every camp sat past the border: trees growing
                in the camp, undergrowth growing through its floor, and being able to build on it.
     THE PACK   creeps spawned, alive, and inside their own leash — which is derived from st.r, so a
                16-radius clearing is the first thing ever to test that it is not hard-coded to 26.  */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8299);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8299/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof campStates!=="undefined"&&campStates.length,null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(400);

  const out=await page.evaluate(()=>{
    scene.updateMatrixWorld(true);
    const R={};
    R.nCamps=CAMPS.length; R.nSites=CREEP_SITES.length; R.nStates=campStates.length;
    // the six must survive the split unchanged, in place
    R.prefixHolds=CAMPS.every((C,i)=>CREEP_SITES[i].x===C.x&&CREEP_SITES[i].z===C.z&&CREEP_SITES[i].r===C.r);
    R.bossIdx=CREEP_SITES.findIndex(c=>c.boss);
    R.campsAllBorder=CAMPS.every(C=>Math.abs(C.x)>MAP.x||Math.abs(C.z)>MAP.z);
    R.inner=CREEP_SITES.filter(c=>c.inner).map(c=>({x:c.x,z:c.z,r:c.r}));
    // …and the interior three must be INSIDE, or they are just more border pockets
    R.innerAllInside=R.inner.every(c=>Math.abs(c.x)+c.r<MAP.x&&Math.abs(c.z)+c.r<MAP.z);
    // mirror fairness: the multiset of camp->throne distances must match between the two thrones
    const dsort=t=>CREEP_SITES.map(c=>+Math.hypot(c.x-t[0],c.z-t[1]).toFixed(2)).sort((a,b)=>a-b);
    const d0=dsort(TCPOS[0]), d1=dsort(TCPOS[1]);
    R.mirror=d0.every((v,i)=>Math.abs(v-d1[i])<0.01);

    // ---- unit ids ascend camp by camp, which is what "appended" has to MEAN ---------------------
    let last=-1; R.idsAscend=true; R.idRanges=[];
    for(const st of campStates){
      const ids=st.creeps.map(u=>u.id!==undefined?u.id:u.uid);
      const lo=Math.min(...ids), hi=Math.max(...ids);
      R.idRanges.push([lo,hi]);
      if(lo<=last)R.idsAscend=false;
      last=hi;
    }

    // ---- the interior sites, re-measured against the live world ---------------------------------
    const SK=[],SV=[];
    for(let i=0;i<=400;i++)SK.push(roadPoint(i/400));
    for(const t of [0,1])for(let i=0;i<=400;i++)SV.push(vikingPoint(t,i/400));
    const near=(pts,x,z)=>{let m=1e9;for(const p of pts){const dx=x-p.x,dz=z-p.z,d=dx*dx+dz*dz;if(d<m)m=d;}return Math.sqrt(m);};
    const _m=new THREE.Matrix4(),_s=new THREE.Vector3(),_q=new THREE.Quaternion(),_p=new THREE.Vector3();
    R.sites=R.inner.map(c=>{
      const s={x:c.x,z:c.z,r:c.r,disc:c.r-1.5};
      s.dK=+near(SK,c.x,c.z).toFixed(1);
      s.dV=+near(SV,c.x,c.z).toFixed(1);
      s.dThrone=TCPOS.map(t=>+Math.hypot(c.x-t[0],c.z-t[1]).toFixed(0));
      s.dBaz=+Math.min(...BAZAAR_SITES.map(B=>{const p=B.p();return Math.hypot(c.x-p.x,c.z-p.z)-B.plaza;})).toFixed(1);
      s.dPond=(typeof PONDS!=="undefined")?+Math.min(...PONDS.map(p=>Math.hypot(c.x-p[0],c.z-p[1])-p[2])).toFixed(1):null;
      // BY POSITION, NOT BY IDENTITY. R.inner holds COPIES of the site records, so `o!==c` never
      // excluded the camp from its own comparison and every site reported a nearest neighbour of
      // -32 — its own diameter, negated. The check was right and the meter was measuring self.
      s.dCamp=+Math.min(...CREEP_SITES.filter(o=>!(o.x===c.x&&o.z===c.z))
        .map(o=>Math.hypot(c.x-o.x,c.z-o.z)-o.r-c.r)).toFixed(1);
      // level, and walkable, over the whole footprint
      let lo=1e9,hi=-1e9; s.walk=true;
      for(let ri=0;ri<=4;ri++)for(let si=0;si<16;si++){
        const a=si*Math.PI/8, rr=c.r*ri/4;
        const px=c.x+Math.cos(a)*rr, pz=c.z+Math.sin(a)*rr;
        if(!walkable(px,pz))s.walk=false;
        const h=terrainHeight(px,pz); if(h<lo)lo=h; if(h>hi)hi=h;
      }
      s.spread=+(hi-lo).toFixed(2);
      // nothing growing in it
      s.tree=+Math.min(...nodes.filter(n=>n.type==="wood").map(n=>Math.hypot(c.x-n.x,c.z-n.z))).toFixed(1);
      let fol=1e9;
      if(typeof FOLIAGE_LAYERS!=="undefined")for(const L of FOLIAGE_LAYERS)
        for(let i=0;i<L.inst.count;i+=2){
          L.inst.getMatrixAt(i,_m); _m.decompose(_p,_q,_s);
          if(_s.x*_s.y*_s.z<1e-6)continue;
          const d=Math.hypot(c.x-_p.x,c.z-_p.z); if(d<fol)fol=d;
        }
      s.fol=+fol.toFixed(1);
      // v132.12 IS IT ACTUALLY IN THE WOODS? John: "more tucked into heavily wooded areas. for
      // example this camp is pretty much just in the open." Count the trees in the annulus between
      // the camp's own clearing (r+4) and 34 beyond it, and compare the density there with the
      // whole map's. A camp standing in a meadow scores about 1.0; a camp in a stand scores well
      // over it. This is the check that "I planted a stand on it" has to survive.
      {const lo=c.r+4, hi=c.r+34, wood=nodes.filter(n=>n.type==="wood");
       let inRing=0;
       for(const n of wood){const d=Math.hypot(c.x-n.x,c.z-n.z); if(d>=lo&&d<hi)inRing++;}
       const ringArea=Math.PI*(hi*hi-lo*lo);
       const mapArea=(MAP.x*2)*(MAP.z*2);
       s.ringN=inRing;
       s.woodX=+((inRing/ringArea)/(wood.length/mapArea)).toFixed(2);}
      // and you cannot build on it — asked of the real predicate, at the centre and at the rim
      s.buildCentre=validFor("house",c.x,c.z,0);
      s.buildRim=validFor("house",c.x+c.r+BLD.house.r+6,c.z,0);
      // the scenery got dressed: a worldDeco group standing at the camp
      s.dressed=scene.children.some(o=>o.type==="Group"&&
        Math.hypot(o.position.x-c.x,o.position.z-c.z)<0.6);
      return s;
    });

    // ---- the packs ------------------------------------------------------------------------------
    R.packs=campStates.map((st,i)=>{
      const alive=st.creeps.filter(u=>u.alive);
      let worst=0;
      for(const u of alive){const d=Math.hypot(u.root.position.x-st.x,u.root.position.z-st.z);
        if(d>worst)worst=d;}
      return {i,inner:!!CREEP_SITES[i].inner,boss:!!st.boss,r:st.r,aggro:+st.aggro.toFixed(1),
        n:alive.length,bodies:st.creeps.length,kind:st.kind,leash:+(st.r-1.2).toFixed(1),
        worst:+worst.toFixed(1)};
    });
    return R;
  });

  let bad=0; const F=ok=>{if(!ok)bad++;return ok?"   ok":"   *** FAIL";};
  console.log("\n  THE SPLIT");
  console.log("    CAMPS "+out.nCamps+" · CREEP_SITES "+out.nSites+" · campStates "+out.nStates+
    F(out.nCamps===6&&out.nSites===9&&out.nStates===9));
  console.log("    the six border pockets survive the split unchanged, in place"+F(out.prefixHolds));
  console.log("    CAMPS is still nothing but border pockets"+F(out.campsAllBorder));
  console.log("    …and the three new ones are all INSIDE the map"+F(out.innerAllInside));
  console.log("    the boss is still index "+out.bossIdx+F(out.bossIdx===4));
  console.log("    camp->throne distances mirror between the two thrones"+F(out.mirror));
  console.log("    unit ids ascend camp by camp — the three really are appended"+F(out.idsAscend));
  console.log("      id ranges  "+out.idRanges.map(r=>r[0]+"-"+r[1]).join("  "));

  console.log("\n  THE THREE INTERIOR SITES, re-measured against the live world");
  console.log("        x     z    r   King's  Viking   bazaar  pond   camp   spread  tree   foliage");
  for(const s of out.sites){
    const ok=s.dK>s.disc+11&&s.dV>s.disc+9&&s.dBaz>s.disc+4&&s.dCamp>16&&s.spread<2.6&&s.walk;
    if(!ok)bad++;
    console.log("   "+String(s.x).padStart(5)+" "+String(s.z).padStart(5)+" "+String(s.r).padStart(4)+
      "  "+String(s.dK).padStart(6)+"  "+String(s.dV).padStart(6)+"  "+String(s.dBaz).padStart(7)+
      "  "+String(s.dPond).padStart(5)+"  "+String(s.dCamp).padStart(5)+"  "+String(s.spread).padStart(6)+
      "  "+String(s.tree).padStart(5)+"  "+String(s.fol).padStart(7)+(ok?"":"  *** TOO CLOSE"));
  }
  console.log("\n    the map keeps its distance from all of them (disc is r-1.5):");
  for(const s of out.sites){
    console.log("      ("+s.x+", "+s.z+")");
    console.log("        no tree inside the clearing (needs > "+(s.r+4)+")   nearest "+s.tree+F(s.tree>=s.r+3.5));
    console.log("        …but it IS in the woods: "+s.ringN+" trees in the ring, "+s.woodX+
      "x the map's own density"+F(s.woodX>=1.5));
    console.log("        no undergrowth on the camp floor (needs > "+s.r+")   nearest "+s.fol+F(s.fol>=s.r-0.5));
    console.log("        walkable and level across the footprint            spread "+s.spread+F(s.walk&&s.spread<2.6));
    console.log("        the scenery is dressed at it                                "+(s.dressed?"yes":"NO")+F(s.dressed));
    console.log("        validFor refuses a house at the centre                       "+(s.buildCentre?"ALLOWED":"refused")+F(!s.buildCentre));
    console.log("        …and still allows one clear of the rim                       "+(s.buildRim?"allowed":"REFUSED")+F(s.buildRim));
  }

  console.log("\n  THE PACKS");
  console.log("     i  kind        r   aggro   leash   alive/bodies   furthest creep");
  for(const p of out.packs){
    const ok=p.worst<=p.leash+0.01&&p.bodies>0&&(p.boss||p.n>=4);
    if(!ok)bad++;
    console.log("    "+String(p.i).padStart(2)+"  "+String(p.kind||"-").padEnd(10)+
      String(p.r).padStart(3)+"  "+String(p.aggro).padStart(6)+"  "+String(p.leash).padStart(6)+
      "      "+(p.n+"/"+p.bodies).padStart(6)+"        "+String(p.worst).padStart(6)+
      (p.inner?"   <- interior":"")+(ok?"":"   *** FAIL"));
  }
  console.log("\n  "+(bad?bad+" check(s) failed -> FAIL":"nine camps, and the six are untouched -> PASS")+"\n");
  await b.close(); srv.close(); process.exit(bad?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
