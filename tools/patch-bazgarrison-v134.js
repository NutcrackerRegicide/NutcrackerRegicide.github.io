#!/usr/bin/env node
/* patch-bazgarrison-v134.js — v134.10: a square you keep losing gets a bigger garrison.
 *
 * John: "They should prioritize towering up at least two to four towers to defend their own bazaar
 * depending on how the game is going and how much pressure — e.g. how many times their bazaar has
 * been captured during the game. If they are losing their bazaar a lot they should be more inclined
 * to protect it."
 *
 * This is the number v134.6 deliberately left alone. Its note reads: "John asked for 3-4 … One each
 * is 750, which a team can pay for out of a corner of its mining without giving up its castle. The
 * number is here, alone on a line, when we know what one plays like." We know now, and the answer
 * is not a bigger constant — it is a constant that reads the game.
 *
 * ── WHAT "A LOT" IS, MEASURED ─────────────────────────────────────────────────────────────────
 * Four seeded 20-minute campaigns, counting how many times each team LOST each square:
 *
 *     seed        grand (blue/red)   west (blue/red)   east (blue/red)
 *     1                3 / 2              0 / 0             0 / 0
 *     42               2 / 2              1 / 1             1 / 1
 *     777              0 / 0              0 / 1             1 / 1
 *     12345            1 / 1              1 / 1             0 / 0
 *
 * The range is 0 to 3, and the Grand — the one on the Kings Road, worth the most and reachable from
 * both thrones — is where the churn is. So the ramp is scaled over 0..2 losses and not over some
 * imagined double figures: two towers on a square you hold, three once you have lost it once, four
 * once you have lost it twice. That uses the whole of John's range on the traffic the map actually
 * produces, and a marshal that never loses a square never spends past the floor.
 *
 * ── AND WHETHER THE STONE IS THERE ────────────────────────────────────────────────────────────
 * Same runs. Stone mined in twenty minutes, per team: 120 · 1785 · 1185 · 2100 · 1300 · 1200 ·
 * 960 · 1420. Stone still IN HAND at the whistle: 20 · 1785 · 1085 · 2020 · 1300 · 1100 · 860 ·
 * 570 — and the map still holding 405 to 1762 in its six piles. The marshals are sitting on it.
 * Two towers on each of three squares is 1,500; four on each is 3,000.
 *
 * ⚠ SO THE RESERVE HAD TO MOVE, and this is the part that is not John's ask but falls out of it.
 * BAZ_TOWER_STONE was 150 — a floor set when the whole feature was one tower a square (750 at the
 * most). Against a garrison that can now want twelve, 150 protects nothing: a CASTLE is 500 stone
 * and a turtle's eight fort walls are 1,600. A frontier that eats the keep behind it is not a
 * defence. The floor is now BLD.castle's own stone cost, derived rather than typed, so a marshal
 * only towers up a square while it can still afford the castle it has not built yet.
 *
 * ── AND THEY STAND ROUND THE SQUARE, NOT IN A HUDDLE ──────────────────────────────────────────
 * bazTowerSpot samples 36 bearings and keeps the legal one NEAREST this throne — right for one
 * tower (v134.6: "the villagers who build it walk from home"), and wrong for four, which would all
 * land on the same home-facing arc and leave the far face of the plaza uncovered by anything. The
 * home preference is kept as a TIE-BREAK behind angular separation, which is MAXIMISED rather than
 * thresholded — each new tower goes in the middle of the widest gap left. A threshold was tried
 * first ("at least 0.6 of your share of the ring") and the gate caught it: three towers landed at
 * 112/124/124 degrees, the fourth needed a 62-degree slot, and the bar refused everything, so a
 * square that had earned four got three. Scoring is also why the first tower still lands where
 * v134.6 wanted it — with no neighbours every candidate scores the same separation and home decides.
 *
 * Same two random draws an iteration, same 36 iterations, so the draw count is unchanged.
 *
 * ── AND HOW MANY THE RING ACTUALLY HOLDS ──────────────────────────────────────────────────────
 * Worth knowing before promising four. Swept offline at 720 bearings x 9 radii with the ground
 * clear, against the game's own validFor:
 *
 *     age            3     4     5
 *     towers that fit  4     4     2
 *
 * A Guard Tower's footprint grows at Enlightenment — BLD.tower.fxA/fzA go from 4.20x9.03 at ages
 * 1-4 to 8.96x9.03 at 5 — and validFor spaces buildings by 0.75 of the smaller one's width, so a
 * ring of 12.1..16.5 runs out of room. The Guard Tower unlocks at age 3, so John's two-to-four is
 * available for the whole of the window it exists in EXCEPT the last age, where a square holds two.
 * Nothing is done about that: an age-5 tower is a bigger building on purpose. The marshal takes
 * what fits — bazTowerSpot answers null and the war room moves on — and the gate asserts both
 * numbers so neither becomes folklore.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const A=path.join(R,"js","07-ai.js"), C=path.join(R,"js","05-combat.js"), W=path.join(R,"js","02-world.js");
let a=fs.readFileSync(A,"utf8"), c=fs.readFileSync(C,"utf8"), w=fs.readFileSync(W,"utf8");
let sw=fs.readFileSync(path.join(R,"sw.js"),"utf8"), h=fs.readFileSync(path.join(R,"index.html"),"utf8");
let failed=[];
const sub=(name,src,from,to)=>{
  const n=src.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return src;}
  return src.split(from).join(to);
};

// ---------------------------------------------------------------------------
// 1. The ledger. Two counters on each square, one per team.
// ---------------------------------------------------------------------------
w=sub("markets carry a loss ledger",w,
`    neutralMarkets.push({x,z,grand:!!B.grand,plaza:B.plaza,owner:-1,cap:0,capTeam:-1,`,
`    // v134.10 \`lost\` is how many times each team has had this square taken off it — the pressure
    // signal the garrison size reads (bazTowerWant). Two integers, no random draw, so the seeded
    // window is untouched; host-side AI memory, nothing the wire carries.
    neutralMarkets.push({x,z,grand:!!B.grand,plaza:B.plaza,owner:-1,cap:0,capTeam:-1,lost:[0,0],`);

c=sub("a capture is recorded against the loser",c,
`function bazaarTaken(m,team,was){`,
`function bazaarTaken(m,team,was){
  // v134.10 THE LEDGER, kept where the flip actually happens rather than sampled by anyone who
  // wants it. \`was\` is already the previous owner — it was being passed in and used for nothing.
  // A square a marshal keeps losing is a square it should be garrisoning harder (bazTowerWant).
  if(was===0||was===1){ if(!m.lost)m.lost=[0,0]; m.lost[was]=(m.lost[was]||0)+1; }`);

// ---------------------------------------------------------------------------
// 2. The dials, and the want.
// ---------------------------------------------------------------------------
a=sub("the garrison dials",a,
`const BAZ_TOWERS=1, BAZ_TOWER_GAP=3.5, BAZ_TOWER_OUT=7, BAZ_TOWER_STONE=150;`,
`// v134.10 TWO TO FOUR, ON THE PRESSURE. John: "they should prioritize towering up at least two to
// four towers to defend their own bazaar depending on … how many times their bazaar has been
// captured during the game. If they are losing their bazaar a lot they should be more inclined to
// protect it." Measured over four seeded 20-minute campaigns, a team loses a given square 0 to 3
// times — the Grand is where the churn is — so the ramp is scaled over that and not over a guess:
// two on a square you hold, and one more for each time you have had it taken off you, to four.
const BAZ_TOWERS_MIN=2, BAZ_TOWERS_MAX=4;
// …and the reserve moves with it. 150 was set when the whole feature was one tower a square; a
// garrison that can want twelve would eat the keep behind it, and a CASTLE is 500 stone. Derived
// from the castle rather than typed, so the two cannot drift apart.
const BAZ_TOWER_GAP=3.5, BAZ_TOWER_OUT=7;
const BAZ_TOWER_STONE=(BLD.castle.cost&&BLD.castle.cost.stone)||500;
// kept for the exporter and the older gates: the FLOOR is what "how many towers a square gets"
// meant when it was one number.
const BAZ_TOWERS=BAZ_TOWERS_MIN;
function bazTowerWant(team,m){ // how big a garrison this square has earned
  const lost=(m&&m.lost&&m.lost[team])||0;
  return Math.max(BAZ_TOWERS_MIN,Math.min(BAZ_TOWERS_MAX,BAZ_TOWERS_MIN+lost));
}`);

// ---------------------------------------------------------------------------
// 3. The ring is a ring.
// ---------------------------------------------------------------------------
a=sub("towers spread round the square",a,
`  const inner=plaza+BAZ_TOWER_GAP;
  const outer=Math.max(inner+1,Math.min(inner+BAZ_TOWER_OUT,(BLD.tower.atk.rng||18)-1.5));
  let best=null,bd=1e12;
  for(let i=0;i<36;i++){
    const a=Math.random()*Math.PI*2, r=inner+Math.random()*(outer-inner);
    const x=m.x+Math.cos(a)*r, z=m.z+Math.sin(a)*r;
    if(Math.abs(x)>MAP.x-6||Math.abs(z)>MAP.z-6)continue;
    if(!validFor("tower",x,z,team))continue;
    const d=dist2(x,z,tc[0],tc[1]);
    if(d<bd){bd=d;best={x,z};}
  }
  return best;`,
`  const inner=plaza+BAZ_TOWER_GAP;
  const outer=Math.max(inner+1,Math.min(inner+BAZ_TOWER_OUT,(BLD.tower.atk.rng||18)-1.5));
  // v134.10 …AND ROUND THE SQUARE, NOT IN A HUDDLE. Keeping the spot nearest home is right for ONE
  // tower and wrong for four: they would all land on the same home-facing arc and leave the far
  // face of the plaza covered by nothing. Each tower wants its share of the ring and will accept
  // 0.6 of it; home stays the TIE-BREAK among the spots that clear that bar, so the v134.6 reason
  // for preferring home — the villagers walk out from there — still decides between equals.
  const want=bazTowerWant(team,m);
  const held=[];
  for(const b of buildings)
    if(b.alive&&b.team===team&&b.type==="tower"&&dist2(b.x,b.z,m.x,m.z)<Math.pow(outer+3,2))
      held.push(Math.atan2(b.z-m.z,b.x-m.x));
  // MAXIMISE the separation rather than threshold it. A pass/fail bar ("at least 0.6 of your
  // share") has a failure mode with teeth: three towers land at 112/124/124 degrees, the fourth
  // needs a 62-degree slot, the bar refuses everything and the square gets three. Scoring by
  // separation puts each new tower in the MIDDLE of the widest gap, which is where four fit.
  // Home is the tie-break, weighted so it decides between equals and never overrides the ring:
  // a throne is ~200 units away, so 0.0008 rad a unit is about nine degrees of pull.
  let best=null,bs=-1e12, near=null,nd=1e12;
  // ⚠ AND THE RING IS SWEPT, NOT SPRINKLED. 36 independent random bearings cover a ring the way
  // buckshot covers a wall, and once one tower stands, validFor refuses everything within 14 of it
  // (r 4 + r 4 + the 6.0 spacing cap) — so the second call would look at 36 lucky-dip bearings and
  // come back empty. The gate caught it on its first run: "1 of 4 towers". A swept bearing with a
  // one-slot jitter visits every part of the ring exactly once. Two draws an iteration either way,
  // so the count is unchanged.
  for(let i=0;i<36;i++){
    const a=(i/36)*Math.PI*2+(Math.random()-0.5)*(Math.PI*2/36);
    const r=inner+Math.random()*(outer-inner);
    const x=m.x+Math.cos(a)*r, z=m.z+Math.sin(a)*r;
    if(Math.abs(x)>MAP.x-6||Math.abs(z)>MAP.z-6)continue;
    if(!validFor("tower",x,z,team))continue;
    const d=dist2(x,z,tc[0],tc[1]);
    if(d<nd){nd=d;near={x,z};}                       // …the old rule, kept as the fallback
    let sep=Math.PI;
    for(const t of held){
      const g=Math.abs(((a-t+Math.PI*3)%(Math.PI*2))-Math.PI);
      if(g<sep)sep=g;
    }
    const score=sep-Math.sqrt(d)*0.0008;
    if(score>bs){bs=score;best={x,z};}
  }
  // …and if the ring is so hemmed in that nothing legal was found at all, the old rule still
  // answers: a marshal that builds nothing because it cannot build TIDILY is worse than a huddle.
  return best||near;`);

// ---------------------------------------------------------------------------
// 4. The war room asks for the garrison the square has earned.
// ---------------------------------------------------------------------------
a=sub("the garrison size is per square",a,
`      if(have>=BAZ_TOWERS)continue;`,
`      if(have>=bazTowerWant(team,m))continue; // v134.10: two, plus one a capture, to four`);

// ---------------------------------------------------------------------------
// The version pair. INVARIANT #4 — a smoketest gate enforces it.
// ---------------------------------------------------------------------------
{
  const a1=`const VERSION="v134.9";`, b1=`const VERSION="v134.10";`;
  const a2=`<p class="verstamp">v134.9 — THE SCREEN FACES THE LANES</p>`,
        b2=`<p class="verstamp">v134.10 — WHAT IT COSTS TO KEEP A SQUARE</p>`;
  if(sw.split(a1).length-1!==1)failed.push("sw.js VERSION (need exactly 1)");
  else sw=sw.split(a1).join(b1);
  if(h.split(a2).length-1!==1)failed.push("index.html verstamp (need exactly 1)");
  else h=h.split(a2).join(b2);
}

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(A,a); fs.writeFileSync(C,c); fs.writeFileSync(W,w);
fs.writeFileSync(path.join(R,"sw.js"),sw);
fs.writeFileSync(path.join(R,"index.html"),h);
console.log("patch-bazgarrison-v134: OK");
