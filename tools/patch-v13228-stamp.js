#!/usr/bin/env node
/* patch-v13228-stamp.js — the wire bump and the version stamps for v132.28.
 *
 * PROTO 33 -> 34, and it is NOT a judgement call. QUESTS is indexed POSITIONALLY on the wire:
 * `qst` ships {qi:questIndex} (09-main.js:379 / 10-net.js:1634) and `qdraft` ships three of the
 * same indices (09-main.js:452). v132.28 DELETES Perfect Guard at position 20 and APPENDS seven
 * rows, so every index above 20 now names a different quest. A v132.27 peer talking to a v132.28
 * peer would show the wrong posting on the board and credit progress to the wrong quest — the
 * failure would look like a quest bug, not a protocol mismatch, which is the worst kind.
 *
 * Node placement did NOT move: tools/nodehash.js run against the pristine v132.27 tree and the
 * patched tree returns the same digests — all=0fadb0bd9cbfae78 · res=263053daf3631497,
 * 743 nodes / 674 wood / 25 stands. Nothing in this version draws from the seeded window.
 *
 * verstamp and sw.js VERSION move together. They are keyed to the same cache: an unbumped
 * VERSION serves the previous build out of the service worker for ever, which has cost a
 * session once already.
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
const P={net:path.join(__dirname,"..","js","10-net.js"),
         html:path.join(__dirname,"..","index.html"),
         sw:path.join(__dirname,"..","sw.js"),
         smoke:path.join(__dirname,"smoketest.js")};
const n={o:fs.readFileSync(P.net,"utf8")}, h={o:fs.readFileSync(P.html,"utf8")},
      w={o:fs.readFileSync(P.sw,"utf8")}, s={o:fs.readFileSync(P.smoke,"utf8")};
const subN=mk(n), subH=mk(h), subW=mk(w), subS=mk(s);

subN("PROTO 33 -> 34",
`  PROTO:33,             // v132.26 the capturable bazaars: \`bz\` is a new field in BOTH payloads and`,
`  PROTO:34,             // v132.28 the quest table: Perfect Guard deleted and seven postings appended,
                        // so every QUESTS index above 20 renames. \`qst.qi\` and \`qdraft.offer\` are
                        // POSITIONAL, so a .27 peer would read the wrong posting off the board.
                        // v132.26 the capturable bazaars: \`bz\` is a new field in BOTH payloads and`);

subH("verstamp",
`  <p class="verstamp">v132.27 — THE TRICKLE COMES DOWN</p>`,
`  <p class="verstamp">v132.28 — EVERY HAND THAT FOUGHT</p>`);

subW("sw VERSION",
`const VERSION="v132.27";`,
`const VERSION="v132.28";`);

subS("smoketest PROTO site 1",
`  check("v132 wire: PROTO is 33 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===33);`,
`  check("v132 wire: PROTO is 34 — the quest table renumbered, and qi/qdraft are positional",NET.PROTO===34);`);

subS("smoketest PROTO site 2",
`  check("v115/v132 net: PROTO 33 (the envelope delta omits fields) and \`ares\` still rides both payloads",
    G.NET.PROTO===33&&`,
`  check("v115/v132 net: PROTO 34 (the quest table renumbered) and \`ares\` still rides both payloads",
    G.NET.PROTO===34&&`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.net,n.o); fs.writeFileSync(P.html,h.o);
fs.writeFileSync(P.sw,w.o); fs.writeFileSync(P.smoke,s.o);
console.log("patched — PROTO 34, verstamp + sw VERSION v132.28");
