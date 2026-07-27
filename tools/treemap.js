const {chromium}=require("playwright-core");
const http=require("http"),fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const MIME={html:"text/html",js:"text/javascript",css:"text/css",ogg:"audio/ogg",png:"image/png"};
(async()=>{
  const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/^\//,"")||"index.html");
    try{const d=fs.readFileSync(p);r.writeHead(200,{"Content-Type":MIME[p.split(".").pop()]||"application/octet-stream"});r.end(d);}catch(e){r.writeHead(404);r.end();}}).listen(8130);
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox","--mute-audio","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await b.newPage({viewport:{width:800,height:400}});
  page.on("pageerror",e=>console.log("PAGE ERROR: "+e.message));
  await page.goto("http://localhost:8130/index.html",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof nodes!=="undefined"&&nodes.length>0,null,{timeout:30000});
  const out=await page.evaluate(()=>({
    trees:nodes.filter(n=>n.type==="wood").map(n=>[+n.x.toFixed(1),+n.z.toFixed(1)]),
    other:nodes.filter(n=>n.type!=="wood").map(n=>[+n.x.toFixed(1),+n.z.toFixed(1),n.type]),
    road:Array.from({length:80},(_,i)=>{const p=roadPoint(i/79);return [+p.x.toFixed(1),+p.z.toFixed(1)];}),
    tcs:TCPOS, bazaars:neutralMarkets.map(m=>[m.x,m.z]), map:[MAP.x,MAP.z]}));
  fs.writeFileSync(path.join(ROOT,"tools","treemap.json"),JSON.stringify(out));
  console.log("trees",out.trees.length);
  await b.close(); srv.close();
})().catch(e=>{console.error("CRASH:",e);process.exit(1);});
