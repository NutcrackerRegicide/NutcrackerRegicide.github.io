/* REGICIDE PVP — sw.js — THE SERVICE WORKER (v128.2)
   ---------------------------------------------------
   Two jobs, and the second one is why this exists now.

   1. ANDROID "ADD TO HOME SCREEN" THAT ACTUALLY INSTALLS. iOS installs from the manifest and the
      apple-mobile-web-app meta tags alone, which is why the iPhone has worked for versions.
      Chrome on Android will not offer a real install — a WebAPK that launches fullscreen with its
      own icon, no browser chrome — unless the site ALSO registers a service worker with a fetch
      handler. manifest.json has been correct all along (name, short_name, start_url, display,
      192 + 512 icons, one maskable). This file was the only missing criterion. Without it Android
      offers a plain bookmark shortcut, which opens in a normal tab and looks nothing like the
      iPhone version.

   2. THE ~29 MB FIRST LOAD AGAINST A BLANK SCREEN, which has been on the open-threads list four
      times. A joining guest stares at white while audio-data.js alone pulls 3.9 MB. After one
      visit everything is local and the cold launch is instant.

   ---- THE DANGER, AND HOW IT IS HANDLED ----
   A service worker that caches too eagerly serves STALE CODE FOREVER, and this game deploys often
   and gates multiplayer on PROTO — a guest running yesterday's bundle gets refused at the door
   with "⚠ other version" and no clue why. So:
     · CACHE is versioned. Bump VERSION on every deploy and every old cache is deleted on activate.
     · HTML and the manifest are NETWORK-FIRST. The document that names the version is never
       served from cache while the network is reachable, so a reload always finds a new build.
     · Everything else is cache-first (the libs and assets that only change with a version bump).
     · skipWaiting + clients.claim, so a new worker takes over on the next load rather than
       idling behind an old tab.
   If this ever misbehaves, unregistering it in devtools returns the site to plain HTTP loading —
   nothing in the game depends on it being there.                                              */

const VERSION="v134.8";
const CACHE="regicide-"+VERSION;

// The shell: enough to boot and show something. Deliberately NOT the whole 29 MB — a first visit
// should not stall on a giant addAll before the page can paint. Everything else lands in the
// cache as it is actually fetched.
const SHELL=[
  "./","./index.html","./manifest.json",
  "./css/style.css",
  "./libs/three.min.js","./libs/peerjs.min.js",
  "./js/00-data.js","./js/01-engine.js","./js/02-world.js","./js/03-buildings.js",
  "./js/04-units.js","./js/05-combat.js","./js/06-input.js","./js/07-ai.js",
  "./js/08-ui.js","./js/09-main.js","./js/10-net.js","./js/11-audio.js",
  "./js/12-touch.js","./js/13-deskui.js"
];

self.addEventListener("install",e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    // one at a time and forgiving: addAll() rejects the WHOLE install if any single file 404s,
    // and a shell list that drifts out of step with the repo would then disable the worker
    // silently and permanently.
    // v132.51 cache:"reload" — MANDATORY, not an optimisation. c.add(u) revalidates against
    // the browser's HTTP cache, so a new worker could refill a brand-new cache with OLD FILES and
    // produce a build that is new in some files and stale in others. That is not a slow update,
    // it is a DIFFERENT PROGRAM: v132.50's 05-combat.js against v132.49's 00-data.js threw
    // ReferenceError on every frame and froze every particle in the game in mid-air.
    await Promise.all(SHELL.map(u=>
      c.add(new Request(u,{cache:"reload"}))
        .catch(err=>console.warn("[sw] skip",u,err&&err.message))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("regicide-")&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;         // PeerJS signalling, STUN/TURN: never touch

  const isDoc=req.mode==="navigate"||url.pathname.endsWith(".html")||
              url.pathname.endsWith("/")||url.pathname.endsWith("manifest.json");

  // v128.3 THE TRAP THIS FILE SET FOR ITSELF, SPRUNG ON A PHONE. The header above says "bump
  // VERSION on every deploy" — and then the very next change to js/04-units.js went out without
  // one. Result: a phone that had installed the v128.2 worker kept serving the OLD unit code out
  // of cache FOREVER. John fixed the head outlines, deployed, reloaded, and his phone showed him
  // the bug he had just paid to have fixed. Desktop looked right because it had no worker.
  //
  // Relying on a human (or me) to remember a constant is not a cache strategy. So the game's own
  // source is now NETWORK-FIRST like the document: js/ and css/ total ~830 KB uncompressed,
  // which is ~200 KB gzipped, and GitHub Pages sends ETags — so in the common case this is a
  // conditional request that comes back 304 Not Modified and costs a few milliseconds. Cache
  // still answers when the network is gone, so offline play is unaffected.
  // Cache-first stays where it earns its keep: libs/ and assets/ — the megabytes that only ever
  // change on a real version bump.
  // v128.7: …with one exception, and it is the one this rule was never written for.
  // js/audio-data.js is 3.9 MB of base64 audio that changes about once a year. It is in js/ for
  // historical reasons only — by the policy stated above it belongs with libs/ and assets/, "the
  // megabytes that only ever change on a real version bump". Network-first was making a phone
  // revalidate it on every single load; cache-first serves it instantly and refreshes it when
  // VERSION changes, which is exactly the contract the rest of the megabytes get.
  const isCode=(url.pathname.includes("/js/")||url.pathname.includes("/css/"))
               &&!url.pathname.endsWith("/audio-data.js");

  if(isDoc||isCode){
    // NETWORK-FIRST for anything that names the build. A cached index.html is how a player ends up
    // running last week's PROTO against today's host and being told they are the wrong version.
    e.respondWith((async()=>{
      try{
        // v128.7 "NETWORK-FIRST" WAS NOT REACHING THE NETWORK. A bare fetch() uses the default
        // cache mode, which consults the browser's own HTTP cache and may answer from it WITHOUT
        // revalidating for as long as the response is fresh — and GitHub Pages ships HTML with a
        // max-age. So the worker faithfully asked for index.html, the browser answered out of its
        // own cache, and the page reported a version that had been superseded ten minutes ago.
        // v128.3's comment already describes the behaviour we want — "GitHub Pages sends ETags,
        // so in the common case this is a conditional request that comes back 304" — but a plain
        // fetch() never guarantees the request is made. `no-cache` does: it always revalidates
        // with the origin, and still takes the cheap 304 when nothing changed.
        // Symptom this cost: John's desktop sat on v128.5 while his phone showed v128.6.
        const fresh=await fetch(req,{cache:"no-cache"});
        // only cache a REAL answer: a 404 or a 5xx stored here would be served back as though it
        // were the file, and the game would boot into a wall of missing-function errors.
        if(fresh&&fresh.ok){const c=await caches.open(CACHE); c.put(req,fresh.clone());}
        return fresh;
      }catch(_){
        const hit=await caches.match(req);
        if(hit)return hit;
        // offline and never cached. For the DOCUMENT, falling back to index.html means the install
        // still opens. For a SCRIPT it would hand the parser a page of HTML — so fail honestly and
        // let the browser report the missing file instead of a syntax error 400 lines in.
        return isDoc?(await caches.match("./index.html"))||Response.error():Response.error();
      }
    })());
    return;
  }

  // CACHE-FIRST for the rest — versioned assets that only change when VERSION does.
  e.respondWith((async()=>{
    const hit=await caches.match(req);
    if(hit)return hit;
    try{
      const fresh=await fetch(req);
      if(fresh&&fresh.status===200&&fresh.type==="basic"){
        const c=await caches.open(CACHE); c.put(req,fresh.clone());
      }
      return fresh;
    }catch(err){
      return hit||Response.error();
    }
  })());
});
