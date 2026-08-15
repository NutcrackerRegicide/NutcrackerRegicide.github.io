#!/usr/bin/env node
/* patch-buffs-A-econ.js — v132.30 BATCH A, the economy half: three of the remaining four.
 *
 * PACK MULE · GILDED HARVEST · RICH SOIL.
 *
 * ⚠ BULWARK (defensive structures cost half) IS DELIBERATELY NOT HERE. It is the only one of the
 *   eighteen that cannot be done as a hook. Build costs are read in TWO different roles — the
 *   affordability GATE that decides whether the UI offers the building, and `pay()` which charges
 *   it — across roughly eight call sites (06-input.js at the place/wall/age gates, plus the
 *   host-side twins in 10-net.js for a guest's build RPC). Discount `pay()` alone and the UI says
 *   "you cannot afford this" about something you can; discount one gate and not another and the
 *   two disagree. It wants a single `costFor(u,type)` that every site routes through, which is a
 *   refactor with its own gate, not a line in a buff patch. Queued for A2.
 *
 * TWO SITES EACH, AGAIN. Gathering and harvesting both exist once for the local player and once
 * for a host-driven remote human. 10-net.js:1213 already carries the note about exactly this trap
 * from the TIMBER HAUL work: "Omitting this is how a feature ships working for the host and
 * silently dead for everyone else."
 *
 * PACK MULE scales the MOVE, not `u.spd`. `u.spd` is a stat that applyBuffStats rewrites from the
 * class table whenever any buff lands, so a load-dependent value written there would be erased at
 * the next visit to the forge. moveUnit is also the single door all three callers pass through —
 * local player, host-driven remote, and the guest's own local prediction — so the buff behaves
 * identically on every screen without a second edit.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){
  return function sub(name,from,to){
    const n=box.o.split(from).length-1;
    if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
    box.o=box.o.split(from).join(to);
  };
}
const P={combat:path.join(__dirname,"..","js","05-combat.js"),
         main:path.join(__dirname,"..","js","09-main.js"),
         input:path.join(__dirname,"..","js","06-input.js"),
         net:path.join(__dirname,"..","js","10-net.js")};
const c={o:fs.readFileSync(P.combat,"utf8")}, m={o:fs.readFileSync(P.main,"utf8")},
      i={o:fs.readFileSync(P.input,"utf8")}, n={o:fs.readFileSync(P.net,"utf8")};
const subC=mk(c), subM=mk(m), subI=mk(i), subN=mk(n);

// ---------- PACK MULE ----------
subC("pack mule",
`function moveUnit(u,dx,dz,dt){
  const len=Math.hypot(dx,dz);
  if(len<0.001)return false;
  dx/=len; dz/=len;
  let nx=u.root.position.x+dx*u.spd*dt;
  let nz=u.root.position.z+dz*u.spd*dt;`,
`function moveUnit(u,dx,dz,dt){
  const len=Math.hypot(dx,dz);
  if(len<0.001)return false;
  dx/=len; dz/=len;
  // PACK MULE (v132.30): a laden villager moves FASTER, to +10% at a full pack. Scaled here and
  // not on u.spd, because u.spd is a stat applyBuffStats rewrites from the class table every time
  // a buff lands — a load-dependent value written there is erased at the next visit to the forge.
  // moveUnit is also the one door all three movers pass through (local player, host-driven remote,
  // and the guest's own prediction), so this reads the same on every screen.
  let _spd=u.spd;
  const _mu=(typeof buffSt==="function")?buffSt(u,"mule"):0;
  if(_mu&&u.cls==="villager"&&u.carry){
    const cap=(typeof carryCap==="function")?carryCap(u):20;
    const load=(u.carry.food||0)+(u.carry.gold||0)+(u.carry.stone||0)+(u.carry.wood||0);
    if(cap>0)_spd*=1+0.10*_mu*Math.max(0,Math.min(1,load/cap));
  }
  let nx=u.root.position.x+dx*_spd*dt;
  let nz=u.root.position.z+dz*_spd*dt;`);

// ---------- GILDED HARVEST, site 1 of 2: the local player ----------
subM("gilded harvest (local)",
`          if(tk>0){n.amount-=tk; player.carry[n.type]+=tk;} // FULL means full — the node stops draining too`,
`          if(tk>0){n.amount-=tk; player.carry[n.type]+=tk;} // FULL means full — the node stops draining too
          // GILDED HARVEST (v132.30): gold ore also feeds the team. Paid straight to the
          // stockpile rather than into the pack, so it is not subject to carry capacity.
          if(tk>0&&n.type==="gold"&&buffSt(player,"alchemy")&&typeof stock!=="undefined"&&stock[player.team]){
            stock[player.team].food+=tk*buffSt(player,"alchemy");
            if(typeof updateResHud==="function")updateResHud();
          }`);

// ---------- GILDED HARVEST, site 2 of 2: a host-driven remote human ----------
subN("gilded harvest (remote)",
`            if(tk>0){n.amount-=tk; u.carry[n.type]+=tk;} // the guest's pack is just as finite`,
`            if(tk>0){n.amount-=tk; u.carry[n.type]+=tk;} // the guest's pack is just as finite
            // GILDED HARVEST — the guest's twin of the 09-main.js site.
            if(tk>0&&n.type==="gold"&&buffSt(u,"alchemy")&&typeof stock!=="undefined"&&stock[u.team]){
              stock[u.team].food+=tk*buffSt(u,"alchemy");
              if(typeof updateResHud==="function")updateResHud();
            }`);

// ---------- RICH SOIL, site 1 of 2: the local player ----------
subI("rich soil (local)",
`      stock[MYTEAM].food+=20; updateResHud();`,
`      stock[MYTEAM].food+=20;
      // RICH SOIL (v132.30): a bigger yield off the same field.
      if(typeof buffSt==="function"&&typeof player!=="undefined"&&buffSt(player,"reaping"))
        stock[MYTEAM].food+=20*buffSt(player,"reaping");
      updateResHud();`);

// ---------- RICH SOIL, site 2 of 2: a host-driven remote human ----------
subN("rich soil (remote)",
`        stock[u.team].food+=20; updateResHud();`,
`        stock[u.team].food+=20;
        // RICH SOIL — the guest's twin of the 06-input.js site.
        if(typeof buffSt==="function"&&buffSt(u,"reaping"))stock[u.team].food+=20*buffSt(u,"reaping");
        updateResHud();`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.combat,c.o); fs.writeFileSync(P.main,m.o);
fs.writeFileSync(P.input,i.o); fs.writeFileSync(P.net,n.o);
console.log("patched — batch A economy hooks (mule, alchemy, reaping); bulwark deferred to A2");
