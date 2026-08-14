#!/usr/bin/env node
/* patch-smoketest-seed.js — two things, both about making a RED mean something.
 *
 * (a) The stone gate I just wrote is itself flaky: it read 6/6 on one run and 5/6 on the next.
 *     Not a regression — the campaign MINES a pile during the run, validFor reads amount, and a
 *     mined-out pile correctly stops refusing a plot. The invariant is about LIVE piles. Same
 *     cause moved "freed by removal" between 2 and 3. Gate the true statement.
 *
 * (b) §7's last open item: seed Math.random in the harness. Three assertions flake across runs —
 *     TURTLE (known, ~1 in 3), "a band is dispatched to the distress point", and "driveRemote:
 *     fake guest gathers". All three are campaign nondeterminism, not bugs, and every one of them
 *     trains the reader to shrug at a red. That is expensive: §2 exists because a red has to be
 *     believable.
 *
 *     This is safe against the seeded window. js/02-world.js:203 captures `__realRandom=Math.random`
 *     at load, swaps in mulberry32(0x20260710) for world gen, and restores that capture at :2416.
 *     Seeding BEFORE the bundle is evaluated means the capture is the seeded stream, world gen is
 *     untouched (it installs its own), and everything below the handback becomes reproducible.
 *     Node placement cannot move: nothing here changes the number of draws inside the window.
 *
 *     SMOKE_SEED=<n> overrides, so a suspected-flaky assertion can be swept across seeds.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("seed the harness",
  "const THREE=require('three'); global.THREE=THREE;",
  "const THREE=require('three'); global.THREE=THREE;\n"+
  "// ---- v132.28: a DETERMINISTIC harness, so a red is a regression and not a dice roll ----\n"+
  "// Must run before the bundle is evaluated: 02-world.js captures Math.random at load time as\n"+
  "// __realRandom, installs its own mulberry32 for world gen, and restores the capture afterwards.\n"+
  "const SMOKE_SEED=(process.env.SMOKE_SEED?parseInt(process.env.SMOKE_SEED,10):0x5E1F)|0;\n"+
  "function __smokeRng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);\n"+
  "  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}\n"+
  "Math.random=__smokeRng(SMOKE_SEED);\n"+
  "console.log('harness RNG seeded:',SMOKE_SEED);");

sub("stone gate: live piles only",
  '    const piles=N.filter(n=>n.type==="stone");\n',
  '    // LIVE piles: the campaign mines one out during the run, and a spent pile correctly stops\n'+
  '    // refusing a plot. Asserting over all six made this gate flake 6/6 -> 5/6 between runs.\n'+
  '    const allPiles=N.filter(n=>n.type==="stone");\n'+
  '    const piles=allPiles.filter(n=>n.amount>0);\n');

sub("stone gate: count text",
  '    check("v114 clearing: EVERY stone pile refuses a plot ("+blocked+"/"+piles.length+")",\n'+
  '      blocked===piles.length&&piles.length===6);',
  '    check("v114 clearing: EVERY LIVE stone pile refuses a plot ("+blocked+"/"+piles.length+\n'+
  '      " live of "+allPiles.length+" sited)",\n'+
  '      blocked===piles.length&&allPiles.length===6&&piles.length>=4);');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");failed.forEach(f=>console.error("  - "+f));process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — seeded harness + live-pile stone gate");
