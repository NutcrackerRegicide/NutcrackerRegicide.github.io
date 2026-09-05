#!/usr/bin/env node
/* patch-smoketest-farside-v134.js — v134.8: two far-side benches count the walk they are about.
 *
 * THE FINDING, measured on SMOKE_SEED=777 after the v134.8 campaign. "v134.4 far side: a citizen
 * approaching a barracks from the WEST completes its arm-up" went red with "6 sidesteps issued" —
 * and the trace says the arm-up was already DONE in the first second:
 *
 *     ARMUP SPOT -200,-140   units within 25: twelve villagers, six of them red
 *     armup t0s  @-210.7,-139.6  stk=0  cls=clubman      <- already armed
 *     armup t5s  @-197.7,-149.3  stk=1  cls=clubman
 *     armup t25s @-173.0,-151.7  stk=5  cls=clubman
 *
 * It converted, then spent twenty-nine more seconds being an ordinary bot in a crowded corner of
 * the map, and the bench counted those sidesteps against the approach. The assertion is "it walks
 * STRAIGHT in", the number it read was "and then wanders tidily for half a minute afterwards", and
 * which of those you get depends on who else is standing nearby — i.e. on the seed. The hauler
 * bench two blocks up has the same shape: it banks in a few seconds and then keeps running for
 * forty-five, looking for a fresh node with u.bot.node null.
 *
 * THE FIX IS NOT A LOOSER BOUND. Both still demand ZERO sidesteps — that strictness is the whole
 * point of these benches, and the comment on the arm-up says why: given a minute, a body with a
 * watchdog behind it can sidestep its way round a building and stumble onto the lucky side, which
 * is how the first cut passed with the bug restored. They now stop the clock at the event they are
 * about, exactly as the trade-cart bench below them already does (`for(...&&paid<=0)`), so the
 * count covers the approach and nothing else. The time budget is unchanged, so a body that never
 * arrives still fails, and the distance is now reported AT the event rather than wherever the bot
 * happened to wander afterwards.
 */
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const S=path.join(R,"tools","smoketest.js");
let s=fs.readFileSync(S,"utf8");
let failed=[];
const sub=(name,from,to)=>{
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
};

// ---------------------------------------------------------------------------
// 1. THE HAUL — the clock stops when the logs land.
// ---------------------------------------------------------------------------
sub("the haul stops at the bank",
`    const w0=G.stock[0].wood;
    run(u,45);
    const banked=G.stock[0].wood-w0, d=Math.hypot(u.root.position.x-pit.x,u.root.position.z-pit.z);
    const steps=u._stkT||0;`,
`    const w0=G.stock[0].wood;
    // v134.8 STOP AT THE DEPOSIT. \`run(u,45)\` kept ticking for forty-odd seconds after the logs
    // landed — u.bot.node is null, so the villager goes looking for a fresh seam — and every
    // sidestep of that search was charged to an approach that had already finished. Same budget,
    // same zero-sidestep bar, measured over the walk this sentence is about.
    let banked=0, d=0;
    for(let i=0;i<30*45;i++){
      G.updateBot(u,1/30); G.advanceT(1/30);
      banked=G.stock[0].wood-w0;
      if(banked>=20)break;
    }
    d=Math.hypot(u.root.position.x-pit.x,u.root.position.z-pit.z);
    const steps=u._stkT||0;`);

// ---------------------------------------------------------------------------
// 2. THE ARM-UP — the clock stops when he picks up the club.
// ---------------------------------------------------------------------------
sub("the arm-up stops at the conversion",
`    u.convertTo="clubman"; u.convertAt="barracks";
    run(u,30);
    const cls=u.cls, d=Math.hypot(u.root.position.x-bar.x,u.root.position.z-bar.z);
    const steps=u._stkT||0;`,
`    u.convertTo="clubman"; u.convertAt="barracks";
    // v134.8 STOP AT THE CONVERSION — see the note on the haul above. On SMOKE_SEED=777 this one
    // armed inside the first second and then wandered for twenty-nine more among twelve villagers,
    // booking six sidesteps against a walk that was over.
    for(let i=0;i<30*30;i++){
      G.updateBot(u,1/30); G.advanceT(1/30);
      if(u.cls!=="villager")break;
    }
    const cls=u.cls, d=Math.hypot(u.root.position.x-bar.x,u.root.position.z-bar.z);
    const steps=u._stkT||0;`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(S,s);
console.log("patch-smoketest-farside-v134: OK");
