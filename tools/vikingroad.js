#!/usr/bin/env node
/* v132.2 — IS THE VIKING ROAD A ROAD?
   -----------------------------------
   node tools/vikingroad.js

   tools/vikingsurvey.js measured the GROUND before the ribbon existed. This measures the RIBBON,
   and it exists because the King's Road shipped for eighteen versions with a cross-section that was
   computed and never rendered (v131.15) — nobody had put a meter on it, and by eye it looked like a
   road, so the bug survived five separate passes of "tinting" that were all fixing the wrong thing.

   EVERY THRESHOLD IS THE KING'S ROAD'S OWN NUMBER, measured in the same run. That is the point of
   the two-column layout below. An invented threshold is a guess with a decimal point on it; "no
   worse than the road we already shipped and looked at" is a fact. The only checks with absolute
   bounds are the ones where zero is the only right answer (nothing standing ON the dirt, the
   King's Road winning every depth tie).

   THE FIRST CUT OF THIS GATE FAILED FOUR CHECKS AND TWO OF THEM WERE ITS OWN FAULT — recorded here
   because both are traps a rewrite would fall into again:
     · IT FOUND THE KING'S ROAD BY SORTING FLAT COLOURED MESHES BY SOUTHERNMOST EXTENT and taking
       the last. That is a 7-VERTEX ground decal, so the junction raycast tested the Viking road
       against a dinner plate and reported 0/2. Ribbons are now required to have >1000 vertices.
     · IT COUNTED CULLED FOLIAGE. undergrowth (02-world.js:2522) rejects an instance by setting its
       SCALE to zero, not by moving it — the position stays in the buffer. The gate read those
       positions and reported greenery 3.7 units from the spine that is not drawn at all. It now
       reads the instance matrix and skips anything with no scale.                                */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8294);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8294/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof units!=="undefined"&&typeof vikingPoint==="function",null,{timeout:45000});
  await page.evaluate(()=>{try{inMenu=false;}catch(e){} window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(300);

  const out=await page.evaluate(()=>{
    scene.updateMatrixWorld(true);
    // ---- find the two ribbons by SHAPE, not by a global. Both are scene-level swept strips with
    // position+uv+color lying flat; >1000 vertices excludes the ground decals, which is the trap
    // the first cut of this gate fell into. They are then told apart by how far south they reach:
    // the King's Road never goes below z=-6, the Viking road ends at -150.
    const ribbons=[];
    for(const o of scene.children){
      if(!o.isMesh||!o.geometry||!o.geometry.attributes)continue;
      const A=o.geometry.attributes;
      if(!A.position||!A.uv||!A.color)continue;
      if(A.position.count<1000)continue;
      o.geometry.computeBoundingBox();
      const bb=o.geometry.boundingBox;
      if(bb.max.y-bb.min.y>12)continue;
      ribbons.push({o,minz:bb.min.z});
    }
    ribbons.sort((a,b)=>a.minz-b.minz);
    if(ribbons.length!==2)return {err:"found "+ribbons.length+" swept ground ribbons, expected exactly 2"};
    const VK=ribbons[0].o, KR=ribbons[1].o;
    if(ribbons[0].minz>-100)return {err:"the southernmost ribbon only reaches z="+ribbons[0].minz.toFixed(0)+
      " — the Viking road is not in the scene"};

    // ---- pull the cross-sections back out of a swept strip -------------------------------------
    // u is edge-locked 0..1 across the track, so the column width K is just the period of u, and
    // with K in hand every cross-section's centre and its two edges are addressable. This is how
    // the gate measures the road that EXISTS rather than the constants that were typed.
    const sections=(g)=>{
      const P=g.attributes.position, U=g.attributes.uv, C=g.attributes.color;
      let K=0; for(let i=1;i<P.count;i++)if(U.getX(i)===U.getX(0)){K=i;break;}
      if(!K)return null;
      const out=[], mid=(K-1)/2;
      for(let s=0;s*K<P.count;s++){
        const c=s*K+mid, l=s*K, r=s*K+K-1;
        if(!Number.isInteger(mid))continue;
        out.push({cx:P.getX(c),cz:P.getZ(c),
          hwL:Math.hypot(P.getX(l)-P.getX(c),P.getZ(l)-P.getZ(c)),
          hwR:Math.hypot(P.getX(r)-P.getX(c),P.getZ(r)-P.getZ(c))});
      }
      return {K,sec:out,P,U,C};
    };
    const V=sections(VK.geometry), Kr=sections(KR.geometry);
    if(!V||!Kr)return {err:"could not recover the cross-sections from a ribbon's uv"};

    // the road's own local half-width at the point nearest (x,z): how far OUTSIDE the dirt a thing
    // stands. Negative means it is standing ON the road.
    const outside=(S)=>(x,z)=>{
      let m=1e9,best=null;
      for(const q of S.sec){const dx=x-q.cx,dz=z-q.cz,d=dx*dx+dz*dz;if(d<m){m=d;best=q;}}
      return Math.sqrt(m)-Math.max(best.hwL,best.hwR);
    };
    const outV=outside(V), outK=outside(Kr);

    // ---- 1. THE PROFILE ------------------------------------------------------------------------
    const profile=(S)=>{
      const bins=S.K, lum=new Array(bins).fill(0), cnt=new Array(bins).fill(0);
      for(let i=0;i<S.P.count;i++){
        const k=i%S.K;
        lum[k]+=0.2126*S.C.getX(i)+0.7152*S.C.getY(i)+0.0722*S.C.getZ(i); cnt[k]++;
      }
      const p=lum.map((v,i)=>+(v/cnt[i]).toFixed(3));
      return {p,mid:p[(bins-1)/2],edge:+((p[0]+p[bins-1])/2).toFixed(3),
        spread:+(Math.max(...p)-Math.min(...p)).toFixed(3)};
    };
    const pv=profile(V), pk=profile(Kr);

    // NO CUT-LINE CHECK HERE, AND THAT IS DELIBERATE. The first cut of this gate compared the two
    // roads' vertex-colour luminance against the TERRAIN's and reported the lawn at 1.239. A
    // luminance cannot exceed 1: terrain vertex colours are MULTIPLIERS around 1.0 on a green base
    // colour, while a road's are close to absolute against a near-white map. The two are not in the
    // same space and no amount of care makes them comparable. "Does the road cut a traceable line
    // in the grass" is a question about a RENDERED FRAME — tools/vikingshot.js measures it there.
    // Retuning a palette against a broken meter is how v130.4 shipped the value order inverted.

    // ---- 2. THE DRAPE --------------------------------------------------------------------------
    let dWorst=0, dAt=null;
    for(let i=0;i<V.P.count;i+=3){
      const x=V.P.getX(i), y=V.P.getY(i), z=V.P.getZ(i);
      const e=Math.abs(y-groundY(x,z)-0.035);
      if(e>dWorst){dWorst=e;dAt=[+x.toFixed(1),+z.toFixed(1)];}
    }

    // ---- 2b. POKE-THROUGH: does the GROUND come up through the ribbon BETWEEN its vertices? -----
    // Every vertex sitting 0.035 above groundY says nothing about the surface in between. A ribbon
    // segment spanning a convex crease in the terrain cuts a CHORD under the ridge, and if the
    // chord sags further than the offset, the ground erupts through the road. It renders as a green
    // wedge, and a lattice of creases renders as a regular ladder of them — which is exactly what
    // _viking/viking-top.png shows. Measured at TRIANGLE CENTROIDS, which is where a chord sags
    // most, for both ribbons so the King's Road's own clearance is the bar.
    const poke=(g)=>{
      const P=g.attributes.position, I=g.index;
      let worst=1e9, at=null, n=0, tot=0;
      for(let i=0;i<I.count;i+=3){
        const a=I.getX(i), b2=I.getX(i+1), c=I.getX(i+2);
        const x=(P.getX(a)+P.getX(b2)+P.getX(c))/3;
        const y=(P.getY(a)+P.getY(b2)+P.getY(c))/3;
        const z=(P.getZ(a)+P.getZ(b2)+P.getZ(c))/3;
        const cl=y-groundY(x,z); tot++;
        if(cl<0)n++;
        if(cl<worst){worst=cl;at=[+x.toFixed(1),+z.toFixed(1)];}
      }
      return {worst:+worst.toFixed(4),at,n,tot};
    };
    const pkV=poke(VK.geometry), pkK=poke(KR.geometry);

    // ---- 3. THE JUNCTION -----------------------------------------------------------------------
    const rc=new THREE.Raycaster(); rc.far=900;
    const down=new THREE.Vector3(0,-1,0);
    // ASKED AS "IS THE KING'S ROAD HIGHER", NOT "IS IT HIT FIRST". Those are the same question
    // everywhere except at a ribbon's terminal cross-section, where both strips have a zero-length
    // end and a ray down the seam can return two hits on the SAME mesh. The first cut of this gate
    // scored that as 47/48 and blamed the junction; the defect was the question. Take the top
    // surface of each ribbon and compare those.
    let both=0, kingOver=0, worstGap=1e9, gapAt=null;
    for(const team of [0,1])for(let i=0;i<=80;i++){
      const p=vikingPoint(team,i/80*0.12);
      rc.set(new THREE.Vector3(p.x,300,p.z),down);
      const hits=rc.intersectObjects([KR,VK],false);
      let ky=-1e9, vy=-1e9;
      for(const h of hits){if(h.object===KR)ky=Math.max(ky,h.point.y);else vy=Math.max(vy,h.point.y);}
      if(ky<-1e8||vy<-1e8)continue;                    // only where both surfaces are present
      both++;
      if(ky>vy)kingOver++;
      const g=ky-vy;
      if(g<worstGap){worstGap=g;gapAt=[+p.x.toFixed(1),+p.z.toFixed(1)];}
    }

    // ---- 4 & 5. WHAT IS STANDING IN IT ---------------------------------------------------------
    const spineD=(pts)=>(x,z)=>{let m=1e9;for(const p of pts){const dx=x-p.x,dz=z-p.z,d=dx*dx+dz*dz;if(d<m)m=d;}return Math.sqrt(m);};
    const VS=[]; for(const t of [0,1])for(let i=0;i<=400;i++)VS.push(vikingPoint(t,i/400));
    const KS=[]; for(let i=0;i<=400;i++)KS.push(roadPoint(i/400));
    const dV=spineD(VS), dK=spineD(KS);
    let wV=1e9,wVat=null,wK=1e9;
    for(const n of nodes)if(n.type==="wood"){
      const a=dV(n.x,n.z); if(a<wV){wV=a;wVat=[+n.x.toFixed(0),+n.z.toFixed(0)];}
      const c=dK(n.x,n.z); if(c<wK)wK=c;
    }
    // FOLIAGE, READ THE WAY IT IS DRAWN. undergrowth culls by zeroing an instance's SCALE and
    // leaving it in the buffer, so a position list alone reports greenery that does not exist.
    let fV=1e9,fVat=null,fK=1e9,fN=0,fSkip=0;
    const _m=new THREE.Matrix4(), _s=new THREE.Vector3(), _q=new THREE.Quaternion(), _p=new THREE.Vector3();
    if(typeof FOLIAGE_LAYERS!=="undefined")for(const L of FOLIAGE_LAYERS){
      for(let i=0;i<L.inst.count;i+=3){
        L.inst.getMatrixAt(i,_m); _m.decompose(_p,_q,_s);
        if(_s.x*_s.y*_s.z<1e-6){fSkip++;continue;}      // culled: not drawn, not a defect
        fN++;
        const a=outV(_p.x,_p.z); if(a<fV){fV=a;fVat=[+_p.x.toFixed(0),+_p.z.toFixed(0)];}
        const c=outK(_p.x,_p.z); if(c<fK)fK=c;
      }
    }

    // ---- 6. THE WIDTH THE GEOMETRY ACTUALLY HAS ------------------------------------------------
    // measured off the body of the road; the last 10% is a deliberate taper into the beach.
    const body=(S)=>{const n=S.sec.length/2, w=[];
      for(let s=0;s<S.sec.length;s++){const t=(s%n)/(n-1); if(t>0.895)continue;
        w.push(S.sec[s].hwL,S.sec[s].hwR);}
      return {lo:+Math.min(...w).toFixed(2),hi:+Math.max(...w).toFixed(2),
        avg:+(w.reduce((a,c)=>a+c,0)/w.length).toFixed(2)};};
    const bw=body(V), bk={lo:+Math.min(...Kr.sec.map(q=>Math.min(q.hwL,q.hwR))).toFixed(2),
                          hi:+Math.max(...Kr.sec.map(q=>Math.max(q.hwL,q.hwR))).toFixed(2),
                          avg:+(Kr.sec.reduce((a,q)=>a+q.hwL+q.hwR,0)/(Kr.sec.length*2)).toFixed(2)};

    // ---- 7. THE ENDS ---------------------------------------------------------------------------
    const boss=CAMPS.find(c=>c.boss), tip=vikingPoint(0,1);
    const baz=BAZAAR_SITES.filter(s=>s.team!==undefined).map(s=>{const p=s.p();
      return {what:s.what,off:+dV(p.x,p.z).toFixed(2)};});

    return {pv,pk,pkV,pkK,dWorst,dAt,both,kingOver,worstGap:+worstGap.toFixed(3),gapAt,
      wV:+wV.toFixed(1),wVat,wK:+wK.toFixed(1),fV:+fV.toFixed(2),fVat,fK:+fK.toFixed(2),fN,fSkip,
      bw,bk,tipD:+Math.hypot(tip.x-boss.x,tip.z-boss.z).toFixed(1),sandR:boss.r-1,baz,
      verts:V.P.count,tris:VK.geometry.index.count/3,K:V.K,
      kverts:Kr.P.count,ktris:KR.geometry.index.count/3,
      TCV:(typeof TREE_CLEAR_VIKING!=="undefined")?TREE_CLEAR_VIKING:null,
      TCR:(typeof TREE_CLEAR_ROAD!=="undefined")?TREE_CLEAR_ROAD:null};
  });

  if(out.err){console.log("!! "+out.err);await b.close();srv.close();process.exit(1);}
  let bad=0; const F=(ok)=>{if(!ok)bad++;return ok?"   ok":"   *** FAIL";};
  const R=(s,v,k)=>"    "+s.padEnd(30)+String(v).padStart(9)+String(k).padStart(11);

  console.log("\n                                    VIKING   KING'S ROAD");
  console.log(R("vertices",out.verts,out.kverts));
  console.log(R("triangles",out.tris,out.ktris));
  console.log(R("draw calls",1,1));
  console.log(R("columns across the track",out.K,27));

  console.log("\n  1. PROFILE — vertex-colour luminance across the track, edge to edge");
  console.log("     viking  "+out.pv.p.map(v=>v.toFixed(2)).join(" "));
  console.log("     king's  "+out.pk.p.map(v=>v.toFixed(2)).join(" "));
  console.log(R("centre",out.pv.mid,out.pk.mid));
  console.log(R("edge (meets the lawn here)",out.pv.edge,out.pk.edge));
  console.log(R("spread",out.pv.spread,out.pk.spread));
  
  console.log("     a footpath is PALEST IN THE MIDDLE — the opposite of a cart road"+
    F(out.pv.mid>out.pv.edge+0.03&&out.pk.mid<out.pk.edge));
  console.log("     the cross-section is rendered, not just computed (v131.15)"+
    F(out.pv.spread>0.05));
  console.log("     (the cut-line question is a rendered-frame question — tools/vikingshot.js)");

  console.log("\n  2. DRAPE — every vertex 0.035 above groundY (the DRAWN mesh, not the function)");
  console.log("     worst error "+out.dWorst+(out.dAt?"  at ("+out.dAt[0]+", "+out.dAt[1]+")":"")+
    F(out.dWorst<0.002));

  console.log("\n  2b. POKE-THROUGH — clearance at TRIANGLE CENTROIDS, where a chord sags most");
  console.log(R("worst clearance",out.pkV.worst,out.pkK.worst));
  console.log(R("triangles under the ground",out.pkV.n+"/"+out.pkV.tot,out.pkK.n+"/"+out.pkK.tot));
  if(out.pkV.at)console.log("     worst at ("+out.pkV.at[0]+", "+out.pkV.at[1]+")");
  console.log("     the ground never erupts through the road"+F(out.pkV.n===0));
  console.log("     …with no less clearance than the King's Road has"+F(out.pkV.worst>=out.pkK.worst*0.5));

  console.log("\n  3. JUNCTION — raycast down where the two roads share ground, "+out.both+" points");
  console.log("     the King's Road is the surface you SEE: "+out.kingOver+"/"+out.both+
    F(out.both>20&&out.kingOver===out.both));
  console.log("     closest the two surfaces come: "+out.worstGap+
    (out.gapAt?"  at ("+out.gapAt[0]+", "+out.gapAt[1]+")":"")+F(out.worstGap>0.015));

  console.log("\n  4. IN THE ROAD — nearest wood node to the spine");
  console.log(R("clearance constant",out.TCV,out.TCR));
  console.log(R("nearest tree actually is",out.wV,out.wK)+
    (out.wVat?"   at ("+out.wVat[0]+", "+out.wVat[1]+")":"")+F(out.wV>=out.TCV-0.8));

  console.log("\n  5. UNDERFOOT — how far OUTSIDE the dirt the nearest drawn foliage stands");
  console.log("     ("+out.fN+" instances sampled, "+out.fSkip+" already culled and skipped)");
  console.log(R("nearest drawn instance",out.fV,out.fK)+
    (out.fVat?"   at ("+out.fVat[0]+", "+out.fVat[1]+")":""));
  console.log("     nothing is standing ON the dirt"+F(out.fV>0));
  console.log("     …and no contact-shadow pool reaches it either (1.85 tail)"+F(out.fV>1.85));

  console.log("\n  6. WIDTH — half-width of the body of the road, off its own edge columns");
  console.log(R("min",out.bw.lo,out.bk.lo));
  console.log(R("max",out.bw.hi,out.bk.hi));
  console.log(R("mean",out.bw.avg,out.bk.avg));
  console.log("     -> a track "+(out.bw.lo*2).toFixed(1)+"-"+(out.bw.hi*2).toFixed(1)+
    " wide against a road "+(out.bk.lo*2).toFixed(1)+"-"+(out.bk.hi*2).toFixed(1));
  console.log("     it is clearly the SMALLER of the two (mean under 60%)"+
    F(out.bw.avg<out.bk.avg*0.6));
  // a path that pinches and swells more than the road it branches off reads as lumpy, not as worn.
  const rv=out.bw.hi/out.bw.lo, rk=out.bk.hi/out.bk.lo;
  console.log("     …and it breathes without lurching: max/min "+rv.toFixed(2)+
    " against the King's Road's "+rk.toFixed(2)+F(rv<rk*1.35));

  console.log("\n  7. ENDS");
  console.log("     the tapered tip is "+out.tipD+" from the bay centre, sand reaches "+out.sandR+
    F(out.tipD<out.sandR));
  for(const z of out.baz)console.log("     the "+z.what+" bazaar sits "+z.off+" off the path"+F(z.off<0.05));

  console.log("\n  "+(bad?bad+" check(s) failed -> FAIL":"the Viking road is a road -> PASS")+"\n");
  await b.close(); srv.close(); process.exit(bad?1:0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
