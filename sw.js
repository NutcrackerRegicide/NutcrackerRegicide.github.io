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

const VERSION="v128.2";
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
    await Promise.all(SHELL.map(u=>c.add(u).catch(err=>console.warn("[sw] skip",u,err&&err.message))));
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

  if(isDoc){
    // NETWORK-FIRST for anything that names the build. A cached index.html is how a player ends up
    // running last week's PROTO against today's host and being told they are the wrong version.
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const c=await caches.open(CACHE); c.put(req,fresh.clone());
        return fresh;
      }catch(_){
        const hit=await caches.match(req);
        return hit||caches.match("./index.html");        // offline: the install still opens
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
