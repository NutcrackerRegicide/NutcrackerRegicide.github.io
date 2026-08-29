#!/usr/bin/env node
/* patch-farmring-v134.js — v134.1 THE FARM RING.
 *
 * John: "the AI should realize the only buildings to be built around the town center, directly
 * adjacent to it, should be farms."
 *
 * MEASURED FIRST. A campaign's towns, by distance from their own Town Center:
 *   blue  watch_tower@16.7 farm@21.3 farm@22.4 barracks@22.9 house@25.5 house@26.0 watch_tower@27.7 …
 *   red   farm@16.2 farm@19.3 farm@19.9 house@22.0 farm@23.7 house@24.8 barracks@25.3 …
 * Fields and forges interleaved, and a watch tower at 16.7 standing where the corn should be.
 *
 * There was no minimum-distance-from-the-TC rule at all. The only thing holding anything back was
 * generic building-to-building spacing, and that spacing SHRINKS as the town ages: bSpace reads the
 * team's current age and a Town Center's own half-extent drops from 11.26 at Stone to 8.50 at
 * Classical, so the legal ring tightened from ~22 to ~19 exactly as the town filled up.
 *
 * THE RULE (John's numbers): farms 21 to 30 from the Town Center, everything else 30 and out.
 * Walls and gates included — a curtain drawn between a Town Center and its own fields would cut the
 * villagers off from both, which is worse than the thing being fixed.
 *
 * WHY 21 AND NOT ZERO on the inside. A farm is `flat`, so its plot is walkable, but its BARN is a
 * pair of blocking discs at model-local (-4.75,-7.4) r 3.30, scaled by BSCALE.farm 0.6375 and
 * carried at a FIXED world offset because the AI never rotates a farm. Worst case — a field due
 * north — the barn's near edge sits at D-4.72-3.73 from the Town Center's centre, against a box
 * half-extent of 11.90. Under the old spacing (min D 18.77) that is an overlap of 3.15: a sliver of
 * ground inside both colliders and legal in neither, which is precisely the residue the v134.0
 * pathing work could not resolve and had to leave standing. D >= 20.35 clears it; 21 is that with
 * margin, and it is why the ring has an inner edge as well as an outer one.
 *
 * WHERE IT LIVES. validFor, and only validFor. It is the one choke point all nine callers pass
 * through — the human's ghost, the human's commit, the host re-validating a guest's build request
 * (10-net.js:1308), and all five of the AI's spot-finders — so host and guest agree by construction
 * and the AI needs no rule of its own. Putting it in the AI's findSpot instead would leave the
 * player and every guest free to do the thing the rule forbids.
 *
 * WHAT ELSE HAD TO MOVE, and it is the risk in this change. findSpot samples non-farm plots on a
 * ring of 11-37 from the TC with 50 attempts; a 30-unit hole eats most of that and the AI would
 * simply stop building. Its rings move out with the rule — and the turtle's curtain goes from 30 to
 * 34, because a wall plan whose middle segment sits exactly ON the ring is a wall plan one floating
 * point rounding away from being rejected.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const FILES={"js/00-data.js":null,"js/06-input.js":null,"js/07-ai.js":null,"js/10-net.js":null,
  "sw.js":null,"index.html":null};
for(const k in FILES)FILES[k]=fs.readFileSync(path.join(R,k),"utf8");
let failed=[];
function sub(file,name,from,to){
  const n=FILES[file].split(from).length-1;
  if(n!==1){failed.push(file+" · "+name+" (matched "+n+" times, need exactly 1)");return;}
  FILES[file]=FILES[file].split(from).join(to);
}

// ---------------------------------------------------------------------------
// 1. The two numbers, next to the other placement constants.
// ---------------------------------------------------------------------------
sub("js/00-data.js","the ring constants",
`const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5, QUEST_REROLL_MAX=3;`,
`const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5, QUEST_REROLL_MAX=3;
// ---- v134.1 THE FARM RING (John) ----
// "The only buildings to be built around the town center, directly adjacent to it, should be
// farms." So the ground within TC_RING of a Town Center is its own team's FIELDS and nothing else —
// no house, no forge, no tower, and no wall either: a curtain drawn between a Town Center and its
// own corn cuts the villagers off from both.
//
// TC_FARM_MIN is the INNER edge, and it is not decoration. A farm's plot is walkable (\`flat\`) but
// its barn is two blocking discs at model-local (-4.75,-7.4) r 3.30 x BSCALE.farm 0.6375, at a
// fixed world offset because a farm is never rotated. A field due north puts the barn's near edge
// at D-4.72-3.73 from the TC's centre, against a box half-extent of 11.90 — so anything closer than
// 20.35 leaves a sliver of ground that is inside the barn AND inside the Town Center, legal in
// neither, which no push-out can resolve. That sliver is what v134.0's collider work had to leave
// standing. 21 clears it with margin.
//
// Both are measured from the team's OWN Town Center. Building near the ENEMY's is unchanged —
// forward towers are an offensive choice and not this rule's business.
const TC_RING=30;      // no non-farm building of yours may stand within this of your Town Center
const TC_FARM_MIN=21;  // …and a farm may not crowd it either, or its barn stands in the walls`);

// ---------------------------------------------------------------------------
// 2. farmAdjacent: the blessing's outer edge becomes the ring's outer edge.
// ---------------------------------------------------------------------------
sub("js/06-input.js","farmAdjacent reaches to the ring",
`    if(b.type==="towncenter"&&dist2(x,z,b.x,b.z)<26*26)return true;`,
`    // v134.1: 26 -> TC_RING. The ground a Town Center BLESSES for fields and the ground it
    // RESERVES for them are now the same ground, stated once. A blessing that stopped short of the
    // reservation would leave an annulus where nothing at all could be built.
    if(b.type==="towncenter"&&dist2(x,z,b.x,b.z)<TC_RING*TC_RING)return true;`);

// ---------------------------------------------------------------------------
// 3. The rule itself, in validFor — with its own predicate so the messages can name the cause.
// ---------------------------------------------------------------------------
sub("js/06-input.js","the ring predicate and the rule",
`function validFor(type,x,z,team){
  if(team===undefined)team=BLUE;`,
`// v134.1 THE FARM RING, as a predicate of its own so that the refusal MESSAGE can name the real
// cause. "Can't build there — too close to something" is true of this and useless: a player who has
// just been refused four plots in a row around their own Town Center needs to be told the law, not
// reminded that a law exists.
// Returns "" when the ring is not what refuses this plot.
function tcRingReason(type,x,z,team){
  if(typeof teamTC!=="function")return "";
  const tc=teamTC(team); if(!tc)return "";           // the throne has fallen: the ring falls with it
  const d2=dist2(x,z,tc.x,tc.z);
  if(type==="farm")
    return d2<TC_FARM_MIN*TC_FARM_MIN
      ? "That field crowds the Town Center — its barn would stand in the walls. Plant it further out."
      : "";
  if(d2<TC_RING*TC_RING)
    return "Only FARMS may stand beside a Town Center. Build that further out.";
  return "";
}
function validFor(type,x,z,team){
  if(team===undefined)team=BLUE;
  if(tcRingReason(type,x,z,team))return false;   // v134.1 the farm ring — see tcRingReason above`);

// ---------------------------------------------------------------------------
// 4. Tell the player the law, on the way in and on the way out.
// ---------------------------------------------------------------------------
sub("js/06-input.js","pickBuild states the law",
`  if(type==="farm")msg("Farms must border your Town Center or a Storage Pit.");`,
`  if(type==="farm")msg("Farms must border your Town Center or a Storage Pit.");
  // v134.1: and the inverse, for everything else — the ring is invisible, so it has to be spoken.
  else if(!BLD[type].wall)msg("Keep it clear of the Town Center — that ground is for farms.");`);

sub("js/06-input.js","the refusal names the ring",
`  if(!placementValid(x,z)){msg("Can't build there — too close to something.");return;}`,
`  if(!placementValid(x,z)){
    // v134.1: name the real cause where we know it. A generic refusal in front of a rule the player
    // cannot see is how a rule reads as a bug.
    const why=tcRingReason(placing.type,x,z,MYTEAM);
    msg(why||"Can't build there — too close to something.");
    return;
  }`);

sub("js/10-net.js","the guest is told the same thing",
`    if(!validFor(a.type,a.x,a.z,u.team))return deny("Can't build there — too close to something.");`,
`    if(!validFor(a.type,a.x,a.z,u.team)) // v134.1: the guest hears the same reason the host would
      return deny((typeof tcRingReason==="function"&&tcRingReason(a.type,a.x,a.z,u.team))||
                  "Can't build there — too close to something.");`);

// ---------------------------------------------------------------------------
// 5. The AI's sampling rings move out with the rule, or it stops building.
// ---------------------------------------------------------------------------
sub("js/07-ai.js","findSpot: towers, farms and the rest all clear the ring",
`    if(type==="tower"){ // towers screen the approach to the base
      x=tc[0]+(team===BLUE?1:-1)*(16+Math.random()*26); z=(Math.random()-0.5)*66;
    }else if(type==="farm"){ // big fields ring the Town Center
      const a=Math.random()*Math.PI*2,r=12+Math.random()*12;
      x=tc[0]+Math.cos(a)*r; z=tc[1]+Math.sin(a)*r;
    }else{
      const a=Math.random()*Math.PI*2,r=11+Math.random()*26;
      x=tc[0]+Math.cos(a)*r; z=tc[1]+Math.sin(a)*r*0.85;
    }`,
`    // v134.1 EVERY RING MOVES OUT WITH THE FARM RING. These sampled 16-42 (towers), 12-24 (farms)
    // and 11-37 (everything else) from the throne, and validFor now refuses the inside of all
    // three. Fifty attempts against a ring that is mostly illegal is an AI that quietly stops
    // building — the 00-data.js note at BLD.castle records that exact failure costing a release —
    // so the samplers are moved rather than left to fail. Areas are kept comparable: the old
    // general annulus spanned 1248 units of r-squared, the new one 1360.
    if(type==="tower"){ // towers screen the approach to the base, from outside the fields
      x=tc[0]+(team===BLUE?1:-1)*(TC_RING+2+Math.random()*24); z=(Math.random()-0.5)*66;
    }else if(type==="farm"){ // the fields ARE the ring
      const a=Math.random()*Math.PI*2,r=TC_FARM_MIN+0.5+Math.random()*(TC_RING-TC_FARM_MIN-1.5);
      x=tc[0]+Math.cos(a)*r; z=tc[1]+Math.sin(a)*r;
    }else{
      const a=Math.random()*Math.PI*2,r=TC_RING+1+Math.random()*17;
      x=tc[0]+Math.cos(a)*r; z=tc[1]+Math.sin(a)*r*0.85;
    }`);

sub("js/07-ai.js","farmAnchors: the TC's annulus is the ring",
`    if(b.type==="towncenter")list.push({x:b.x,z:b.z,rMin:13,rMax:24});`,
`    // v134.1 the TC's annulus IS the farm ring now — 13-24 sampled ground the rule refuses, and
    // findFarmSpot only gets 60 tries before it gives up and plants a storage pit instead.
    if(b.type==="towncenter")list.push({x:b.x,z:b.z,rMin:TC_FARM_MIN+0.5,rMax:TC_RING-1});`);

sub("js/07-ai.js","the curtain stands outside the ring",
`      const tc=TCPOS[team], front=tc[0]+(team===BLUE?1:-1)*(D.wallFront||30);`,
`      // v134.1: 30 -> 34. The curtain's middle segment sat at exactly TC_RING from the throne, and
      // a wall plan one floating-point rounding away from being refused is a wall plan that will be
      // refused on some machine and not others.
      const tc=TCPOS[team], front=tc[0]+(team===BLUE?1:-1)*(D.wallFront||34);`);

// ---------------------------------------------------------------------------
// 6. The version pair. INVARIANT #4: these two move TOGETHER, every time — a smoketest gate
//    enforces it, and it caught a miss at v132.51.
// ---------------------------------------------------------------------------
sub("sw.js","VERSION",`const VERSION="v134.0";`,`const VERSION="v134.1";`);
sub("index.html","verstamp",
`<p class="verstamp">v134.0 — THE UNWEDGING</p>`,
`<p class="verstamp">v134.1 — THE FARM RING</p>`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
for(const k in FILES)fs.writeFileSync(path.join(R,k),FILES[k]);
console.log("patch-farmring-v134: OK — "+Object.keys(FILES).join(", ")+" written");
