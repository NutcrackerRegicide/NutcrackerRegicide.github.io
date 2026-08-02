/* REGICIDE PVP — 03-buildings.js */
// ---------- buildings: six ages of architecture, all 2x scale (v53) ----------
// Every building renders in the style of its team's CURRENT age and re-dresses on age-up.
// 0 Stone: hide-and-mammoth-bone lodges (Mezhirich). 1 Bronze: battered sandstone, Egypt/Minoa.
// 2 Iron: roundhouses & thatched longhouses. 3 Classical: marble, columns, pediments.
// 4 Medieval: Romanesque mass with gothic accents. 5 Enlightenment: white neoclassical grandeur.

const AGEPAL=[
  // v128: the age palettes were all earth and ash. The ROOFS carry a stylised town — they are the
  // one big block of non-green in a very green world — so each age's roof got pushed toward a
  // saturated hue while the walls stayed pale, which is exactly the Pallet Town read: bright roof,
  // clean wall, green everywhere else.
  {wallP:"hide",   wallC:0xb89c72,roofC:0xa8623a,trimC:0xf0e8da,darkC:0x4a3a28,stoneC:0x9a8a76},
  {wallP:"cloth",  wallC:0xe6d3a6,roofC:0xd9954a,trimC:0xf0b62e,darkC:0x6e5636,stoneC:0xc9b088},
  {wallP:"cloth",  wallC:0xd6c199,roofC:0xc06a30,trimC:0x8a5f34,darkC:0x3a2e1e,stoneC:0x8d7a5a},
  {wallP:"uniform",wallC:0xf2ecda,roofC:0xd8452e,trimC:0xf0b62e,darkC:0x2b2418,stoneC:0xd9d0b8},
  {wallP:"metal",  wallC:0x99a2ac,roofC:0x3f6d8c,trimC:0xa9b3bd,darkC:0x1e1e24,stoneC:0x6a7280},
  {wallP:"uniform",wallC:0xfbf7ee,roofC:0x2f9e86,trimC:0xffffff,darkC:0x2b3038,stoneC:0xe3dccb}
];
const BONE=0xe6ded0, IVORY=0xefe8da, GOLD=0xd9a92e, MINOANRED=0xa8402e, THATCH=0x9a8148;
function aWall(age,shade){const p=AGEPAL[age];return texturedMat(p.wallP,shade||p.wallC);}

// -- shared construction vocabulary --
function bDome(r,pat,c){ // hide dome, copper dome — half a sphere
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,6,0,Math.PI*2,0,Math.PI/2),texturedMat(pat,c));
  m.castShadow=true; return m;
}
// a few types read better a touch smaller than the blanket 2x — scaled via a wrapper
// so the construction-raise (which drives body.scale.y) still animates cleanly
const BSCALE={storage_pit:0.95,farm:0.6375,watch_tower:0.75};
// a properly ribbed mammoth-bone dome: hide skin, meridian bone arches, horizontal lashings
function ribbedDome(g,rx,ry,rz,wallC,nRibs,ringYs){
  const dome=bDome(1,"hide",wallC); dome.scale.set(rx,ry,rz); g.add(dome);
  const rr=Math.min(rx,rz);
  for(let i=0;i<nRibs;i++){ // longitudinal ribs hug the surface, rim to rim over the crown
    const rib=new THREE.Mesh(new THREE.TorusGeometry(rr*0.99,rr*0.05+0.12,6,14,Math.PI),plainMat(IVORY));
    rib.scale.y=ry/rr; rib.rotation.y=i/nRibs*Math.PI; rib.castShadow=false; g.add(rib);
  }
  for(const hy of (ringYs||[])){ // horizontal bone rings lash the ribs together
    const rad=rx*Math.sqrt(Math.max(0.04,1-(hy/ry)*(hy/ry)));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(rad*0.99,0.16,5,20),plainMat(BONE));
    ring.rotation.x=Math.PI/2; ring.scale.z=rz/rx; ring.position.y=hy; ring.castShadow=false; g.add(ring);
  }
}

// ---------- dirt roads: a town knits itself together as it grows ----------
const ROADPAL=[0x7a5b3a,0x7a5b3a,0x816246,0xb8a678,0x6f6a5e,0xcfc6b2]; // dirt→gravel→cobble→pale stone
const _roadMatCache=new Map();
function _roadShade(n,f){const r=Math.min(255,((n>>16)&255)*f|0),g2=Math.min(255,((n>>8)&255)*f|0),b=Math.min(255,(n&255)*f|0);
  return "rgb("+r+","+g2+","+b+")";}
function roadTexture(age){ // chunky 2px pixels, same dialect as the terrain
  const base=ROADPAL[age];
  const c=document.createElement("canvas"); c.width=c.height=64;
  const ctx=c.getContext("2d");
  ctx.fillStyle=_roadShade(base,1); ctx.fillRect(0,0,64,64);
  if(age<=1){ // packed dirt: mottle + two worn wheel ruts
    for(let i=0;i<240;i++){ctx.fillStyle=_roadShade(base,0.8+Math.random()*0.4);
      ctx.fillRect(((Math.random()*64)|0)&~1,((Math.random()*64)|0)&~1,2,2);}
    ctx.fillStyle=_roadShade(base,0.68);
    for(const rx of [16,44])for(let y=0;y<64;y+=2)ctx.fillRect(rx+((Math.sin(y*0.25)*2)|0),y,4,2);
  }else if(age===2){ // gravel: dense speckle of small stones
    for(let i=0;i<340;i++){ctx.fillStyle=_roadShade(base,0.7+Math.random()*0.6);
      const s=2+((Math.random()*2)|0)*2;
      ctx.fillRect(((Math.random()*64)|0)&~1,((Math.random()*64)|0)&~1,s,s);}
  }else if(age===3){ // sandy flagstones: offset blocks, darker mortar seams
    for(let i=0;i<140;i++){ctx.fillStyle=_roadShade(base,0.9+Math.random()*0.18);
      ctx.fillRect(((Math.random()*64)|0)&~1,((Math.random()*64)|0)&~1,4,4);}
    ctx.fillStyle=_roadShade(base,0.72);
    for(let y=0;y<=64;y+=16)ctx.fillRect(0,y-1,64,2);
    for(let y=0;y<64;y+=16){const off=((y/16)%2)*8;
      for(let x=off;x<=64;x+=16)ctx.fillRect(x-1,y,2,16);}
  }else if(age===4){ // grey cobbles: rounded stones in offset rows over dark grout
    ctx.fillStyle=_roadShade(base,0.6); ctx.fillRect(0,0,64,64);
    for(let y=0;y<64;y+=8){const off=((y/8)%2)*4;
      for(let x=-4;x<68;x+=8){ctx.fillStyle=_roadShade(base,0.85+Math.random()*0.35);
        ctx.fillRect(x+off+1,y+1,6,6);}}
  }else{ // pale dressed pavers: brick-laid, thin joints
    ctx.fillStyle=_roadShade(base,0.78); ctx.fillRect(0,0,64,64);
    for(let y=0;y<64;y+=8){const off=((y/8)%2)*8;
      for(let x=-8;x<68;x+=16){ctx.fillStyle=_roadShade(base,0.92+Math.random()*0.16);
        ctx.fillRect(x+off+1,y+1,14,6);}}
  }
  const t=new THREE.CanvasTexture(c);
  t.encoding=THREE.sRGBEncoding;
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
function roadMat(age){
  if(!_roadMatCache.has(age))_roadMatCache.set(age,new THREE.MeshLambertMaterial({map:roadTexture(age),
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})); // beats the terrain in depth ties
  return _roadMatCache.get(age);
}
function _roadUV(geo,ux,uz){ // tile the texture at constant world density (one tile per ~6 units)
  const uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*ux,uv.getY(i)*uz);
  uv.needsUpdate=true;
}
const roadGroups=[null,null];
function roadEligible(b){
  return b.alive&&b.built&&!b.def.wall&&b.type!=="farm"&&b.type!=="storage_pit";
}
// each paved element drapes over the terrain: its vertices are pushed to ground height,
// so slopes never swallow a road end. `lift` staggers heights so overlaps never z-fight.
function _drapedPlane(w,len,ang,cx,cy,cz,lift,mat,uw,ul){
  const pg=new THREE.PlaneGeometry(w,len,2,Math.max(2,Math.ceil(len/3)));
  _roadUV(pg,uw,ul);
  const pos=pg.attributes.position, cA=Math.cos(ang), sA=Math.sin(ang);
  for(let i=0;i<pos.count;i++){
    const vx=pos.getX(i), vy=pos.getY(i);
    const wx=cx+vx*cA-vy*sA, wz=cz-vx*sA-vy*cA;
    pos.setZ(i,terrainHeight(wx,wz)+lift-cy);
  }
  pg.computeVertexNormals();
  const g=new THREE.Group(); g.position.set(cx,cy,cz); g.rotation.y=ang;
  const pl=new THREE.Mesh(pg,mat); pl.rotation.x=-Math.PI/2; pl.receiveShadow=true; g.add(pl);
  return g;
}
function layRoad(grp,x1,z1,x2,z2,w,mat,lift){
  const dx=x2-x1,dz=z2-z1,L=Math.hypot(dx,dz); if(L<1)return;
  const cx=(x1+x2)/2, cz=(z1+z2)/2;
  grp.add(_drapedPlane(w,L+0.6,Math.atan2(dx,dz),cx,terrainHeight(cx,cz)+lift,cz,lift,mat,w/6,L/6));
}
function layPad(grp,x,z,half,rot,mat,lift){ // a paved apron squared to the building's outline
  grp.add(_drapedPlane(half*2,half*2,rot||0,x,terrainHeight(x,z)+lift,z,lift,mat,half/3,half/3));
}
// grass pockets fully enclosed by paving become GARDENS: flowers and greenery move in
function layGardens(grp,tc,links,pads){
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  for(const p of pads){minX=Math.min(minX,p.x-p.h);maxX=Math.max(maxX,p.x+p.h);
    minZ=Math.min(minZ,p.z-p.h);maxZ=Math.max(maxZ,p.z+p.h);}
  for(const l of links){minX=Math.min(minX,l.x1,l.x2);maxX=Math.max(maxX,l.x1,l.x2);
    minZ=Math.min(minZ,l.z1,l.z2);maxZ=Math.max(maxZ,l.z1,l.z2);}
  if(minX>maxX)return;
  minX-=4;maxX+=4;minZ-=4;maxZ+=4;
  const CELL=2, NX=Math.min(96,Math.ceil((maxX-minX)/CELL)), NZ=Math.min(96,Math.ceil((maxZ-minZ)/CELL));
  if(NX<3||NZ<3)return;
  const paved=new Uint8Array(NX*NZ);
  const cxOf=i=>minX+(i+0.5)*CELL, czOf=j=>minZ+(j+0.5)*CELL;
  for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++){
    const px=cxOf(i), pz=czOf(j);
    let hit=false;
    for(const b of buildings){ // no flowers inside anyone's footprint — farm plots included
      if(b.alive&&dist2(px,pz,b.x,b.z)<Math.pow(b.def.r*0.95+0.8,2)){hit=true;break;}}
    if(!hit)for(const p of pads){if(Math.abs(px-p.x)<p.h+0.8&&Math.abs(pz-p.z)<p.h+0.8){hit=true;break;}}
    if(!hit)for(const l of links){ // distance from cell to the alley's centerline
      const ax=px-l.x1, az=pz-l.z1, bx=l.x2-l.x1, bz=l.z2-l.z1, bl=bx*bx+bz*bz||1;
      const t=Math.max(0,Math.min(1,(ax*bx+az*bz)/bl));
      const qx=l.x1+bx*t-px, qz=l.z1+bz*t-pz;
      if(qx*qx+qz*qz<Math.pow(l.w/2+0.8,2)){hit=true;break;}
    }
    if(hit)paved[i*NZ+j]=1;
  }
  // flood the open world in from the border: whatever grass it can't reach is enclosed
  const seen=new Uint8Array(NX*NZ), q=[];
  for(let i=0;i<NX;i++)for(const j of [0,NZ-1])if(!paved[i*NZ+j]&&!seen[i*NZ+j]){seen[i*NZ+j]=1;q.push(i*NZ+j);}
  for(let j=0;j<NZ;j++)for(const i of [0,NX-1])if(!paved[i*NZ+j]&&!seen[i*NZ+j]){seen[i*NZ+j]=1;q.push(i*NZ+j);}
  while(q.length){
    const c=q.pop(), ci=(c/NZ)|0, cj=c%NZ;
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const ni=ci+di, nj=cj+dj;
      if(ni<0||nj<0||ni>=NX||nj>=NZ)continue;
      const n=ni*NZ+nj;
      if(!paved[n]&&!seen[n]){seen[n]=1;q.push(n);}
    }
  }
  const BLOOMS=[0xe66a8a,0xe6c84a,0xf0efe4,0xc23a3a,0x9a6ae6,0xe08a2e];
  let budget=80;
  for(let i=1;i<NX-1&&budget>0;i++)for(let j=1;j<NZ-1&&budget>0;j++){
    const c=i*NZ+j;
    if(paved[c]||seen[c])continue; // paved, or open country — not a courtyard
    const gx=cxOf(i), gz=czOf(j);
    if(dist2(gx,gz,tc.x,tc.z)>80*80)continue;
    const h=(((i*73856093)^(j*19349663))>>>0)%97; // deterministic sprinkle
    if(h>55)continue;
    const fx=gx+((h%7)-3)*0.22, fz=gz+(((h>>3)%7)-3)*0.22, fy=terrainHeight(fx,fz);
    const dec=new THREE.Group(); dec.position.set(fx,fy,fz); dec.userData.garden=true;
    if(h%5===0){ // a clipped little bush
      const bush=new THREE.Mesh(new THREE.ConeGeometry(0.55,0.85,6),plainMat(0x5f8a4a));
      bush.position.y=0.42; bush.castShadow=false; dec.add(bush);
    }else{ // a flower on its stem
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.5,4),plainMat(0x4f7d2f));
      stem.position.y=0.25; stem.castShadow=false; dec.add(stem);
      const bloom=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.18,0.24),plainMat(BLOOMS[h%BLOOMS.length]));
      bloom.position.y=0.55; bloom.castShadow=false; dec.add(bloom);
    }
    grp.add(dec); budget--;
  }
}
function rebuildRoads(team){
  let grp=roadGroups[team];
  if(!grp){grp=new THREE.Group(); roadGroups[team]=grp; if(typeof scene!=="undefined")scene.add(grp);}
  for(let i=grp.children.length-1;i>=0;i--){ // clear last age's streets
    const seg=grp.children[i]; seg.traverse(o=>{if(o.geometry)o.geometry.dispose();}); grp.remove(seg);
  }
  const tc=teamTC(team); if(!tc)return;
  const city=buildings.filter(b=>b.team===team&&roadEligible(b)&&b.type!=="towncenter"&&
    dist2(b.x,b.z,tc.x,tc.z)<80*80);
  if(city.length<1)return; // a lone Town Center has no streets yet
  const age=teamAge[team]||0, mat=roadMat(Math.min(5,age));
  let k=0; const lift=()=>0.06+((k++)%8)*0.014; // staggered heights: overlaps never z-fight
  const links=[], pads=[];
  const tcPadH=tc.def.r+3;
  layPad(grp,tc.x,tc.z,tcPadH,tc.rot||0,mat,lift()); pads.push({x:tc.x,z:tc.z,h:tcPadH});
  // grow a street tree out from the Town Center; only close buildings get linked.
  // links are ALLEYS: as wide as the smaller building, so neighbors pave the whole gap
  const MAXLINK=44, nodes2=[{x:tc.x,z:tc.z,r:tc.def.r}], pending=city.slice();
  let progress=true;
  while(pending.length&&progress){
    progress=false; let bestI=-1,bestJ=-1,bd=MAXLINK*MAXLINK;
    for(let i=0;i<pending.length;i++)for(let j=0;j<nodes2.length;j++){
      const d=dist2(pending[i].x,pending[i].z,nodes2[j].x,nodes2[j].z);
      if(d<bd){bd=d;bestI=i;bestJ=j;}
    }
    if(bestI>=0){
      const b=pending.splice(bestI,1)[0], n=nodes2[bestJ];
      const W=Math.max(5,Math.min(11,Math.min(b.def.r,n.r)*1.8));
      layRoad(grp,n.x,n.z,b.x,b.z,W,mat,lift()); links.push({x1:n.x,z1:n.z,x2:b.x,z2:b.z,w:W});
      const padH=b.def.r*0.95+1.5;
      layPad(grp,b.x,b.z,padH,b.rot||0,mat,lift()); pads.push({x:b.x,z:b.z,h:padH}); // apron hugs the building outline
      nodes2.push({x:b.x,z:b.z,r:b.def.r}); progress=true;
    }
  }
  layGardens(grp,tc,links,pads); // enclosed grass courts bloom into gardens
}
function frustum4(wBot,wTop,h,mesh_mat){ // square-plan battered mass, faces axis-aligned
  const m=new THREE.Mesh(new THREE.CylinderGeometry(wTop*0.7071,wBot*0.7071,h,4),mesh_mat);
  m.rotation.y=Math.PI/4; m.castShadow=true; return m;
}
function pedTri(w,h,c){ // flat triangle: pediments and gable infill (4-cone squashed on z)
  const t=cone(w/2,h,c,4); t.scale.z=0.1; t.castShadow=false; return t;
}
function boneArc(R){const m=new THREE.Mesh(new THREE.TorusGeometry(R,0.22,5,10,Math.PI),plainMat(BONE));m.castShadow=false;return m;}
function tuskArc(R){const m=new THREE.Mesh(new THREE.TorusGeometry(R,0.15,5,8,Math.PI*0.62),plainMat(IVORY));m.castShadow=false;return m;}
// v128.1: the roof is a building's silhouette — ink it and the whole town reads at a glance.
// Applied here rather than on every wall panel so a hall costs ~2 extra calls, not ~20.
function gableRoof(g,w,d,yBase,h,slabC,gableC,ov){ // ridge along z, slopes across x
  ov=ov===undefined?0.6:ov;
  const ang=Math.atan2(h,w/2), len=Math.hypot(h,w/2)+0.35;
  for(const s of [-1,1]){
    const slab=box(len,0.42,d+ov*2,slabC);
    slab.rotation.z=-s*ang; slab.position.set(s*w/4,yBase+h/2,0); inkOutline(slab,2.4); g.add(slab);
  }
  const ridge=box(0.55,0.4,d+ov*2,slabC); ridge.position.set(0,yBase+h+0.05,0); ridge.castShadow=false; g.add(ridge);
  for(const s of [-1,1]){
    const tri=pedTri(w*0.98,h*0.96,gableC); tri.position.set(0,yBase+h*0.48,s*(d/2-0.35)); g.add(tri);
  }
}
function colAt(g,x,z,h,r,age){ // a column in the local dialect
  if(age===1){ // Minoan: red, tapering DOWNWARD, black cushion capital
    const c=cyl(r,r*0.7,h,MINOANRED,9); c.position.set(x,h/2+0.15,z); g.add(c);
    const cap=cyl(r*1.35,r*1.1,0.4,0x2b2018,9); cap.castShadow=false; cap.position.set(x,h+0.35,z); g.add(cap);
  }else{
    const white=age>=5?0xf2ede2:0xe8e2d0;
    const c=cyl(r*0.82,r,h,white,9); c.position.set(x,h/2+0.15,z); g.add(c);
    const cap=box(r*2.5,0.3,r*2.5,age===4?0x99a1ab:GOLD); cap.castShadow=false; cap.position.set(x,h+0.3,z); g.add(cap);
    const base=box(r*2.4,0.3,r*2.4,white); base.castShadow=false; base.position.set(x,0.15,z); g.add(base);
  }
}
function archDoor(g,x,z,w,h,c){ // Romanesque: dark door under a rounded stone header
  const d=box(w,h,0.3,c); d.castShadow=false; d.position.set(x,h/2,z); g.add(d);
  const arch=cyl(w/2,w/2,0.34,c,10); arch.rotation.x=Math.PI/2; arch.castShadow=false; arch.position.set(x,h,z); g.add(arch);
  const frame=cyl(w/2+0.24,w/2+0.24,0.2,0x6a7280,10); frame.rotation.x=Math.PI/2; frame.castShadow=false;
  frame.position.set(x,h,z-0.04); g.add(frame);
}
function balustrade(g,w,y,z,c){ // Enlightenment roofline posts + rail
  const n=Math.max(3,Math.floor(w/1.15));
  for(let i=0;i<=n;i++){const p=cyl(0.09,0.12,0.7,c,5);p.castShadow=false;p.position.set(-w/2+i*(w/n),y+0.35,z);g.add(p);}
  const rail=box(w+0.3,0.16,0.26,c); rail.castShadow=false; rail.position.set(0,y+0.78,z); g.add(rail);
}
function winGrid(g,cols,rows,y0,dy,zF,dark,sill){ // sash window rows
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=(c-(cols-1)/2)*2.0;
    const w=box(0.95,1.35,0.12,dark); w.castShadow=false; w.position.set(x,y0+r*dy,zF); g.add(w);
    if(sill!==undefined){const s=box(1.2,0.12,0.18,sill);s.castShadow=false;s.position.set(x,y0+r*dy-0.8,zF+0.02);g.add(s);}
  }
}
function horns(g,x,y,z){ // Minoan horns of consecration
  const b=box(1.5,0.35,0.55,0xd9cba4); b.castShadow=false; b.position.set(x,y,z); g.add(b);
  for(const s of [-1,1]){const h=cone(0.22,1.1,0xe7dcc0,5); h.rotation.z=-s*0.5; h.castShadow=false; h.position.set(x+s*0.55,y+0.62,z); g.add(h);}
}
function flagPole(g,x,y,z,h,tc,fw,fh){
  fw=fw||2; fh=fh||1;
  const p=cyl(0.09,0.11,h,0x6b4a2b,5); p.castShadow=false; p.position.set(x,y+h/2,z); g.add(p);
  const f=box(fw,fh,0.09,tc); f.castShadow=false; f.position.set(x+fw/2,y+h-fh*0.6,z); g.add(f);
}
function firePit(g,x,z){
  for(let i=0;i<4;i++){const st=box(0.5,0.35,0.4,0x8a7a6a); st.castShadow=false;
    st.position.set(x+Math.cos(i*1.57)*0.8,0.18,z+Math.sin(i*1.57)*0.8); st.rotation.y=i*0.7; g.add(st);}
  const fl=cone(0.35,0.8,0xe08a2e,5); fl.castShadow=false; fl.position.set(x,0.6,z); g.add(fl);
}
function brazier(g,x,z){
  const bowl=cyl(0.42,0.28,0.5,0x8d7a5a,7); bowl.castShadow=false; bowl.position.set(x,0.8,z); g.add(bowl);
  const fl=cone(0.28,0.6,0xe08a2e,5); fl.castShadow=false; fl.position.set(x,1.35,z); g.add(fl);
}

// -- the generic hall shell: walls + roof + door in the idiom of the age --
// footprint w (x) by d (z), wall height h; the door faces +z. Type props go on after.
function agedShell(g,age,tc,w,h,d){
  const p=AGEPAL[age];
  if(age===0){ // hide longdome over a mammoth-bone frame
    ribbedDome(g,w/2,h*1.15,d/2,p.wallC,6,[h*0.35,h*0.8]);
    for(const s of [-1,1]){const t=tuskArc(1.5); t.rotation.z=s*0.5; t.position.set(s*1.4,0.25,d/2+0.25); g.add(t);}
    const flap=box(1.9,2.2,0.16,tc); flap.castShadow=false; flap.rotation.x=-0.16; flap.position.set(0,1.15,d/2-0.1); g.add(flap);
    const band=box(3.6,0.7,0.14,tc); band.castShadow=false; band.rotation.x=-0.3; band.position.set(0,h*0.82,d/2*0.72); g.add(band);
  }else if(age===1){ // battered sandstone mass, cavetto cornice, pennant mast
    const course=new THREE.Mesh(new THREE.BoxGeometry(w+0.8,1.2,d+0.8),texturedMat("cloth",p.stoneC));
    course.position.y=0.6; course.castShadow=true; g.add(course);
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(1)); main.position.y=h/2+0.4; main.castShadow=true; g.add(main);
    const cornice=new THREE.Mesh(new THREE.BoxGeometry(w+1,0.7,d+1),texturedMat("cloth",p.stoneC));
    cornice.position.y=h+0.75; cornice.castShadow=false; g.add(cornice);
    const trim=box(w+1.1,0.22,d+1.1,GOLD); trim.castShadow=false; trim.position.y=h+1.15; g.add(trim);
    for(const s of [-1,1]){const par=box(w+1,0.6,0.35,p.stoneC); par.castShadow=false; par.position.set(0,h+1.4,s*(d/2+0.35)); g.add(par);}
    horns(g,w/2-1,h+1.65,d/2+0.35);
    const door=box(2,2.7,0.2,p.darkC); door.castShadow=false; door.position.set(0,1.5,d/2+0.06); g.add(door);
    const lint=box(2.5,0.3,0.24,GOLD); lint.castShadow=false; lint.position.set(0,3,d/2+0.08); g.add(lint);
    flagPole(g,-w/2+0.8,h+1.2,d/2+0.2,3.4,tc,1.4,0.7);
  }else if(age===2){ // plank hall on a stone footing, deep thatch gable
    const foot=new THREE.Mesh(new THREE.BoxGeometry(w+0.6,0.9,d+0.6),texturedMat("metal",p.stoneC));
    foot.position.y=0.45; foot.castShadow=true; g.add(foot);
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),texturedMat("wood",0x8a6f4a));
    main.position.y=h/2+0.3; main.castShadow=true; g.add(main);
    const hR=Math.min(w*0.5,5.5);
    gableRoof(g,w+1.6,d,h+0.3,hR,THATCH,0x7a5f42,1.0);
    for(const s of [-1,1]){ // crossed gable boards, the carpenter's signature
      const xa=box(0.2,2.6,0.16,0x5a4632); xa.rotation.z=0.55; xa.castShadow=false; xa.position.set(0,h+0.3+hR*0.62,s*(d/2+1.0)); g.add(xa);
      const xb=box(0.2,2.6,0.16,0x5a4632); xb.rotation.z=-0.55; xb.castShadow=false; xb.position.set(0,h+0.3+hR*0.62,s*(d/2+1.0)); g.add(xb);
    }
    const door=box(1.9,2.6,0.2,p.darkC); door.castShadow=false; door.position.set(0,1.6,d/2+0.06); g.add(door);
    const sh=cyl(0.6,0.6,0.14,tc,10); sh.rotation.x=Math.PI/2; sh.castShadow=false; sh.position.set(w/2-1.6,h*0.72,d/2+0.1); g.add(sh);
  }else if(age===3){ // marble on a stylobate: pilasters, team frieze, low terracotta gable
    const sty=new THREE.Mesh(new THREE.BoxGeometry(w+1.6,0.5,d+1.6),texturedMat("uniform",p.stoneC));
    sty.position.y=0.25; sty.castShadow=false; g.add(sty);
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(3)); main.position.y=h/2+0.5; main.castShadow=true; g.add(main);
    for(const px of [-w/2+1,0,w/2-1]){const pil=box(0.55,h,0.25,0xf0ead8); pil.castShadow=false; pil.position.set(px,h/2+0.5,d/2+0.08); g.add(pil);}
    const ent=new THREE.Mesh(new THREE.BoxGeometry(w+1,0.8,d+1),texturedMat("uniform",0xf0ead8));
    ent.position.y=h+0.9; ent.castShadow=false; g.add(ent);
    const frieze=box(w+1.1,0.34,d+1.1,tc); frieze.castShadow=false; frieze.position.y=h+1.35; g.add(frieze);
    gableRoof(g,w+1.2,d,h+1.55,w*0.26,p.roofC,0xe8e2d0,0.7);
    for(const s of [-1,1]){const ac=box(0.4,0.5,0.3,GOLD); ac.castShadow=false; ac.position.set(0,h+1.6+w*0.26,s*(d/2+0.55)); g.add(ac);}
    const door=box(2,2.8,0.2,p.darkC); door.castShadow=false; door.position.set(0,1.9,d/2+0.06); g.add(door);
  }else if(age===4){ // thick stone with heavy timber framing — gothic bones, wood accents
    const WOOD=0x5a4632;
    const course=new THREE.Mesh(new THREE.BoxGeometry(w+1.2,1.5,d+1.2),texturedMat("metal",p.stoneC));
    course.position.y=0.75; course.castShadow=true; g.add(course);
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(4)); main.position.y=h/2+0.4; main.castShadow=true; g.add(main);
    // exposed corner posts + a mid-wall beam: half-timbered stonework
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.45,h,0.45),texturedMat("wood",WOOD));
      post.position.set(sx*(w/2-0.05),h/2+0.4,sz*(d/2-0.05)); g.add(post);
    }
    const beam=new THREE.Mesh(new THREE.BoxGeometry(w+0.1,0.4,d+0.1),texturedMat("wood",WOOD));
    beam.castShadow=false; beam.position.y=h*0.62; g.add(beam);
    for(const sx of [-1,0,1]){ // vertical studs across the front
      const stud=box(0.28,h*0.55,0.14,WOOD); stud.castShadow=false; stud.position.set(sx*(w*0.28),h*0.34,d/2+0.05); g.add(stud);
    }
    gableRoof(g,w+0.8,d,h+0.4,Math.min(w*0.42,5.4),p.roofC,0x8d949c,0.7);
    const rBeam=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,d+1.8),texturedMat("wood",WOOD)); // ridge purlin
    rBeam.castShadow=false; rBeam.position.y=h+0.4+Math.min(w*0.42,5.4); g.add(rBeam);
    for(const s of [-1,1]){const raft=box(0.2,0.2,d+1.6,WOOD); raft.castShadow=false; raft.rotation.x=s*0.2; raft.position.set(s*(w*0.22),h+0.9,0); g.add(raft);}
    archDoor(g,0,d/2+0.06,2,2.6,WOOD); // stout oak door
    const dband=box(2.1,0.16,0.1,0x3a3a42); dband.castShadow=false; dband.position.set(0,1.7,d/2+0.14); g.add(dband); // iron strap
    for(const s of [-1,1]){const sl=box(0.26,1.1,0.12,p.darkC); sl.castShadow=false; sl.position.set(s*(w/2-1.6),h*0.75,d/2+0.07); g.add(sl);}
    for(const s of [-1,1]){const but=box(0.8,h*0.85,1.2,0x7d858f); but.rotation.x=-0.14; but.position.set(s*(w/2-0.7),h*0.42,d/2+0.6); g.add(but);}
    const ban=box(1.2,1.8,0.09,tc); ban.castShadow=false; ban.position.set(w/2-2.9,h*0.66,d/2+0.16); g.add(ban);
  }else{ // Enlightenment: white block, quoins, cornice, balustrade, copper roof, sash rows
    const main=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),aWall(5)); main.position.y=h/2; main.castShadow=true; g.add(main);
    for(const s of [-1,1]){const q=box(0.5,h,0.5,0xe3dccb); q.castShadow=false; q.position.set(s*(w/2-0.1),h/2,d/2-0.1); g.add(q);}
    const cor=box(w+1,0.55,d+1,0xffffff); cor.castShadow=false; cor.position.y=h+0.27; g.add(cor);
    balustrade(g,w-1,h+0.55,d/2+0.1,0xffffff);
    const roof=box(w*0.86,0.8,d*0.86,AGEPAL[5].roofC); roof.castShadow=false; roof.position.y=h+0.95; g.add(roof);
    winGrid(g,Math.max(2,Math.round(w/4.2)),1,h*0.62,0,d/2+0.07,AGEPAL[5].darkC,0xffffff);
    const door=box(1.8,2.7,0.2,AGEPAL[5].darkC); door.castShadow=false; door.position.set(0,1.45,d/2+0.06); g.add(door);
    const fan=cyl(1.05,1.05,0.14,0xffffff,10); fan.rotation.x=Math.PI/2; fan.castShadow=false; fan.position.set(0,2.85,d/2+0.05); g.add(fan);
    flagPole(g,w/2-1.2,h+0.9,0,2.8,tc,1.3,0.7);
  }
}

// ---------- the building meshes themselves ----------
function buildingMesh(type,team,age){
  const g=new THREE.Group(); const tc=TEAMCOL[team];
  if(age===undefined)age=teamAge[team]||0;
  age=Math.max((BLD[type]&&BLD[type].age)||0,Math.min(5,age|0));
  g.userData.age=age;
  const P=AGEPAL[age];
  if(type==="towncenter"){
    if(age===0){ // the great mammoth-bone lodge (Mezhirich): hide over a bone frame
      ribbedDome(g,8,6.2,6.5,P.wallC,7,[1.6,3.8]);
      for(const s of [-1,1]){const t=tuskArc(2.6); t.rotation.z=s*0.55; t.position.set(s*2.1,0.4,6.35); g.add(t);}
      const jamb1=cyl(0.3,0.34,3.4,BONE,6); jamb1.castShadow=false; jamb1.position.set(-1.7,1.7,6.2); g.add(jamb1);
      const jamb2=cyl(0.3,0.34,3.4,BONE,6); jamb2.castShadow=false; jamb2.position.set(1.7,1.7,6.2); g.add(jamb2);
      const lintel=cyl(0.28,0.28,3.9,IVORY,6); lintel.rotation.z=Math.PI/2; lintel.castShadow=false; lintel.position.set(0,3.5,6.2); g.add(lintel);
      const flap=box(2.6,3,0.18,tc); flap.castShadow=false; flap.rotation.x=-0.12; flap.position.set(0,1.6,6.3); g.add(flap);
      const band=box(4.4,1,0.16,tc); band.castShadow=false; band.rotation.x=-0.34; band.position.set(0,5,4.7); g.add(band);
      const totem=cyl(0.22,0.28,6.5,0x6b4a2b,6); totem.position.set(6.4,3.25,4.6); g.add(totem);
      const skull=box(1.2,1,1.1,BONE); skull.castShadow=false; skull.position.set(6.4,6.9,4.6); g.add(skull);
      for(const s of [-1,1]){const t=tuskArc(0.9); t.rotation.z=s*0.6; t.position.set(6.4+s*0.7,7.3,4.6); g.add(t);}
      firePit(g,-6,5.2);
      flagPole(g,0,6.1,0,7,tc,2.4,1.2);
    }else if(age===1){ // pylon hall: Karnak with a parade ground
      const hall=new THREE.Mesh(new THREE.BoxGeometry(15,5.6,10),aWall(1)); hall.position.set(0,3.2,-3); hall.castShadow=true; g.add(hall);
      const hallTrim=box(15.6,0.5,10.6,P.stoneC); hallTrim.castShadow=false; hallTrim.position.set(0,6.2,-3); g.add(hallTrim);
      for(const s of [-1,1]){
        const py=frustum4(6.2,4.9,9,aWall(1,0xd4bd8e)); py.position.set(s*5.7,4.5,3.2); g.add(py);
        const cav=frustum4(5.2,6,0.9,texturedMat("cloth",P.stoneC)); cav.castShadow=false; cav.position.set(s*5.7,9.4,3.2); g.add(cav);
        const gband=box(5.4,0.24,5.4,GOLD); gband.castShadow=false; gband.position.set(s*5.7,9.95,3.2); g.add(gband);
        const mast=cyl(0.12,0.14,11.5,0x8a6a3f,5); mast.castShadow=false; mast.position.set(s*4.4,5.75,5.9); g.add(mast);
        const pen=box(1,2.6,0.08,tc); pen.castShadow=false; pen.position.set(s*4.4,10.2,5.95); g.add(pen);
      }
      const lint=new THREE.Mesh(new THREE.BoxGeometry(5,2,4.4),aWall(1,0xd4bd8e)); lint.position.set(0,8.1,3.2); lint.castShadow=true; g.add(lint);
      const disc=cyl(0.9,0.9,0.16,GOLD,10); disc.rotation.x=Math.PI/2; disc.castShadow=false; disc.position.set(0,8.2,5.5); g.add(disc);
      const gate=box(3.2,5.4,0.3,P.darkC); gate.castShadow=false; gate.position.set(0,2.7,5.35); g.add(gate);
      horns(g,0,7.05,-3+5.3);
      flagPole(g,0,6.4,-3,5.4,tc,2.2,1.1);
    }else if(age===2){ // the great longhouse — wide hall, ridge along X, door to the south
      const foot=new THREE.Mesh(new THREE.BoxGeometry(15.6,0.9,9.6),texturedMat("metal",P.stoneC)); foot.position.y=0.45; foot.castShadow=true; g.add(foot);
      const hall=new THREE.Mesh(new THREE.BoxGeometry(15,5,9),texturedMat("wood",0x8a6f4a)); hall.position.y=2.8; hall.castShadow=true; g.add(hall);
      const rg=new THREE.Group(); gableRoof(rg,9,15.6,5.3,4.6,THATCH,0x7a5f42,1.0); rg.rotation.y=Math.PI/2; g.add(rg);
      for(const s of [-1,1]){ // carved gable boards + antlers at the ridge ends
        const xa=box(0.24,3,0.2,0x5a4632); xa.rotation.z=0.5; xa.castShadow=false; xa.position.set(s*7.5,8.4,0); g.add(xa);
        const xb=box(0.24,3,0.2,0x5a4632); xb.rotation.z=-0.5; xb.castShadow=false; xb.position.set(s*7.5,8.4,0); g.add(xb);
        const ant=tuskArc(0.8); ant.rotation.y=Math.PI/2; ant.position.set(s*7.5,10,0); g.add(ant);
      }
      for(let i=0;i<3;i++){const sh=cyl(0.62,0.62,0.14,i===1?tc:0xdcdcdc,10); sh.rotation.x=Math.PI/2;
        sh.castShadow=false; sh.position.set(-4+i*4,3.4,4.6); g.add(sh);}
      const door=box(2.4,3,0.2,P.darkC); door.castShadow=false; door.position.set(0,1.9,4.56); g.add(door);
      const post1=cyl(0.3,0.34,4.2,0x6b4a2b,6); post1.position.set(-2,2.1,4.9); g.add(post1);
      const post2=cyl(0.3,0.34,4.2,0x6b4a2b,6); post2.position.set(2,2.1,4.9); g.add(post2);
      flagPole(g,0,9.9,0,3.6,tc,2.2,1.1);
    }else if(age===3){ // the peripteral hall: marble, colonnade, gold acroteria
      for(const [sw,sh2,sy] of [[16,12,0.25],[14.6,10.6,0.75]]){
        const st=new THREE.Mesh(new THREE.BoxGeometry(sw,0.5,sh2),texturedMat("uniform",P.stoneC));
        st.position.y=sy; st.castShadow=false; g.add(st);
      }
      const cella=new THREE.Mesh(new THREE.BoxGeometry(10,6.2,7),aWall(3)); cella.position.y=4.1; cella.castShadow=true; g.add(cella);
      for(let i=0;i<6;i++){const x=-6+i*2.4; colAt(g,x,4.6,6.2,0.58,3); colAt(g,x,-4.6,6.2,0.58,3);}
      for(const z of [-1.6,1.6]){colAt(g,-6.4,z,6.2,0.58,3); colAt(g,6.4,z,6.2,0.58,3);}
      const ent=new THREE.Mesh(new THREE.BoxGeometry(14.6,1.1,10.6),texturedMat("uniform",0xf0ead8));
      ent.position.y=7.6; ent.castShadow=false; g.add(ent);
      const frieze=box(14.8,0.4,10.8,tc); frieze.castShadow=false; frieze.position.y=8.3; g.add(frieze);
      gableRoof(g,14.6,9.4,8.5,2.5,P.roofC,0xe8e2d0,0.8);
      for(const s of [-1,1]){const ac=box(0.55,0.7,0.4,GOLD); ac.castShadow=false; ac.position.set(0,11.2,s*5.3); g.add(ac);}
      brazier(g,-3.8,6.8); brazier(g,3.8,6.8);
      flagPole(g,0,11,0,3.4,tc,2.2,1.1);
    }else if(age===4){ // Romanesque great hall with twin turrets and heavy timber framing
      const WOOD=0x5a4632;
      const course=new THREE.Mesh(new THREE.BoxGeometry(16.8,1.6,9.8),texturedMat("metal",P.stoneC)); course.position.y=0.8; course.castShadow=true; g.add(course);
      const hall=new THREE.Mesh(new THREE.BoxGeometry(16,7,9),aWall(4)); hall.position.y=3.9; hall.castShadow=true; g.add(hall);
      for(const sx of [-1,1])for(const sz of [-1,1]){ // timber corner posts
        const post=new THREE.Mesh(new THREE.BoxGeometry(0.5,7,0.5),texturedMat("wood",WOOD));
        post.position.set(sx*7.95,3.9,sz*4.45); g.add(post);
      }
      const beam=new THREE.Mesh(new THREE.BoxGeometry(16.2,0.5,9.2),texturedMat("wood",WOOD)); beam.castShadow=false; beam.position.y=5.4; g.add(beam);
      for(const sx of [-2,-1,1,2]){const stud=box(0.34,3.4,0.16,WOOD); stud.castShadow=false; stud.position.set(sx*2.9,2.6,4.55); g.add(stud);}
      const rg=new THREE.Group(); gableRoof(rg,10,16.6,7.4,4.4,P.roofC,0x8d949c,0.8); rg.rotation.y=Math.PI/2; g.add(rg);
      const purlin=new THREE.Mesh(new THREE.BoxGeometry(16.8,0.34,0.34),texturedMat("wood",WOOD)); purlin.castShadow=false; purlin.position.y=11.8; g.add(purlin);
      for(let i=-1;i<=1;i++)archDoor(g,i*4.2,4.56,2.2,3,WOOD);
      for(const s of [-1,1]){const sl=box(0.28,1.3,0.12,P.darkC); sl.castShadow=false; sl.position.set(s*6.6,5.9,4.57); g.add(sl);}
      for(const s of [-1,1]){
        const tw=cyl(1.3,1.5,9.5,0x7d858f,8); tw.position.set(s*7.4,4.75,4.2); g.add(tw);
        const hoard=box(3,1.2,3,WOOD); hoard.castShadow=false; hoard.position.set(s*7.4,9.6,4.2); g.add(hoard); // timber hoarding
        const cap=cone(1.9,2.6,P.roofC,8); cap.position.set(s*7.4,11.5,4.2); g.add(cap);
        const fin=cyl(0.09,0.09,1,GOLD,4); fin.castShadow=false; fin.position.set(s*7.4,13.2,4.2); g.add(fin);
      }
      const ban=box(1.6,2.4,0.1,tc); ban.castShadow=false; ban.position.set(0,6,4.66); g.add(ban);
      flagPole(g,0,11.8,0,3,tc,2,1);
    }else{ // the Executive Mansion: portico, wings, balustrade, cupola
      const main=new THREE.Mesh(new THREE.BoxGeometry(11,7,8.5),aWall(5)); main.position.y=3.5; main.castShadow=true; g.add(main);
      for(const s of [-1,1]){
        const wing=new THREE.Mesh(new THREE.BoxGeometry(4.8,5.4,7),aWall(5)); wing.position.set(s*7.2,2.7,0); wing.castShadow=true; g.add(wing);
        const wcor=box(5.4,0.5,7.6,0xffffff); wcor.castShadow=false; wcor.position.set(s*7.2,5.6,0); g.add(wcor);
        const wg=new THREE.Group(); wg.position.x=s*7.2; g.add(wg); // wing-local rail + windows
        balustrade(wg,4.2,5.85,3.6,0xffffff);
        winGrid(wg,2,1,3.1,0,3.57,P.darkC,0xffffff);
      }
      const cor=box(12,0.6,9.4,0xffffff); cor.castShadow=false; cor.position.y=7.3; g.add(cor);
      balustrade(g,10.4,7.6,4.4,0xffffff);
      const roof=box(9.6,0.9,7.4,P.roofC); roof.castShadow=false; roof.position.y=8.15; g.add(roof);
      for(let i=0;i<4;i++)colAt(g,-3+i*2,5.5,6,0.5,5);
      const pent=box(7.6,0.8,2.4,0xffffff); pent.castShadow=false; pent.position.set(0,6.8,5.6); g.add(pent);
      const ped=pedTri(7.6,1.9,0xffffff); ped.position.set(0,8.1,5.6); g.add(ped);
      winGrid(g,4,2,2.4,2.6,4.32,P.darkC,0xffffff);
      const door=box(1.9,2.8,0.2,P.darkC); door.castShadow=false; door.position.set(0,1.5,4.31); g.add(door);
      const drum=cyl(1.4,1.4,1.3,0xf2ede2,10); drum.castShadow=false; drum.position.y=9.2; g.add(drum);
      const dome=bDome(1.5,"uniform",0x5f7a6a); dome.position.y=9.85; g.add(dome);
      flagPole(g,0,10.6,0,3.6,tc,2.2,1.1);
    }
  }else if(type==="house"){
    if(age===0){ // hide dome hut
      ribbedDome(g,3.5,3,3.5,P.wallC,6,[1,2]);
      for(const s of [-1,1]){const t=tuskArc(1.1); t.rotation.z=s*0.5; t.position.set(s*1.1,0.2,3.3); g.add(t);}
      const flap=box(1.5,1.8,0.14,tc); flap.castShadow=false; flap.rotation.x=-0.15; flap.position.set(0,0.95,3.25); g.add(flap);
      const smoke=cyl(0.55,0.55,0.3,0x3a2e1e,7); smoke.castShadow=false; smoke.position.y=3; g.add(smoke);
    }else if(age===1){ // flat-roofed mudbrick, viga ends, team awning
      const main=new THREE.Mesh(new THREE.BoxGeometry(6.6,3.6,6.6),aWall(1)); main.position.y=1.8; main.castShadow=true; g.add(main);
      for(const s of [-1,1]){const par=box(6.9,0.5,0.4,P.stoneC); par.castShadow=false; par.position.set(0,3.9,s*3.25); g.add(par);}
      for(let i=0;i<3;i++){const viga=cyl(0.14,0.14,0.8,0x8a6a3f,5); viga.rotation.x=Math.PI/2; viga.castShadow=false;
        viga.position.set(-1.6+i*1.6,3.3,3.5); g.add(viga);}
      const door=box(1.5,2.2,0.16,P.darkC); door.castShadow=false; door.position.set(-1.2,1.2,3.35); g.add(door);
      const awn=box(2.2,0.12,1.1,tc); awn.castShadow=false; awn.rotation.x=0.25; awn.position.set(-1.2,2.6,3.8); g.add(awn);
      const win=box(0.9,0.9,0.14,P.darkC); win.castShadow=false; win.position.set(1.6,2.2,3.34); g.add(win);
    }else if(age===2){ // the roundhouse
      const wall=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.35,2.4,10),aWall(2)); wall.position.y=1.2; wall.castShadow=true; g.add(wall);
      const thatch=cone(4.7,3.8,THATCH,10); thatch.position.y=4.2; g.add(thatch);
      const fin=cyl(0.16,0.16,1.1,0x6b4a2b,5); fin.castShadow=false; fin.position.y=6.3; g.add(fin);
      for(const s of [-1,1]){const pp=cyl(0.14,0.16,2.2,0x6b4a2b,5); pp.castShadow=false; pp.position.set(s*1,1.1,3.6); g.add(pp);}
      const porch=box(2.6,0.16,1.6,THATCH); porch.castShadow=false; porch.rotation.x=0.3; porch.position.set(0,2.5,3.7); g.add(porch);
      const door=box(1.4,1.9,0.16,P.darkC); door.castShadow=false; door.position.set(0,1,3.2); g.add(door);
      const sh=cyl(0.5,0.5,0.12,tc,9); sh.rotation.x=Math.PI/2; sh.castShadow=false; sh.position.set(1.8,1.6,2.75); sh.rotation.y=-0.5; g.add(sh);
    }else if(age===3){ // a modest domus
      const main=new THREE.Mesh(new THREE.BoxGeometry(6.4,3.6,6),aWall(3)); main.position.y=1.8; main.castShadow=true; g.add(main);
      gableRoof(g,6.8,6,3.6,1.8,P.roofC,0xe8e2d0,0.6);
      for(const s of [-1,1]){const pil=box(0.45,3.4,0.2,0xf0ead8); pil.castShadow=false; pil.position.set(s*2.4,1.8,3.06); g.add(pil);}
      const door=box(1.5,2.4,0.16,P.darkC); door.castShadow=false; door.position.set(0,1.3,3.05); g.add(door);
      const cur=box(1.7,0.5,0.1,tc); cur.castShadow=false; cur.position.set(0,2.75,3.1); g.add(cur);
      const win=box(0.9,0.9,0.12,P.darkC); win.castShadow=false; win.position.set(-2.3+4.6,2.3,3.05); g.add(win);
    }else if(age===4){ // half-timbered stone cottage
      const WOOD=0x5a4632;
      const main=new THREE.Mesh(new THREE.BoxGeometry(6.2,3.8,6),aWall(4)); main.position.y=1.9; main.castShadow=true; g.add(main);
      gableRoof(g,6.6,6,3.8,2.9,P.roofC,0x8d949c,0.7);
      for(const sx of [-1,1]){const post=box(0.34,3.8,0.34,WOOD); post.position.set(sx*2.95,1.9,2.95); g.add(post);}
      const beam=box(6.2,0.32,0.2,WOOD); beam.castShadow=false; beam.position.set(0,2.7,3.02); g.add(beam);
      const brace=box(0.24,2,0.14,WOOD); brace.castShadow=false; brace.rotation.z=0.5; brace.position.set(-1.9,1.5,3.03); g.add(brace);
      const brace2=box(0.24,2,0.14,WOOD); brace2.castShadow=false; brace2.rotation.z=-0.5; brace2.position.set(1.9,1.5,3.03); g.add(brace2);
      const chim=box(0.9,2.6,0.9,0x7d858f); chim.position.set(2,5.4,-1.4); g.add(chim);
      const cap=box(1.2,0.3,1.2,0x5a616b); cap.castShadow=false; cap.position.set(2,6.85,-1.4); g.add(cap);
      archDoor(g,-1.4,3.06,1.4,2.1,WOOD);
      for(const wx of [1.4]){const win=box(0.8,0.9,0.12,P.darkC); win.castShadow=false; win.position.set(wx,2.2,3.05); g.add(win);
        const sill=box(1,0.12,0.18,0x99a1ab); sill.castShadow=false; sill.position.set(wx,1.7,3.08); g.add(sill);}
      const ban=box(0.9,1.3,0.08,tc); ban.castShadow=false; ban.position.set(2.4,2.4,3.09); g.add(ban);
    }else{ // Georgian townhouse
      const main=new THREE.Mesh(new THREE.BoxGeometry(6.6,5,6),aWall(5)); main.position.y=2.5; main.castShadow=true; g.add(main);
      const cor=box(7.2,0.4,6.6,0xffffff); cor.castShadow=false; cor.position.y=5.2; g.add(cor);
      const roof=box(5.8,0.7,5.2,P.roofC); roof.castShadow=false; roof.position.y=5.75; g.add(roof);
      winGrid(g,2,2,1.9,2.1,3.07,P.darkC,0xffffff);
      const door=box(1.4,2.3,0.16,P.darkC); door.castShadow=false; door.position.set(0,1.2,3.06); g.add(door);
      const fan=cyl(0.8,0.8,0.12,0xffffff,10); fan.rotation.x=Math.PI/2; fan.castShadow=false; fan.position.set(0,2.4,3.05); g.add(fan);
      for(const s of [-1,1]){const mc=cyl(0.14,0.16,2.2,0xf2ede2,6); mc.castShadow=false; mc.position.set(s*1,1.15,3.25); g.add(mc);}
      flagPole(g,2.6,5.4,0,2,tc,1.1,0.6);
    }
  }else if(type==="barracks"){
    agedShell(g,age,tc,12.8,5.6,10);
    for(const wx of [-4.4,4.4]){ // round shields hung on the front wall
      const sh=cyl(1.1,1.1,0.16,wx<0?tc:0xdcdcdc,10); sh.rotation.x=Math.PI/2; sh.castShadow=false;
      sh.position.set(wx,3.8,5.15); g.add(sh);
      const boss=box(0.4,0.4,0.12,GOLD); boss.castShadow=false; boss.position.set(wx,3.8,5.28); g.add(boss);
    }
    const rackA=box(0.3,2.6,0.3,0x6b4a2b); rackA.position.set(-7.2,1.3,2.8); g.add(rackA);
    const rackB=box(0.3,2.6,0.3,0x6b4a2b); rackB.position.set(-7.2,1.3,-2.8); g.add(rackB);
    const rackBar=box(0.26,0.26,6,0x6b4a2b); rackBar.castShadow=false; rackBar.position.set(-7.2,2.6,0); g.add(rackBar);
    for(let i=0;i<3;i++){ // spears leaning in the rack
      const sp=cyl(0.09,0.09,5.2,0x8a6a3f,5); sp.rotation.x=0.18; sp.castShadow=false; sp.position.set(-7.24,2.3,-1.8+i*1.8); g.add(sp);
      const st=cone(0.17,0.6,0xdcdcdc,4); st.rotation.x=0.18; st.castShadow=false; st.position.set(-7.24,5.15,-1.28+i*1.8); g.add(st); // seated on the LEANED tip: tip = base + R(0.18)·(0,2.9,0)
    }
  }else if(type==="blacksmith"){ // v87: the forge — quest XP becomes steel here
    const slab=box(10.5,0.7,9,P.stoneC); slab.position.y=0.35; slab.castShadow=false; g.add(slab);
    const hall=new THREE.Mesh(new THREE.BoxGeometry(7.6,3.6,6.4),texturedMat("wood",0x7a5f42));
    hall.position.set(-1,2.5,0); hall.castShadow=true; g.add(hall);
    const rg=new THREE.Group(); gableRoof(rg,6.8,8.4,4.3,2.6,0x4e4640,0x3a342e,1.0);
    rg.rotation.y=Math.PI/2; rg.position.x=-1; g.add(rg);
    const chim=new THREE.Mesh(new THREE.BoxGeometry(1.3,5.4,1.3),texturedMat("metal",P.stoneC));
    chim.position.set(-3.2,3.4,-1.6); chim.castShadow=true; g.add(chim);
    const chimCap=box(1.7,0.3,1.7,0x3a342e); chimCap.castShadow=false; chimCap.position.set(-3.2,6.2,-1.6); g.add(chimCap);
    // the open work-porch: two posts, the anvil, the quench barrel, the glowing hearth mouth
    for(const pz of [-2.6,2.6]){const post=cyl(0.2,0.24,3.2,0x5a4632,6); post.position.set(3.6,1.6,pz); g.add(post);}
    const porch=box(3.4,0.2,6.6,0x4e4640); porch.castShadow=false; porch.position.set(3.3,3.3,0); porch.rotation.z=0.12; g.add(porch);
    const anvBase=cyl(0.55,0.7,0.9,0x6b4a2b,7); anvBase.castShadow=false; anvBase.position.set(3.1,1.15,0.9); g.add(anvBase);
    const anvil=box(1.5,0.5,0.55,0x4a4e55); anvil.position.set(3.1,1.85,0.9); g.add(anvil);
    const horn=cone(0.24,0.7,0x4a4e55,5); horn.rotation.z=-Math.PI/2; horn.castShadow=false; horn.position.set(4.1,1.85,0.9); g.add(horn);
    const barrel=cyl(0.6,0.68,1.1,0x6b4a2b,9); barrel.castShadow=false; barrel.position.set(3.2,1.25,-1.7); g.add(barrel);
    const hearth=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.1),
      new THREE.MeshBasicMaterial({color:0xff7a2f})); // the fire never sleeps
    hearth.position.set(-1,1.6,3.22); hearth.castShadow=false; g.add(hearth);
    const hammer=box(0.16,1,0.16,0x8a6a3f); hammer.castShadow=false; hammer.rotation.z=0.9; hammer.position.set(2.5,2.2,0.9); g.add(hammer);
    const hhead=box(0.5,0.3,0.3,0x4a4e55); hhead.castShadow=false; hhead.position.set(2.15,2.55,0.9); g.add(hhead);
    flagPole(g,-4.4,0.7,3.6,4.6,tc,1.8,1);
  }else if(type==="farm"){
    const plot=box(18.8,0.34,18.8,0x6b4a2b); plot.position.y=0.17; plot.castShadow=false; g.add(plot);
    for(let i=0;i<5;i++){const row=box(17.2,0.3,1.8,0x7fae54); row.castShadow=false; row.position.set(0,0.42,-6.8+i*3.4); g.add(row);}
    flagPole(g,8.4,0.3,8.4,3,tc,1.4,0.8);
    if(age===0){ // bone fence posts and a hide-drying rack
      for(let i=0;i<3;i++){const bp=cyl(0.14,0.18,1.6,BONE,5); bp.castShadow=false; bp.position.set(-8.6,1.1,-5+i*5); g.add(bp);}
      for(const px of [-4,-1]){const rp=cyl(0.12,0.14,2.4,0x8a6a3f,5); rp.castShadow=false; rp.position.set(px,1.4,-8.4); g.add(rp);}
      const rb=box(3.6,0.14,0.14,0x8a6a3f); rb.castShadow=false; rb.position.set(-2.5,2.5,-8.4); g.add(rb);
      const pelt=box(2.6,1.5,0.1,0xa8906b); pelt.castShadow=false; pelt.position.set(-2.5,1.8,-8.4); g.add(pelt);
    }else if(age===1){ // a shaduf draws the water
      const sp=cyl(0.16,0.2,3,0x8a6a3f,5); sp.castShadow=false; sp.position.set(-8,1.7,-7.6); g.add(sp);
      const beam=box(5,0.2,0.2,0x6b4a2b); beam.rotation.z=0.45; beam.castShadow=false; beam.position.set(-7,3.4,-7.6); g.add(beam);
      const cw=box(0.8,0.8,0.8,0x9a8a76); cw.castShadow=false; cw.position.set(-9.2,2.5,-7.6); g.add(cw);
      const rope=cyl(0.05,0.05,1.8,0x9a8a6a,4); rope.castShadow=false; rope.position.set(-4.8,3.4,-7.6); g.add(rope);
      const buck=box(0.7,0.5,0.7,0x8a6a3f); buck.castShadow=false; buck.position.set(-4.8,2.4,-7.6); g.add(buck);
      for(const s of [-1,1]){const mud=box(0.6,0.7,17,P.stoneC); mud.castShadow=false; mud.position.set(s*9.2,0.35,0); g.add(mud);}
    }else if(age===2){ // wattle fence + scarecrow
      for(let i=0;i<4;i++){const fp=cyl(0.11,0.13,1.5,0x6b4a2b,5); fp.castShadow=false; fp.position.set(-8.6,1,-6+i*4); g.add(fp);}
      for(const fy of [0.9,1.5]){const fr=box(0.14,0.14,12.6,0x8a6a3f); fr.castShadow=false; fr.position.set(-8.6,fy,0); g.add(fr);}
      const scare=box(1.2,1.6,0.5,0xc9a86a); scare.castShadow=false; scare.position.set(-7.2,2.2,-7.2); g.add(scare);
      const arms=box(2.8,0.3,0.3,0x8a6a3f); arms.castShadow=false; arms.position.set(-7.2,2.5,-7.2); g.add(arms);
    }else if(age===3){ // low marble boundary + amphora
      for(const [bx,bz,bw,bd] of [[-9.2,0,0.6,17],[0,-9.2,17,0.6]]){
        const wallb=box(bw,0.8,bd,0xe8e2d0); wallb.castShadow=false; wallb.position.set(bx,0.4,bz); g.add(wallb);}
      const amp=cyl(0.55,0.35,1.4,0xb8603a,8); amp.castShadow=false; amp.position.set(-8,1,-8); g.add(amp);
      const ampn=cyl(0.22,0.35,0.5,0xb8603a,8); ampn.castShadow=false; ampn.position.set(-8,1.95,-8); g.add(ampn);
    }else if(age===4){ // timber rails + scarecrow
      for(let i=0;i<3;i++){const fp=cyl(0.13,0.15,1.7,0x6b4a2b,5); fp.castShadow=false; fp.position.set(-8.8,1.1,-6+i*6); g.add(fp);}
      for(const fy of [1,1.6]){const fr=box(0.16,0.16,13,0x8a6a3f); fr.castShadow=false; fr.position.set(-8.8,fy,0); g.add(fr);}
      const scare=box(1.2,1.6,0.5,0xc9a86a); scare.castShadow=false; scare.position.set(-7.2,2.2,-7.2); g.add(scare);
      const arms=box(2.8,0.3,0.3,0x8a6a3f); arms.castShadow=false; arms.position.set(-7.2,2.5,-7.2); g.add(arms);
    }else{ // white picket + haystack
      for(let i=0;i<6;i++){const pk=box(0.2,1.1,0.14,0xffffff); pk.castShadow=false; pk.position.set(-8.8,0.85,-7.5+i*3); g.add(pk);}
      const pr=box(0.14,0.16,16,0xffffff); pr.castShadow=false; pr.position.set(-8.8,1.15,0); g.add(pr);
      const hay=cone(1.5,1.8,0xcbb060,8); hay.castShadow=false; hay.position.set(-7,0.9,-7.4); g.add(hay);
    }
  }else if(type==="storage_pit"){
    const base=new THREE.Mesh(new THREE.BoxGeometry(12,0.8,12),texturedMat("wood",0x8a6a4a));
    base.position.y=0.4; base.castShadow=true; g.add(base);
    for(let i=0;i<3;i++){const crate=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.9,1.9),texturedMat("wood",0xb08a5a));
      crate.position.set(2.4+(i%2)*1.6,1.75+(i>1?1.9:0),2.6-(i%2)*2); crate.rotation.y=i*0.8; g.add(crate);}
    const sack=box(1.7,1.3,1.7,0xc9a86a); sack.castShadow=false; sack.position.set(4.2,1.4,-2.6); sack.rotation.y=0.5; g.add(sack);
    const grain=cone(0.8,0.8,0xe0c988,7); grain.castShadow=false; grain.position.set(4.2,2.4,-2.6); g.add(grain);
    flagPole(g,5.2,0.8,5.2,5.4,tc,2,1.2);
    if(age===0){ // hide-covered cache with a bone frame
      const sub=new THREE.Group(); sub.position.set(-2.4,0.8,-1.6); g.add(sub);
      ribbedDome(sub,2.7,1.9,2.7,P.wallC,5,[0.7]);
      for(const s of [-1,1]){const t=tuskArc(0.9); t.rotation.z=s*0.5; t.position.set(s*1,0.1,2.6); sub.add(t);}
      const pelt=box(2,1.2,0.1,tc); pelt.castShadow=false; pelt.rotation.x=-0.2; pelt.position.set(0,1.2,2.2); sub.add(pelt);
    }else if(age===1){ // beehive granaries
      for(const [gx,gz] of [[-2.8,-1.6],[0.6,-3.2]]){
        const gr=cone(2,3.8,0xd4bd8e,9); gr.position.set(gx,2.7,gz); g.add(gr);
        const hatch=box(0.8,0.9,0.16,P.darkC); hatch.castShadow=false; hatch.position.set(gx,1.5,gz+1.65); g.add(hatch);
      }
      const ramp=box(2.2,0.2,1.2,0xc9b088); ramp.rotation.x=0.3; ramp.castShadow=false; ramp.position.set(0.6,1,-1.4); g.add(ramp);
    }else if(age===2){ // a raised granary on staddle posts
      const sub=new THREE.Group(); sub.position.set(-2.4,0,-1.8);
      for(const [px,pz] of [[-1.5,-1.2],[1.5,-1.2],[-1.5,1.2],[1.5,1.2]]){
        const pp=cyl(0.16,0.2,1.7,0x6b4a2b,5); pp.castShadow=false; pp.position.set(px,1.65,pz); sub.add(pp);}
      const cab=new THREE.Mesh(new THREE.BoxGeometry(3.6,2.2,2.8),texturedMat("wood",0x8a6f4a)); cab.position.y=3.6; cab.castShadow=true; sub.add(cab);
      gableRoof(sub,4.2,2.8,4.7,1.8,THATCH,0x7a5f42,0.5);
      const lad=box(0.6,2.6,0.1,0x8a6a3f); lad.castShadow=false; lad.rotation.x=0.3; lad.position.set(0,1.6,1.9); sub.add(lad);
      g.add(sub);
    }else if(age===3){ // amphora rows and a marble bench
      for(let i=0;i<3;i++){
        const amp=cyl(0.6,0.4,1.6,0xb8603a,8); amp.castShadow=false; amp.position.set(-3.4+i*1.5,1.6,-2.4); g.add(amp);
        const nn=cyl(0.24,0.4,0.5,0xb8603a,8); nn.castShadow=false; nn.position.set(-3.4+i*1.5,2.65,-2.4); g.add(nn);
      }
      const bench=box(3.4,0.4,1.1,0xe8e2d0); bench.castShadow=false; bench.position.set(-2.4,1.15,0.8); g.add(bench);
      for(const s of [-1,1]){const bl=box(0.5,0.55,1,0xd9d0b8); bl.castShadow=false; bl.position.set(-2.4+s*1.3,0.85,0.8); g.add(bl);}
    }else if(age===4){ // stone undercroft, barrels under a team tarp
      const uc=new THREE.Mesh(new THREE.BoxGeometry(4.6,2.6,3.6),aWall(4)); uc.position.set(-2.6,2.1,-1.6); uc.castShadow=true; g.add(uc);
      const slab=box(5.2,0.4,4.2,0x4a4e56); slab.castShadow=false; slab.position.set(-2.6,3.6,-1.6); g.add(slab);
      for(const [bx,bz] of [[-4.2,1.6],[-2.8,2.2]]){
        const barrel=cyl(0.8,0.65,1.8,0x7a5a34,8); barrel.position.set(bx,1.7,bz); g.add(barrel);
        const hoop=cyl(0.82,0.82,0.14,0x4a4e56,8); hoop.castShadow=false; hoop.position.set(bx,2.1,bz); g.add(hoop);
      }
      const tarp=box(4,0.2,2.6,tc); tarp.rotation.z=0.08; tarp.castShadow=false; tarp.position.set(-2.6,4,-1.6); g.add(tarp);
    }else{ // a tidy white warehouse
      const wh=new THREE.Mesh(new THREE.BoxGeometry(5,3.2,3.8),aWall(5)); wh.position.set(-2.6,2.4,-1.6); wh.castShadow=true; g.add(wh);
      const roof=box(5.5,0.5,4.3,P.roofC); roof.castShadow=false; roof.position.set(-2.6,4.2,-1.6); g.add(roof);
      const door=box(1.6,2,0.16,P.darkC); door.castShadow=false; door.position.set(-2.6,1.8,0.35); g.add(door);
      const win=box(0.8,0.8,0.12,P.darkC); win.castShadow=false; win.position.set(-4.4,3,0.34); g.add(win);
    }
  }else if(type==="archery_range"){
    agedShell(g,age,tc,11.2,5.2,8.8);
    const target=cyl(1.7,1.7,0.3,0xe8e2d0,12); target.rotation.x=Math.PI/2; target.castShadow=false; target.position.set(0,3.8,4.6); g.add(target);
    const ring=cyl(1.2,1.2,0.34,0x27406e,12); ring.rotation.x=Math.PI/2; ring.castShadow=false; ring.position.set(0,3.8,4.61); g.add(ring);
    const bull=cyl(0.66,0.66,0.38,0xc23a3a,12); bull.rotation.x=Math.PI/2; bull.castShadow=false; bull.position.set(0,3.8,4.62); g.add(bull);
    for(const [ax,ay] of [[-0.3,4.2],[0.4,3.6],[0.1,3.9]]){ // arrows stuck in the target
      const ar=cyl(0.06,0.06,1.3,0x8a6a3f,4); ar.rotation.x=Math.PI/2-0.15; ar.castShadow=false; ar.position.set(ax,ay,5.3); g.add(ar);
      const fl=box(0.18,0.18,0.26,0xe8e2d0); fl.castShadow=false; fl.position.set(ax,ay+0.1,5.95); g.add(fl);
    }
    const hay=new THREE.Mesh(new THREE.BoxGeometry(2.6,2,1.8),texturedMat("cloth",0xcbb060));
    hay.position.set(-4.4,1,5); hay.rotation.y=0.3; g.add(hay);
    const barrel=cyl(0.9,0.75,2,0x7a5a34,8); barrel.position.set(4.8,1,4.8); g.add(barrel);
    for(let i=0;i<3;i++){const qa=cyl(0.07,0.07,2.4,0x8a6a3f,4); qa.rotation.z=0.25-i*0.25; qa.castShadow=false;
      qa.position.set(4.6+i*0.24,2.5,4.8); g.add(qa);}
  }else if(type==="stable"){
    agedShell(g,age,tc,12.4,5.2,9.6);
    const hh=box(1,0.9,1.3,0x7a4c26); hh.castShadow=false; hh.position.set(3.2,4.4,5); g.add(hh); // the resident
    const hn=box(0.8,1.6,0.8,0x8a5a30); hn.castShadow=false; hn.position.set(3.2,3.5,4.7); hn.rotation.x=0.4; g.add(hn);
    for(let i=0;i<3;i++){ // paddock fence out front
      const fp=cyl(0.16,0.18,1.9,0x6b4a2b,5); fp.castShadow=false; fp.position.set(-5.2+i*3.2,0.95,6.8); g.add(fp);
    }
    const frail=box(7.2,0.2,0.2,0x8a6a3f); frail.castShadow=false; frail.position.set(-2,1.6,6.8); g.add(frail);
    const frail2=box(7.2,0.2,0.2,0x8a6a3f); frail2.castShadow=false; frail2.position.set(-2,0.85,6.8); g.add(frail2);
    const hayS=cone(1.7,1.9,0xcbb060,7); hayS.castShadow=false; hayS.position.set(5.2,0.95,6.4); g.add(hayS);
    const trough=box(2.6,0.7,1.1,0x5a4632); trough.castShadow=false; trough.position.set(-5.2,0.35,4); g.add(trough);
  }else if(type==="watch_tower"){ // one honest scaffold, dressed by the age
    for(const [px,pz] of [[-2.6,-2.6],[2.6,-2.6],[-2.6,2.6],[2.6,2.6]]){
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.4,14,6),texturedMat("wood",0x8a6a3f));
      leg.position.set(px,7,pz); leg.rotation.z=px>0?-0.05:0.05; leg.castShadow=true; g.add(leg);
    }
    const brace=new THREE.Mesh(new THREE.BoxGeometry(6.2,0.3,6.2),texturedMat("wood",0x6b4a2b));
    brace.position.y=6.8; brace.castShadow=false; g.add(brace);
    const plat=new THREE.Mesh(new THREE.BoxGeometry(7.6,0.5,7.6),texturedMat("wood",0x6b4a2b));
    plat.position.y=14; plat.castShadow=true; g.add(plat);
    const trim=box(7.8,0.24,7.8,P.trimC); trim.castShadow=false; trim.position.y=14.35; g.add(trim);
    for(let i=0;i<6;i++){const rung=box(1.6,0.2,0.2,0x8a6a3f); rung.castShadow=false; rung.position.set(0,2+i*2.2,2.85); g.add(rung);}
    for(const rx of [-0.9,0.9]){const rail=box(0.18,13.4,0.18,0x6b4a2b); rail.castShadow=false; rail.position.set(rx,7.2,2.85); g.add(rail);}
    for(const [px,pz] of [[-3.6,0],[3.6,0],[0,-3.6],[0,3.6]]){
      const rail=box(px?0.26:7.4,1.7,pz?0.26:7.4,0x8a6a3f); rail.castShadow=false; rail.position.set(px,15.2,pz); g.add(rail);
    }
    for(const [px,pz] of [[-3.6,-3.6],[3.6,-3.6],[-3.6,3.6],[3.6,3.6]]){
      const post=box(0.3,8,0.3,0x8a6a3f); post.castShadow=false; post.position.set(px,18.4,pz); g.add(post);
    }
    const roofW=cone(6.4,3.4,P.roofC,4); roofW.position.y=24.1; roofW.rotation.y=Math.PI/4; g.add(roofW);
    const torchP=cyl(0.13,0.13,2.1,0x4a3826,5); torchP.castShadow=false; torchP.position.set(3.2,16.4,3.2); g.add(torchP);
    const flame=cone(0.34,0.8,0xe08a2e,5); flame.castShadow=false; flame.position.set(3.2,17.9,3.2); g.add(flame);
    const banW=box(1.7,2.8,0.1,tc); banW.castShadow=false; banW.position.set(0,12.4,3.9); g.add(banW);
    const shld=cyl(0.95,0.95,0.16,0xdcdcdc,9); shld.rotation.x=Math.PI/2; shld.castShadow=false; shld.position.set(-2.8,15.8,3.75); g.add(shld);
    flagPole(g,0,25.4,0,2.4,tc,1.7,1);
  }else if(type==="wood_wall"||type==="stone_wall"||type==="fort_wall"){
    const stoneish=type!=="wood_wall", fort=type==="fort_wall";
    const wmat=stoneish?texturedMat("metal",fort?0x7d858f:0x8d949c):texturedMat("wood",0x7a5a34);
    const h=fort?8.4:(stoneish?7.2:6);
    const seg=new THREE.Mesh(new THREE.BoxGeometry(12.5,h,2),wmat);
    seg.position.y=h/2; seg.castShadow=true; g.add(seg);
    if(stoneish){
      for(let i=0;i<10;i++){ // crenellations
        const cren=new THREE.Mesh(new THREE.BoxGeometry(0.8,1,2),wmat);
        cren.position.set(-5.4+i*1.2,h+0.5,0); cren.castShadow=false; g.add(cren);
      }
      const walk=box(12.5,0.3,2.4,0x6a7280); walk.castShadow=false; walk.position.y=h-0.15; g.add(walk);
      if(fort){const mach=box(12.5,0.6,2.5,0x5a616b); mach.castShadow=false; mach.position.y=h-0.9; g.add(mach);}
    }else for(let i=0;i<12;i++){ // sharpened palisade tips
      const tip=cone(0.62,1.2,0x6b4a2b,5); tip.castShadow=false; tip.position.set(-5.5+i*1,h+0.5,0); g.add(tip);
    }
    if(fort){const ban=box(1.2,1.8,0.1,tc); ban.castShadow=false; ban.position.set(0,h-1.2,1.15); g.add(ban);}
  }else if(type==="wood_gate"||type==="stone_gate"||type==="fort_gate"){
    const stoneish=type!=="wood_gate", fort=type==="fort_gate";
    const wmat=stoneish?texturedMat("metal",fort?0x7d858f:0x8d949c):texturedMat("wood",0x7a5a34);
    const h=fort?8.8:(stoneish?7.6:6.4);
    for(const px of [-5.4,5.4]){
      const towerG=new THREE.Mesh(new THREE.BoxGeometry(2.5,h,2.8),wmat);
      towerG.position.set(px,h/2,0); towerG.castShadow=true; g.add(towerG);
      if(stoneish)for(let i=0;i<2;i++){const cr=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.8,2.8),wmat);
        cr.position.set(px-0.6+i*1.2,h+0.4,0); cr.castShadow=false; g.add(cr);}
      else{const tip=cone(0.9,1.4,0x6b4a2b,5); tip.castShadow=false; tip.position.set(px,h+0.6,0); g.add(tip);}
    }
    const lintel=new THREE.Mesh(new THREE.BoxGeometry(13,1.8,2.3),wmat);
    lintel.position.y=h-0.9; lintel.castShadow=true; g.add(lintel);
    for(let i=0;i<11;i++){ // raised portcullis bars under the lintel
      const bar=box(0.2,1.6,0.14,0x3a3a42); bar.castShadow=false; bar.position.set(-3+i*0.6,h-2.4,0); g.add(bar);
    }
    const ban=box(1.8,1.1,0.09,tc); ban.castShadow=false; ban.position.set(0,h+0.5,0); g.add(ban);
  }else if(type==="castle"){
    if(age<=4){ // the concentric keep, now with gothic ambitions
      const keep=new THREE.Mesh(new THREE.BoxGeometry(17,12,17),texturedMat("metal",0x8d949c));
      keep.position.y=6; keep.castShadow=true; g.add(keep);
      const mach=box(17.8,0.8,17.8,0x5a616b); mach.castShadow=false; mach.position.y=11.4; g.add(mach);
      for(const [px,pz] of [[-8.4,-8.4],[8.4,-8.4],[-8.4,8.4],[8.4,8.4]]){
        const twr=new THREE.Mesh(new THREE.CylinderGeometry(2.6,3,16,8),texturedMat("metal",0x7d858f));
        twr.position.set(px,8,pz); twr.castShadow=true; g.add(twr);
        const cap=cone(3.1,4.6,tc,8); cap.position.set(px,18.3,pz); g.add(cap);
        const fin=cyl(0.1,0.1,1.2,GOLD,4); fin.castShadow=false; fin.position.set(px,21.2,pz); g.add(fin);
      }
      for(let i=0;i<6;i++){const cren=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.4,1.8),texturedMat("metal",0x8d949c));
        cren.position.set(-6.8+i*2.7,12.7,8); cren.castShadow=false; g.add(cren);
        const cren2=cren.clone(); cren2.position.z=-8; g.add(cren2);}
      const inner=new THREE.Mesh(new THREE.BoxGeometry(9,16,9),texturedMat("metal",0x99a1ab));
      inner.position.y=8; inner.castShadow=true; g.add(inner);
      const innerCap=cone(6.8,5,tc,4); innerCap.position.y=18.5; innerCap.rotation.y=Math.PI/4; g.add(innerCap);
      for(const s of [-1,1]){const lan=box(0.4,2.4,0.16,0x1e1e24); lan.castShadow=false; lan.position.set(s*2.2,11,4.56); g.add(lan);}
      archDoor(g,0,8.56,3.4,4.4,0x1e1e24);
      const ban=box(2.6,1.7,0.14,tc); ban.castShadow=false; ban.position.y=21.6; g.add(ban);
    }else{ // the Enlightenment star fort: low bastions around a domed keep
      const plat=new THREE.Mesh(new THREE.BoxGeometry(20,2.6,20),texturedMat("uniform",0xb9b4a6));
      plat.position.y=1.3; plat.castShadow=true; g.add(plat);
      for(const s of [[0,9.8],[0,-9.8],[9.8,0],[-9.8,0]]){
        const par=box(s[1]?20.6:0.9,1,s[1]?0.9:20.6,0xcac4b4); par.castShadow=false; par.position.set(s[0],3.1,s[1]); g.add(par);
      }
      for(const [px,pz] of [[-10,-10],[10,-10],[-10,10],[10,10]]){ // diamond bastions
        const bast=new THREE.Mesh(new THREE.CylinderGeometry(3.2,4.4,3.4,4),texturedMat("uniform",0xb9b4a6));
        bast.position.set(px,1.7,pz); bast.castShadow=true; g.add(bast);
        const bpar=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,0.7,4),plainMat(0xcac4b4));
        bpar.position.set(px,3.6,pz); bpar.castShadow=false; g.add(bpar);
      }
      const keep=new THREE.Mesh(new THREE.BoxGeometry(9.5,7,9.5),aWall(5)); keep.position.y=6.1; keep.castShadow=true; g.add(keep);
      const cor=box(10.4,0.6,10.4,0xffffff); cor.castShadow=false; cor.position.y=9.9; g.add(cor);
      winGrid(g,3,1,7,0,4.82,AGEPAL[5].darkC,0xffffff);
      const drum=cyl(3,3.2,1.7,0xf2ede2,12); drum.castShadow=false; drum.position.y=11; g.add(drum);
      const dome=bDome(3.3,"uniform",AGEPAL[5].roofC); dome.position.y=11.8; g.add(dome);
      const lant=cyl(0.7,0.7,1.1,0xf2ede2,8); lant.castShadow=false; lant.position.y=15.4; g.add(lant);
      const gate=box(3,3.6,0.3,AGEPAL[5].darkC); gate.castShadow=false; gate.position.set(0,1.8,10.06); g.add(gate);
      flagPole(g,0,15.9,0,3.2,tc,2.2,1.2);
    }
  }else if(type==="siege_workshop"){
    agedShell(g,age,tc,12,5.2,9.6);
    const anvil=box(1.4,1,0.7,0x4a4e56); anvil.castShadow=false; anvil.position.set(-4.8,1.5,5.2); g.add(anvil);
    const anvilBase=box(1,1,1,0x5a4632); anvilBase.castShadow=false; anvilBase.position.set(-4.8,0.5,5.2); g.add(anvilBase);
    const crane=box(0.4,5.2,0.4,0x6b4a2b); crane.rotation.z=-0.5; crane.position.set(5.8,4.4,3.6); g.add(crane);
    const rope=cyl(0.08,0.08,2.4,0x9a8a6a,4); rope.castShadow=false; rope.position.set(7.1,4,3.6); g.add(rope);
    const hook=box(0.3,0.5,0.2,0x4a4e56); hook.castShadow=false; hook.position.set(7.1,2.6,3.6); g.add(hook);
    const coil=new THREE.Mesh(new THREE.TorusGeometry(0.7,0.2,5,8),plainMat(0x9a8a6a));
    coil.rotation.x=Math.PI/2; coil.castShadow=false; coil.position.set(-2.4,0.24,5.8); g.add(coil);
    const log=cyl(0.64,0.64,6.8,0x6b4a2b,7); log.rotation.z=Math.PI/2; log.position.set(0,2,5.8); g.add(log);
    for(const lx of [-2.4,2.4]){const sh=box(0.5,1.8,1.4,0x8a6a3f); sh.position.set(lx,0.9,5.8); g.add(sh);}
    const wheel=cyl(1.8,1.8,0.36,0x5a4632,10); wheel.rotation.x=0.25; wheel.position.set(5.2,2,5); g.add(wheel);
  }else if(type==="market"){
    agedShell(g,age,tc,11.2,4.8,9.2);
    const stall=new THREE.Mesh(new THREE.BoxGeometry(6.8,1.8,2.2),texturedMat("wood",0x8a6a3f));
    stall.position.set(0,1.8,5.2); g.add(stall);
    const goods=box(5.2,1,1.6,0xe0a92e); goods.castShadow=false; goods.position.set(0,3.2,5.2); g.add(goods);
    const goods2=box(1.6,0.8,1.2,0xc23a3a); goods2.castShadow=false; goods2.position.set(-1.6,3.9,5); g.add(goods2);
    const goods3=box(1.4,0.7,1,0x7fae54); goods3.castShadow=false; goods3.position.set(1.8,3.8,5.4); g.add(goods3);
    if(age<3){ // striped team awning over the stall on rough-and-ready poles
      const awning=cone(4.6,2,tc,4); awning.rotation.y=Math.PI/4; awning.position.set(0,5.8,5); g.add(awning);
      for(const s of [-1,1]){const ap=cyl(0.12,0.14,4.4,0x8a6a3f,5); ap.castShadow=false; ap.position.set(s*3.4,2.2,6.4); g.add(ap);}
    }else{ // a tailored canopy for the polite ages
      for(const s of [-1,1]){const ap=cyl(0.12,0.14,4.6,age===4?0x6b4a2b:0xf2ede2,5); ap.castShadow=false; ap.position.set(s*3.6,2.3,6.4); g.add(ap);}
      const can=box(8,0.16,3.4,tc); can.rotation.x=0.14; can.castShadow=false; can.position.set(0,4.7,5.6); g.add(can);
    }
    for(let i=0;i<3;i++){const crate=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.7,1.7),texturedMat("wood",0xb08a5a));
      crate.position.set(5.8,0.85+(i>1?1.7:0),2.4-(i%2)*2.4); crate.rotation.y=i*0.5; g.add(crate);}
    const rug=box(4.4,0.1,3.2,0xb42222); rug.castShadow=false; rug.position.set(-0.4,0.05,7.2); g.add(rug);
    const signPost=cyl(0.18,0.2,5.2,0x6b4a2b,5); signPost.castShadow=false; signPost.position.set(-5.8,2.6,5.6); g.add(signPost);
    const sign=box(2.6,1.4,0.2,0xe8e2d0); sign.castShadow=false; sign.position.set(-5.8,4.4,5.6); g.add(sign);
    const coin=cyl(0.4,0.4,0.26,GOLD,8); coin.rotation.x=Math.PI/2; coin.castShadow=false; coin.position.set(-5.8,4.4,5.74); g.add(coin);
  }else if(type==="temple"){
    if(age===0){ // a ring of standing stones around the fire
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3+0.3;
        const st=box(1.1,3.4,0.8,0x9a8a76); st.rotation.y=-a; st.rotation.z=(i%2?0.06:-0.05);
        st.position.set(Math.cos(a)*4.2,1.7,Math.sin(a)*4.2); g.add(st);
      }
      for(const i of [0,3]){ // two lintels bridge the tall pairs
        const a=i*Math.PI/3+0.3+Math.PI/6;
        const lin=box(3.2,0.7,0.9,0x8d7a5a); lin.rotation.y=-a; lin.castShadow=false;
        lin.position.set(Math.cos(a)*4.1,3.7,Math.sin(a)*4.1); g.add(lin);
      }
      const altar=box(1.8,1.1,1.8,0x9a8a76); altar.position.y=0.55; g.add(altar);
      const skull=box(0.9,0.75,0.85,BONE); skull.castShadow=false; skull.position.y=1.45; g.add(skull);
      for(const s of [-1,1]){const t=tuskArc(0.6); t.rotation.z=s*0.6; t.position.set(s*0.5,1.7,0); g.add(t);}
      firePit(g,0,3); brazier(g,-2.6,4.6); brazier(g,2.6,4.6);
    }else if(age===1){ // the stepped mastaba, gold disc at the summit
      const m1=frustum4(9,8,2.4,aWall(1,0xd4bd8e)); m1.position.y=1.2; g.add(m1);
      const m2=frustum4(6.6,5.9,2.1,aWall(1)); m2.position.y=3.45; g.add(m2);
      const m3=frustum4(4.4,3.9,1.9,aWall(1,0xd4bd8e)); m3.position.y=5.45; g.add(m3);
      const disc=cyl(1,1,0.16,GOLD,10); disc.rotation.x=Math.PI/2; disc.castShadow=false; disc.position.set(0,7.3,0.4); g.add(disc);
      horns(g,0,6.6,2.1);
      const door=box(1.5,1.9,0.2,P.darkC); door.castShadow=false; door.position.set(0,1,4.55); g.add(door);
      const ramp=box(2,0.24,3,0xc9b088); ramp.rotation.x=0.24; ramp.castShadow=false; ramp.position.set(0,0.5,5.6); g.add(ramp);
      brazier(g,-2.4,5.4); brazier(g,2.4,5.4);
    }else if(age===2){ // the timber temple with its deep carved porch
      const hall=new THREE.Mesh(new THREE.BoxGeometry(8,3.6,5.2),aWall(2)); hall.position.set(0,2.1,-0.8); hall.castShadow=true; g.add(hall);
      const foot=new THREE.Mesh(new THREE.BoxGeometry(8.6,0.7,8.6),texturedMat("metal",P.stoneC)); foot.position.y=0.35; foot.castShadow=false; g.add(foot);
      for(const px of [-2.6,-0.9,0.9,2.6]){const pp=cyl(0.24,0.28,3.4,0x6b4a2b,6); pp.position.set(px,2.05,2.6); g.add(pp);
        const ring=cyl(0.34,0.34,0.24,tc,6); ring.castShadow=false; ring.position.set(px,3,2.6); g.add(ring);}
      gableRoof(g,9.4,8.6,4,4.2,THATCH,0x7a5f42,1);
      const ant=tuskArc(0.9); ant.position.set(0,8.7,4); g.add(ant);
      const door=box(1.6,2.4,0.18,P.darkC); door.castShadow=false; door.position.set(0,1.6,1.86); g.add(door);
      brazier(g,-2.2,4.3); brazier(g,2.2,4.3);
    }else if(age===3){ // the little Parthenon (the v36 temple, grown into itself)
      const base=new THREE.Mesh(new THREE.BoxGeometry(10,1.2,8),texturedMat("uniform",0xd9d0b8)); base.position.y=0.6; base.castShadow=true; g.add(base);
      const step1=box(11.6,0.5,9.6,0xc9c0a8); step1.position.y=0.25; step1.castShadow=false; g.add(step1);
      const step2=box(5.2,0.44,2,0xc9c0a8); step2.position.set(0,0.22,5); step2.castShadow=false; g.add(step2);
      const colG=new THREE.Group(); colG.position.y=1.2; g.add(colG);
      for(const cx of [-3.6,-1.2,1.2,3.6]){colAt(colG,cx,2.6,5.2,0.58,3); colAt(colG,cx,-2.6,5.2,0.58,3);}
      const arch=new THREE.Mesh(new THREE.BoxGeometry(10.4,1.2,8.4),texturedMat("uniform",0xd9d0b8));
      arch.position.y=7.4; arch.castShadow=false; g.add(arch);
      const trimG=box(10.6,0.3,8.6,GOLD); trimG.castShadow=false; trimG.position.y=8.1; g.add(trimG);
      gableRoof(g,10.2,8,8.25,1.9,tc,0xe8e2d0,0.6);
      const sun=cyl(1,1,0.2,GOLD,10); sun.rotation.x=Math.PI/2; sun.castShadow=false; sun.position.set(0,4.8,4.24); g.add(sun);
      brazier(g,-4.2,5); brazier(g,4.2,5);
    }else if(age===4){ // Romanesque chapel with a gothic heart
      const course=new THREE.Mesh(new THREE.BoxGeometry(8.8,1.4,7.2),texturedMat("metal",P.stoneC)); course.position.y=0.7; course.castShadow=true; g.add(course);
      const nave=new THREE.Mesh(new THREE.BoxGeometry(8,5,6.4),aWall(4)); nave.position.y=2.9; nave.castShadow=true; g.add(nave);
      const apse=cyl(2.6,2.7,5,0x7d858f,10); apse.position.set(0,2.9,-3.4); g.add(apse);
      const apseCap=cone(2.9,1.8,P.roofC,10); apseCap.position.set(0,6.3,-3.4); g.add(apseCap);
      gableRoof(g,8.6,6.4,5.4,3,P.roofC,0x8d949c,0.7);
      const spb=box(1.5,1.5,1.5,0x7d858f); spb.position.y=8.9; g.add(spb);
      const spire=cone(1,4.4,0x5a4632,6); spire.position.y=11.8; g.add(spire); // shingled timber spire
      const fin=cyl(0.08,0.08,1,GOLD,4); fin.castShadow=false; fin.position.y=14.3; g.add(fin);
      for(const sx of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(0.42,5,0.42),texturedMat("wood",0x5a4632));
        post.position.set(sx*3.95,2.9,3.2); g.add(post);}
      const lintel=new THREE.Mesh(new THREE.BoxGeometry(8.4,0.4,0.4),texturedMat("wood",0x5a4632)); lintel.castShadow=false; lintel.position.set(0,4.6,3.3); g.add(lintel);
      const rose=cyl(1.15,1.15,0.16,0xe8e2d0,12); rose.rotation.x=Math.PI/2; rose.castShadow=false; rose.position.set(0,6.4,3.28); g.add(rose);
      const roseC=cyl(0.75,0.75,0.2,tc,12); roseC.rotation.x=Math.PI/2; roseC.castShadow=false; roseC.position.set(0,6.4,3.3); g.add(roseC);
      for(const s of [-1,1]){const but=box(0.8,4,1.2,0x7d858f); but.rotation.x=-0.14; but.position.set(s*3.3,2.2,3.4); g.add(but);}
      archDoor(g,0,3.26,1.8,2.5,P.darkC);
      brazier(g,-2.6,4.8); brazier(g,2.6,4.8);
    }else{ // the rotunda: drum, dome, portico
      for(const [sw,sy] of [[5.9,0.25],[5.5,0.7]]){
        const st=cyl(sw,sw+0.2,0.45,0xe3dccb,14); st.position.y=sy; st.castShadow=false; g.add(st);}
      const drum=new THREE.Mesh(new THREE.CylinderGeometry(4,4.2,4.6,14),aWall(5)); drum.position.y=3.2; drum.castShadow=true; g.add(drum);
      const ent=cyl(4.55,4.55,0.7,0xffffff,14); ent.castShadow=false; ent.position.y=5.7; g.add(ent);
      const dome=bDome(4.2,"uniform",AGEPAL[5].roofC); dome.position.y=6; g.add(dome);
      const lant=cyl(0.75,0.75,1.2,0xf2ede2,8); lant.castShadow=false; lant.position.y=10.6; g.add(lant);
      const lfin=cone(0.4,0.7,GOLD,6); lfin.castShadow=false; lfin.position.y=11.5; g.add(lfin);
      for(const cx of [-2.7,-0.9,0.9,2.7])colAt(g,cx,4.9,4.6,0.5,5);
      const pent=box(7.4,0.8,2.4,0xffffff); pent.castShadow=false; pent.position.set(0,5.5,4.9); g.add(pent);
      const ped=pedTri(7.4,1.7,0xffffff); ped.position.set(0,6.75,4.9); g.add(ped);
      const door=box(1.8,2.6,0.2,AGEPAL[5].darkC); door.castShadow=false; door.position.set(0,1.75,4.1); g.add(door);
      brazier(g,-3.4,5.4); brazier(g,3.4,5.4);
    }
  }else if(type==="tower"){ // the guard tower speaks marble, granite, or whitewash
    const bodyMat=age===3?texturedMat("uniform",0xe8e2d0):age===4?texturedMat("metal",0x8d949c):texturedMat("uniform",0xf2ede2);
    const merC=age===3?0xd9d0b8:age===4?0x7d858f:0xe3dccb;
    const t=new THREE.Mesh(new THREE.CylinderGeometry(3,3.8,14,9),bodyMat);
    t.position.y=7; t.castShadow=true; g.add(t);
    const band=cyl(3.5,3.56,0.7,merC,9); band.castShadow=false; band.position.y=11.2; g.add(band);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.2,2.6,9),bodyMat);
    top.position.y=15.3; top.castShadow=true; g.add(top);
    for(let i=0;i<6;i++){ // crenellated crown
      const a=i*Math.PI/3;
      const mer=box(1.2,1.1,0.8,merC); mer.position.set(Math.cos(a)*3.8,17.1,Math.sin(a)*3.8);
      mer.rotation.y=-a; mer.castShadow=false; g.add(mer);
    }
    for(const sy of [6.4,10]){ // arrow slits
      const slit=box(0.44,1.8,0.2,0x1c130a); slit.castShadow=false; slit.position.set(0,sy,3.4); g.add(slit);
    }
    const roofc=cone(3.8,3.4,age===3?AGEPAL[3].roofC:age===4?tc:AGEPAL[5].roofC,7); roofc.position.y=18.3; g.add(roofc);
    if(age===5){const lan=cyl(0.5,0.5,0.9,0xf2ede2,7); lan.castShadow=false; lan.position.y=20.4; g.add(lan);}
    flagPole(g,0,19.6,0,2.6,tc,1.9,1.1);
    const torch2=cone(0.3,0.8,0xe08a2e,5); torch2.castShadow=false; torch2.position.set(0,4.4,3.9); g.add(torch2);
  }
  return g;
}
function makeBar(parent,y,w,frontColor){
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x1c130a}));
  bg.scale.set(w,0.22,1); bg.position.y=y; bg.center.set(0.5,0.5); parent.add(bg);
  const fg=new THREE.Sprite(new THREE.SpriteMaterial({color:frontColor}));
  fg.scale.set(w-0.08,0.15,1); fg.position.y=y; fg.center.set(0,0.5);
  fg.position.x=-(w-0.08)/2; parent.add(fg);
  return {bg,fg,w:w-0.08};
}
function setBar(bar,frac){ bar.fg.scale.x=Math.max(0.001,bar.w*Math.max(0,frac)); }

// health-bar heights sized for the tallest age variant of each type
const BARH={towncenter:16,house:8,barracks:13,farm:5,storage_pit:7,archery_range:13,stable:13,
  watch_tower:20,tower:23,temple:15,market:13,siege_workshop:13,castle:23,blacksmith:10,
  wood_wall:9,stone_wall:10,fort_wall:11,wood_gate:10,stone_gate:11,fort_gate:12};

let BID=0; // network-stable building ids: host-assigned, guests adopt via bnew
function makeBuilding(team,type,x,z,instant,rot){
  const def=BLD[type];
  const root=new THREE.Group(); root.position.set(x,terrainHeight(x,z),z);
  const wrap=new THREE.Group(); const bs=BSCALE[type]||1; wrap.scale.setScalar(bs); root.add(wrap);
  const body=buildingMesh(type,team); if(rot)body.rotation.y=rot; wrap.add(body); scene.add(root);
  // foundation plinth: rolling hills never show a gap under a building again (deeper for 2x footprints).
  // WALLS get a straight stone FOOTING along their length — a round pad under a
  // 12.5-long, 2-wide wall pokes out sideways like a dinner plate under a ruler
  const plinth=def.wall
    ?new THREE.Mesh(new THREE.BoxGeometry(13.4,3.6,3.0), // 13.4 > 12.5 spacing: footings overlap into one continuous course
      new THREE.MeshLambertMaterial({color:0x8a7a5e}))
    :new THREE.Mesh(new THREE.CylinderGeometry(def.r*0.92,def.r*1.05,3.6,10),
      new THREE.MeshLambertMaterial({color:0x8a7a5e}));
  if(def.wall)plinth.rotation.y=rot||0; // the footing follows the wall, the root never rotates
  plinth.position.y=-1.6; plinth.castShadow=false; plinth.receiveShadow=false; root.add(plinth);
  const b={id:BID++,team,type,def,x,z,root,body,wrap,rot:rot||0,hp:def.hp,maxHp:def.hp,
    built:!!instant,progress:instant?def.hits:0,alive:true,atkT:0};
  if(type==="watch_tower")b.deck={y:14.25*bs,r:2.5}; // stand height + walkable radius up top
  b.bar=makeBar(root,BARH[type]||10,4,0x4caf50);
  if(def.heal){ // visible healing aura
    const aura=new THREE.Mesh(new THREE.RingGeometry(def.heal.rng-0.35,def.heal.rng,40),
      new THREE.MeshBasicMaterial({color:0x6fdc7a,transparent:true,opacity:0.18,side:THREE.DoubleSide}));
    aura.rotation.x=-Math.PI/2; aura.position.y=0.07; root.add(aura);
  }
  b.bar.bg.visible=b.bar.fg.visible=false;
  if(!instant){
    body.scale.y=0.15;
    body.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=0.55;}});
  }
  if(type==="farm"){ // corn stalks: they grow, and golden tassels mean HARVEST ME
    const crop=new THREE.Group();
    b.tassels=[];
    for(let gx=-1;gx<=1;gx++)for(let gz=-1;gz<=1;gz++){
      const st=new THREE.Mesh(new THREE.BoxGeometry(0.26,2.2,0.26),plainMat(0x4f7d2f));
      st.position.set(gx*5.2+(Math.random()-0.5)*1.6,1.1,gz*5.2+(Math.random()-0.5)*1.6);
      st.castShadow=false; crop.add(st);
      const tas=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.6,0.28),plainMat(0xe8c53a));
      tas.position.set(st.position.x,2.4,st.position.z);
      tas.castShadow=false; tas.visible=false; crop.add(tas); b.tassels.push(tas);
    }
    crop.scale.y=0.15; wrap.add(crop);
    b.cropMesh=crop; b.crop=0;
  }
  clearFootprint(b); // v114: the plot is cleared of standing timber the moment it's laid out
  buildings.push(b); return b;
}
// v114: fell every live tree under a new building's footprint. Wood nodes no longer refuse a
// plot (see validFor), so SOMETHING has to remove them or a house would grow through a spruce.
// Host-authoritative: guests get the same fell through the existing {t:"ndep"} message, and a
// guest calling this locally is harmless because it clears the same deterministic node indices.
function clearFootprint(b){
  if(typeof nodes==="undefined"||typeof depleteNode!=="function")return;
  const reach=b.def.r+(b.def.wall?1.6:2.2); // walls sit tight; everything else wants elbow room
  for(const n of nodes){
    if(n.type!=="wood"||n.amount<=0)continue;
    const dx=b.x-n.x, dz=b.z-n.z;            // dist2() lives in 04-units, which may not be loaded
    if(dx*dx+dz*dz>reach*reach)continue;      // yet when the starting town centres go down
    n.amount=0;
    depleteNode(n); // the 10-net WRAPPER: plays the treefall and bcasts {t:"ndep"} for free,
                    // so guests fell exactly the same node indices with no new wire format.
                    // The stump ring it leaves around a woodland outpost is deliberate — that
                    // ground was cleared, and it reads that way.
  }
}
// when a team advances, every standing building re-dresses in the new age's architecture.
// GAMEPLAY callers pass defer=true: jobs queue up and drain a few per frame, so an age-up
// re-dresses the town in a quick visible wave instead of one snapshot-stalling hitch.
const _restyleQ=[];
const _roadsDirty=[false,false];
function markRoadsDirty(team){_roadsDirty[team]=true;}
function _restyleOneBuilding(b){
  if(!b.alive)return;
  const nb=buildingMesh(b.type,b.team,teamAge[b.team]);
  nb.rotation.y=b.rot||0;
  if(!b.built){ // under-construction sites keep their scaffolding look
    nb.scale.y=0.15+0.85*(b.progress/b.def.hits);
    nb.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=0.55;}});
  }
  (b.wrap||b.root).remove(b.body);
  b.body.traverse(o=>{if(o.geometry)o.geometry.dispose();}); // materials are cached and shared — leave them be
  b.body=nb; (b.wrap||b.root).add(nb);
  puff(b.x+(Math.random()-0.5)*3,2.5,b.z+(Math.random()-0.5)*3,0xffe27a,1.4,0.8);
}
function drainVisualQueue(){ // a few jobs per frame: the wave sweeps the town in ~a quarter second
  let budget=5;
  while(budget>0&&_restyleQ.length){
    const j=_restyleQ.shift();
    if(j.kind==="b")_restyleOneBuilding(j.b);
    else if(j.kind==="u"&&j.u.alive&&j.u.cls==="villager")buildBodyFor(j.u);
    budget--;
  }
  if(_restyleQ.length)return; // roads repave once the wave has passed
  for(const team of [0,1])if(_roadsDirty[team]){_roadsDirty[team]=false;rebuildRoads(team);}
}
function restyleBuildings(team,defer){
  for(const b of buildings){
    if(!b.alive||b.team!==team)continue;
    if(defer)_restyleQ.push({kind:"b",b});
    else _restyleOneBuilding(b);
  }
  if(defer)markRoadsDirty(team);
  else rebuildRoads(team); // streets repave themselves in the new age's surface
}
function addConstructionHit(b,who){
  awardPts(who,costPts(b.def.cost)/(3*b.def.hits)); // a third of the value, spread over the raising
  if(b.built)return;
  if(who&&isHuman(who)){ // MASTER BUILDER: your first swing on a site counts extra — once per site
    const bst=buffSt(who,"builder");
    if(bst){b._mb=b._mb||{}; if(!b._mb[who.id]){b._mb[who.id]=1; b.progress+=bst;}}
  }
  b.progress++;
  const f=b.progress/b.def.hits;
  b.body.scale.y=0.15+0.85*f;
  puff(b.x+(Math.random()-0.5)*2,1+f*3,b.z+(Math.random()-0.5)*2,0xd8c49a);
  if(typeof Sound!=="undefined"){Sound.play("build",{x:b.x,z:b.z}); // v100: hammer/construction on each swing
    if(Math.random()<0.12)Sound.play("veffort",{x:b.x,z:b.z});} // v109: sparse work grunts under the hammer
  if(b.progress>=b.def.hits){
    b.built=true; b.body.scale.y=1;
    if(typeof Sound!=="undefined")Sound.play("complete",{x:b.x,z:b.z}); // v100: completion chime
    if(b.qBy!==undefined){ // quest credit goes to the human who PLACED the foundation
      const ow=units.find(u=>u.id===b.qBy);
      if(ow&&isHuman(ow)&&typeof questProgress==="function")
        questProgress(ow,(b.def.wall&&!b.def.gate)?"build_wall":"build_"+b.type);
    }
    // (farms grow corn now — see the crop cycle in makeBuilding/economyTick)
    b.body.traverse(o=>{if(o.material){o.material.opacity=1;o.material.transparent=false;}});
    if(roadEligible(b))markRoadsDirty(b.team); // a new building extends the street grid (coalesced)
    const nearP=player&&player.alive&&dist2(b.x,b.z,player.root.position.x,player.root.position.z)<45*45;
    if(who&&who.isPlayer){
      msg("You finished the "+b.def.name+"!","blue");
      if(b.type==="house")msg("Blue respawn time reduced.","blue");
    }else if(b.team===BLUE&&b.type==="barracks"){
      msg("Your team raised a Barracks — stand beside it and press R to arm up!","blue");
    }else if(b.team===RED&&b.type==="barracks"&&!window._redBar){
      window._redBar=true;
      msg("Scouts report: the Red team raised a Barracks…","red");
    }else if(b.team===BLUE&&nearP&&b.type!=="house"){
      msg((who?who.name:"The team")+" finished a "+b.def.name+".","blue");
    }
  }
}
function damageBuilding(b,dmg,att){
  if(typeof NET!=="undefined"&&NET.mode==="guest")return; // host owns all damage
  if(!b.alive)return;
  if(att&&!att.def&&isHuman(att)&&att.team!==b.team)
    dmg*=1+0.10*buffSt(att,"wreck"); // WRECKER: human demolition specialists
  b.lastHit=T; // patrol bands answer struck buildings
  b.hp-=dmg; b.bar.bg.visible=b.bar.fg.visible=true; setBar(b.bar,b.hp/b.maxHp);
  if(typeof Sound!=="undefined")Sound.play((b.type&&b.type.indexOf("wood")>=0)?"bldhitwood":"bldhit",{x:b.x,z:b.z}); // v102: structural crunch
  // v113: the alarm is a WARNING, not a metronome — under a sustained bombardment the old 4 s
  // gate rang the bell nonstop (John's v112 note). One toll per minute per team now.
  if(typeof Sound!=="undefined"&&b.team===MYTEAM)Sound.play("basealarm"); // v103: your base under attack (mgr throttles to BASEALARM_CD)
  if(typeof NET!=="undefined"&&NET.mode==="host"&&typeof teamHasHuman==="function"&&teamHasHuman(b.team)){
    window._baT=window._baT||{}; if(T-(window._baT[b.team]||-999)>60){window._baT[b.team]=T;NET.bcast({t:"snd",k:"basealarm",team:b.team});}
  }
  if(b.hp<=0){
    awardPts(att,costPts(b.def.cost)); // razing pays the building's full cost
    if(att&&!att.def&&isHuman(att)&&att.team!==b.team&&typeof questProgress==="function")
      questProgress(att,b.type==="farm"?"raze_farm":"raze_bld");
    b.alive=false; scene.remove(b.root);
    if(typeof Sound!=="undefined")Sound.play("raze",{x:b.x,z:b.z}); // v102: the building falls
    if(b.node){b.node.amount=0;b.node.mesh.visible=false;} // burnt farm feeds no one
    if(!b.def.wall&&b.type!=="farm"&&b.type!=="storage_pit")markRoadsDirty(b.team); // streets re-route (coalesced)
    msg(TEAMNAME[b.team]+" "+b.def.name+" destroyed!", b.team===BLUE?"warn":"gold");
  }
}
function teamHouses(team){return buildings.filter(b=>b.alive&&b.built&&b.team===team&&b.type==="house").length;}
function respawnDelay(team){return Math.max(10,30-1*teamHouses(team));} // v84: slower base, gentler house scaling, higher floor
function nearestBuilt(team,type,x,z,maxD){
  let best=null,bd=(maxD||1e6)*(maxD||1e6);
  for(const b of buildings){
    if(!b.alive||!b.built||b.team!==team||b.type!==type)continue;
    const d=dist2(x,z,b.x,b.z);
    if(d<bd){bd=d;best=b;}
  }
  return best;
}
function teamTC(team){return buildings.find(b=>b.alive&&b.team===team&&b.type==="towncenter");}

// pre-built town centers
makeBuilding(BLUE,"towncenter",TCPOS[0][0],TCPOS[0][1],true);
makeBuilding(RED,"towncenter",TCPOS[1][0],TCPOS[1][1],true);
