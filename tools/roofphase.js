#!/usr/bin/env node
/* v131.31 — WHICH WAY DOES A 4-GON CONE ACTUALLY FACE?
   ----------------------------------------------------
   node tools/roofphase.js

   John, on a top-down shot of the new bazaar: "bazaar lower roof is in the shape of a diamond and
   does not line up with square posts below it."

   This is the THIRD time this session that a rotation convention has been reasoned about instead of
   measured — the knight's visor ran on its apothem for two rounds, the Medieval wall's batter lay
   diagonally across the wall for months — and both times the answer came from printing the numbers.
   So print the numbers. For each candidate construction, report where the base ring's vertices
   actually land, in world degrees, and whether the resulting quad's EDGES are parallel to x and z.

   Two separate things are being tested and they interact, which is why arguing about either alone
   has not worked:

     PHASE   r128 lays a cylinder/cone's first radial vertex at theta 0, and its vertex formula is
             (r sin theta, y, r cos theta) — so vertex 0 is on +Z. A 4-gon therefore has CORNERS on
             the axes and FLATS on the diagonals, or the other way round, and which one it is decides
             whether a pi/4 yaw fixes the roof or breaks it.

     ORDER   Matrix4.compose(position, quaternion, scale) builds M = T.R.S, so the SCALE is applied
             in the mesh's own axes FIRST and the rotation then swings the squashed axis with it.
             The bazaar's roof asks for a 12.4 x 9.0 rectangle via scale.z = 0.726 AND a pi/4 yaw,
             and if the yaw is applied after the squash the two fight.

   The fix, whichever way the phase falls, is the one already applied to the Medieval batter in
   v131.28: rotate the GEOMETRY, then scale the mesh.                                             */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8271);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:300,height:200}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8271/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof THREE!=="undefined",null,{timeout:45000});

  const out=await page.evaluate(()=>{
    // the base ring of a cone is its LOWEST distinct y; collect those vertices, dedupe, sort by angle
    const ring=(geo)=>{
      const p=geo.getAttribute("position");
      let lo=Infinity;
      for(let i=0;i<p.count;i++)lo=Math.min(lo,p.getY(i));
      const seen=new Set(), v=[];
      for(let i=0;i<p.count;i++){
        if(Math.abs(p.getY(i)-lo)>1e-4)continue;
        const x=+p.getX(i).toFixed(4), z=+p.getZ(i).toFixed(4);
        if(Math.abs(x)<1e-4&&Math.abs(z)<1e-4)continue;      // the cap's centre vertex
        const k=x+"|"+z; if(seen.has(k))continue; seen.add(k);
        v.push([x,z]);
      }
      v.sort((a,c)=>Math.atan2(a[0],a[1])-Math.atan2(c[0],c[1]));
      return v;
    };
    const deg=v=>v.map(([x,z])=>+(Math.atan2(x,z)*180/Math.PI).toFixed(1));
    // are the four EDGES parallel to the world axes? (that is what "lines up with the posts" means)
    const edgesAxial=(v)=>{
      if(v.length!==4)return null;
      let worst=0;
      for(let i=0;i<4;i++){
        const a=v[i], c=v[(i+1)%4];
        const dx=Math.abs(c[0]-a[0]), dz=Math.abs(c[1]-a[1]);
        // an axis-parallel edge has one component ~0; score the off-axis lean in degrees
        const lean=Math.min(Math.atan2(dx,dz),Math.atan2(dz,dx))*180/Math.PI;
        worst=Math.max(worst,lean);
      }
      return +worst.toFixed(2);
    };
    const span=(v)=>({x:+(Math.max(...v.map(a=>a[0]))-Math.min(...v.map(a=>a[0]))).toFixed(2),
                      z:+(Math.max(...v.map(a=>a[1]))-Math.min(...v.map(a=>a[1]))).toFixed(2)});

    const mk=(yawGeo,yawMesh,sz)=>{
      const g=new THREE.ConeGeometry(8.77,2.40,4);
      if(yawGeo)g.rotateY(yawGeo);
      const m=new THREE.Matrix4().compose(
        new THREE.Vector3(0,0,0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yawMesh||0,0)),
        new THREE.Vector3(1,1,sz===undefined?1:sz));
      g.applyMatrix4(m);
      const v=ring(g);
      return {deg:deg(v),lean:edgesAxial(v),span:span(v)};
    };
    return {
      raw        : mk(0,0,1),
      meshYaw    : mk(0,Math.PI/4,1),
      shipped    : mk(0,Math.PI/4,0.726),      // what v131.29 actually built
      geoYawOnly : mk(Math.PI/4,0,1),
      geoYawScale: mk(Math.PI/4,0,0.726),      // the proposed fix
    };
  });

  console.log("\n  a ConeGeometry(8.77, 2.40, 4) base ring — vertex bearings, edge lean, and plan span");
  console.log("  \"lean\" is how far the quad's EDGES sit off the world axes: 0 lines up, 45 is a diamond\n");
  const rows=[
    ["raw                       ","ConeGeometry, untouched"],
    ["meshYaw                   ","mesh.rotation.y = PI/4"],
    ["shipped                   ","mesh yaw PI/4 AND scale.z 0.726   <-- v131.29"],
    ["geoYawOnly                ","geometry.rotateY(PI/4)"],
    ["geoYawScale               ","geometry.rotateY(PI/4) then scale.z 0.726   <-- proposed"],
  ];
  const keys=["raw","meshYaw","shipped","geoYawOnly","geoYawScale"];
  for(let i=0;i<keys.length;i++){
    const r=out[keys[i]];
    console.log("   "+rows[i][0]+" lean "+String(r.lean).padStart(6)+" deg   span "+
      String(r.span.x).padStart(6)+" x "+String(r.span.z).padStart(6)+
      "   verts "+JSON.stringify(r.deg));
    console.log("   "+" ".repeat(26)+" "+rows[i][1]);
  }
  console.log("\n  The hall's posts sit at x -4.6/0/+4.6 and z -3.2/+3.2 — axis-aligned. The roof has to");
  console.log("  be 12.40 across and 9.00 deep with a lean of 0 to sit on them.\n");
  await b.close(); srv.close(); process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
