/* scratch: draw the LIVE layout as a schematic in the owner's sketch orientation (up = -z = the
   Vikings), so the two can be compared shape for shape. Reads the real functions, not a copy. */
const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8304);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:400,height:300}});
  await page.goto("http://localhost:8304/index.html",{waitUntil:"load",timeout:90000});
  await page.waitForFunction(()=>typeof CREEP_SITES!=="undefined"&&typeof vikingPoint==="function",null,{timeout:45000});
  const D=await page.evaluate(()=>({
    map:[MAP.x,MAP.z],
    king:Array.from({length:121},(_,i)=>{const p=roadPoint(i/120);return [+p.x.toFixed(1),+p.z.toFixed(1)];}),
    vik:[0,1].map(t=>Array.from({length:121},(_,i)=>{const p=vikingPoint(t,i/120);return [+p.x.toFixed(1),+p.z.toFixed(1)];})),
    tc:TCPOS,
    baz:BAZAAR_SITES.map(B=>{const p=B.p();return {what:B.what,x:+p.x.toFixed(1),z:+p.z.toFixed(1),r:B.plaza};}),
    camps:CREEP_SITES.map(c=>({x:c.x,z:c.z,r:c.r,inner:!!c.inner,boss:!!c.boss})),
    ponds:(typeof PONDS!=="undefined")?PONDS:[],
    stands:(typeof TREE_STANDS!=="undefined")?TREE_STANDS.map(s=>[s.x,s.z,s.r]):[]
  }));
  await b.close(); srv.close();
  const W=1500,H=1040,PAD=40;
  const sx=(W-2*PAD)/(D.map[0]*2+60), sz=(H-2*PAD)/(D.map[1]*2+120);
  const s=Math.min(sx,sz), cx=W/2, cy=H/2;
  const X=x=>(cx+x*s).toFixed(1), Y=z=>(cy+z*s).toFixed(1);   // +z downward -> -z (Vikings) is UP
  const o=[];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  o.push(`<rect width="${W}" height="${H}" fill="#f6f4ee"/>`);
  o.push(`<rect x="${X(-D.map[0])}" y="${Y(-D.map[1])}" width="${(D.map[0]*2*s).toFixed(1)}" height="${(D.map[1]*2*s).toFixed(1)}" fill="#e8f0dd" stroke="#b9c9a6" stroke-width="2"/>`);
  for(const [px,pz,pr] of D.ponds)o.push(`<circle cx="${X(px)}" cy="${Y(pz)}" r="${(pr*s).toFixed(1)}" fill="#9dc3d8"/>`);
  for(const [tx,tz,tr] of D.stands)o.push(`<circle cx="${X(tx)}" cy="${Y(tz)}" r="${(tr*s).toFixed(1)}" fill="#2f6b34" opacity="0.13"/>`);
  const poly=pts=>pts.map(p=>X(p[0])+","+Y(p[1])).join(" ");
  o.push(`<polyline points="${poly(D.king)}" fill="none" stroke="#9b7b52" stroke-width="9" stroke-linecap="round"/>`);
  for(const v of D.vik)o.push(`<polyline points="${poly(v)}" fill="none" stroke="#a98d66" stroke-width="5" stroke-linecap="round"/>`);
  for(const t of D.tc){o.push(`<circle cx="${X(t[0])}" cy="${Y(t[1])}" r="${(30*s).toFixed(1)}" fill="none" stroke="${t[0]<0?"#2c5fd0":"#c0392b"}" stroke-width="2.5"/>`);
    o.push(`<text x="${X(t[0])}" y="${Y(t[1])}" font-family="sans-serif" font-size="15" text-anchor="middle" fill="${t[0]<0?"#2c5fd0":"#c0392b"}">${t[0]<0?"BLUE":"RED"}</text>`);}
  for(const c of D.camps){
    o.push(`<circle cx="${X(c.x)}" cy="${Y(c.z)}" r="${(c.r*s).toFixed(1)}" fill="${c.inner?"#e03b2f":"#8d3b33"}" opacity="${c.inner?0.95:0.55}"/>`);
    if(c.inner)o.push(`<text x="${X(c.x)}" y="${(+Y(c.z)+(c.z>0?26:-16)).toFixed(1)}" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#a5271d">NEW CAMP</text>`);
  }
  for(const bz of D.baz){
    o.push(`<circle cx="${X(bz.x)}" cy="${Y(bz.z)}" r="${(bz.r*s).toFixed(1)}" fill="#f2c22e" stroke="#8a6a10" stroke-width="2"/>`);
    o.push(`<text x="${X(bz.x)}" y="${(+Y(bz.z)+(bz.what==="grand"?30:-16)).toFixed(1)}" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#6b5210">${bz.what==="grand"?"GRAND BAZAAR":(bz.what.toUpperCase()+" BAZAAR")}</text>`);
  }
  o.push(`<text x="${X(0)}" y="${Y(-D.map[1])-12}" font-family="sans-serif" font-size="17" text-anchor="middle" fill="#444">↑ VIKINGS (-z)</text>`);
  o.push(`<text x="${X(-D.map[0])+6}" y="${Y(D.map[1])+24}" font-family="sans-serif" font-size="13" fill="#777">v132.14 — King's Road thick, Viking roads thin, woods shaded, blue faces +x so RIGHT is the bottom half</text>`);
  o.push(`</svg>`);
  fs.writeFileSync(path.join(ROOT,"_maplook","plan.svg"),o.join("\n"));
  console.log("wrote _maplook/plan.svg");
  process.exit(0);
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
