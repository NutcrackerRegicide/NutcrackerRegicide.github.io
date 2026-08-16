#!/usr/bin/env node
/* v132.51 — THE HALF-UPDATED BUILD.
   John, playtesting v132.50, three screenshots of a band of lights hanging over his town:
     "level sparkles should not linger whatsoever and only be at the leveled unit."
   They were not level sparkles. His browser was running new js/05-combat.js against OLD
   js/00-data.js, and auraTick threw ReferenceError: AURA_CURVE is not defined on every frame.
   auraTick is the FIRST statement in updateEffects, so the entire effects pass died with it —
   including the loop that fades puff sprites — and every puff a villager had ever made stayed
   in the air, lit, forever. Reproduced in tools/_mix.js: puffs 0 -> 2 -> climbing, never fading.

   THE ROOT CAUSE IS IN THIS FILE. install() filled the cache with c.add(u), and cache.add goes
   through the BROWSER'S OWN HTTP CACHE. These files ship with no cache headers, so the browser
   applies heuristic freshness and happily hands the worker a copy of yesterday's 00-data.js to
   store under today's cache name. Bumping VERSION was doing exactly what the header promised and
   still shipping stale bytes: the v128.3 trap this file already documents, wearing a new hat.
   cache:"reload" forces the network and bypasses the HTTP cache for these fetches. */
const fs=require('fs'),path=require('path');
const F=path.join(__dirname,'..','sw.js');
let s=fs.readFileSync(F,'utf8');
const old=`    await Promise.all(SHELL.map(u=>c.add(u).catch(err=>console.warn("[sw] skip",u,err&&err.message))));`;
const nw=`    // v132.51 cache:"reload" — MANDATORY, not an optimisation. c.add(u) revalidates against
    // the browser's HTTP cache, so a new worker could refill a brand-new cache with OLD FILES and
    // produce a build that is new in some files and stale in others. That is not a slow update,
    // it is a DIFFERENT PROGRAM: v132.50's 05-combat.js against v132.49's 00-data.js threw
    // ReferenceError on every frame and froze every particle in the game in mid-air.
    await Promise.all(SHELL.map(u=>
      c.add(new Request(u,{cache:"reload"}))
        .catch(err=>console.warn("[sw] skip",u,err&&err.message))));`;
if(s.split(old).length-1!==1){console.error('ABORT: install anchor not unique');process.exit(1);}
s=s.replace(old,nw);
const oldv=`const VERSION="v132.50";`;
if(s.split(oldv).length-1!==1){console.error('ABORT: version anchor not unique');process.exit(1);}
s=s.replace(oldv,`const VERSION="v132.51";`);
fs.writeFileSync(F,s);
console.log('  ok  sw.js: install fetches with cache:"reload", VERSION -> v132.51');
