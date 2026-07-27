# REGICIDE PVP — Handoff v85 (July 2026)

Upload this file at the start of a new chat (or read it from the "Nutcracker Regicide" project) to continue development. Supersedes the v74 handoff.

## What the game is
Browser 50v50 third-person medieval war game, nutcracker-soldier aesthetic. The player is ONE unit among ~110 AI (plus 36 neutral creeps). AoE2-style shared team economy, six ages (Stone → Bronze → Iron → Classical → Medieval → Enlightenment), win by regicide (kill the enemy king, +500 pts). Real main menu (world frozen behind a cinematic orbit until Solo/Host/Join; How-to-Play overlay). Three.js r128 via plain `<script>` tags, NO bundler/modules. Host-authoritative P2P over PeerJS/WebRTC. **NET.PROTO=10** — bump it whenever wire format, world layout, movement rules, or balance stats change (all desync mixed versions).

## User & workflow (John Thompson)
- Project lives at `Desktop\REGICIDE PVP`. **Cowork device-folder sync**: when the folder is connected, write changed files straight back (SendUserFile → device_commit_files) AND still ship a zip every version. Zips exclude `docs/` and `.git/`.
- Publishes via **Netlify Drop**, **hard-refresh required** (PROTO rejects mismatches). Netlify is NOT in the gameplay path. 🐢 indicator = WebRTC relay lane; if relay + lag persist, the fix is a TURN server ($5 VPS + coturn), not code.
- Iterates via screenshots + playtests with a friend (friend hosts, John often RED guest — RED-guest playability is a first-class requirement for every feature).
- Wants: ship a zip EVERY turn, end summaries with a one-line **version log**. Next version: **v86** — John has announced one "final major feature" coming.
- **Balance workflow**: `tools/export_stats.js` dumps every tunable to a sectioned CSV (`node tools/export_stats.js out.csv`; latest lives at `docs/REGICIDE-STATS-v85.csv`). John edits in Excel, sends it back, Claude patches it in. UNITS/BUILDINGS/AGES sections map to 00-data tables; RULES/ECONOMY rows map to inline code (hand-patch + update the exporter's hardcoded rows so it stays truthful). Watch for Excel artifacts ("4-5" → "5-Apr", broken apostrophes). John writes comments in a leading Comment column; review them and ASK before applying when comments conflict (this worked well for v84).

## Build/verify protocol (EVERY turn, non-negotiable)
Work in `/home/claude/regicide/`. Patch via python heredoc `rep(path,old,new,n)` asserting unique markers, or Edit tool. Then:
1. `node --check` every touched file
2. `npm install three@0.128.0 --silent`
3. `node tools/smoketest.js` → must print `ALL SMOKE TESTS PASSED` (~140 assertions incl. 8-min headless campaign, ~45s/run). Run 2-3x.
4. `rm -rf node_modules package.json package-lock.json`
5. `zip -qr /mnt/user-data/outputs/REGICIDE-PVP-vNN.zip . -x "docs/*" ".git/*"` → SendUserFile + sync changed files to the device folder
6. Bump `<p class="verstamp">vNN</p>` in index.html, and PROTO when the change demands it.

### Known stochastic flakes (pre-existing — do NOT chase)
- "an enclosed courtyard blooms into a garden (0 plantings)" — campaign sometimes builds no enclosed courtyard (~1 in 5). Verified flaky on pristine v74.
- "the militia stands down and returns to the fields" — levy stand-down races lingering foes at campaign end.
A run failing ONLY one of these + 2 clean runs = green.

### Smoketest gotchas (each of these bit us)
- `__G` export string ~line 35 lists exported globals; names NOT destructured at line ~39 need `global.__G.NAME`. The export string accepts arrow-function entries (`getT:()=>T`).
- The MENU gate: sim is frozen at load — smoketest calls `NET.uiSolo()` before the first tick loop (there's an assertion pair around it).
- Possession reassigns `player` — `__G.player` is STALE in guest-era tests; use `units.find(u=>u.isPlayer)`.
- Guest-mode stretches: wrap host-only calls with `NET.mode="host"; ...; NET.mode="guest"` / restore `"solo"`.
- **Never assert team-stock deltas across live ticks** — directors spend and economy drips in the same tick. Give the acting unit `u.remote="x"` and assert its exact `.score` instead (awardPts pays humans/remotes only).
- applyLOD tests: the follow-cam LERPS to the player — position the PLAYER (not the camera) and assert the camera actually arrived before asserting visibility.
- `makeUnit` units lack `u.spread` (only spawnTeam sets it) — code touched by tests guards `(u.spread||0)`.
- Test units need explicit `bot:{role:"citizen"}` for bot hooks, or `bot=null` + big hp to stand inert.
- Real three@0.128.0 loads; `document` stubbed (CanvasTexture-safe). `grep -c` exits 1 on 0 matches. Debug harness trick: copy the smoketest stub block into `node -e`, eval the bundle, append probes (stub `setTimeout` and `process.exit(0)` or it hangs).
- Campaign end-state varies — make post-campaign tests deterministic (call managers directly, force timers with `st.respawnAt=-1`, etc.).
- When adding a regression test, VERIFY IT BITES: revert the fix, confirm the test fails, restore. (The ghost-Viking test was vacuous on the first attempt.)

## File map (js/, load order = number order)
- **00-data.js** — CLS (30 classes incl. wilds: wolf/barbarian/viking/vikingboss appended LAST for CLS_KEYS index stability; musketeer has `bayonet:{dmg,rng,cd}`; sword tiers carry `bMult:1.5`), **rps() = the v84 wheel** (see Balance below), BLD (wood-economy buildings, stone fortifications), AGES (600/1200+150/1800+300/2400+500/3000+1000), ageBuff (+6%/age, +15% Enlightenment), MAP{x:212,z:125} half-extents, TCPOS ±175, **CAMPS[6]** ({x,z,r,boss?}: 4 corners r26 at ±(MAP+18), north-mid r26, SOUTH BAY r52 at (0,−169); centers sit r−8 beyond the border = ~8u mouths), CAMP_R=26 BOSS_R=52 CREEP_N=5 BOSS_N=11 CAMP_RESPAWN=180 BOSS_RESPAWN=900 CAMP_CHEST=300 BOSS_CHEST=500, `inCampGround`, **BORDER_FRINGE=9 + walkable(x,z)** (map rect + fringe apron to the mountain feet + camp pockets), `inMenu/menuOrbitT`, awardPts (humans+remotes only), costPts.
- **01-engine.js** — texturedMat, terrainHeight (flats: TCs, road bazaars ±77/17.46 + 0/15.2, ponds, southern bay flat(0,−186,72,24)).
- **02-world.js** — seeded world gen (mulberry32; Math.random restored at EOF), ground plane MAP*2+110/+200, nodes, **roadPoint(t)** (shared by Kings-Road decals AND bazaars; mirror-symmetric), bazaars at BAZAAR_T=[0.28,0.5,0.72] +3.2z beside the ruts (mirror-balanced 99.5/175.7/252.6 from each throne), forests, mountainRing (carved via nearCamp per-camp r+pad), camp decor (dirt disc, fire ring, bones, palisade arc — parametric on C.r), **raidShore** (sand, sea+deep planes, foam arcs, 1.6x wrecked longship with breach/mast/sail/dragon prow/shields, flotsam — parametric on C.r).
- **03-buildings.js** — buildingMesh six ages, BSCALE, roads/gardens/restyle queue, respawnDelay = **max(10, 30 − 1×houses)**, makeBuilding.
- **04-units.js** — buildBodyFor (resets body.scale — the 1.45x chieftain must not leak), rigs: villager wardrobe, sword/pike/bow/musket (**bayonet blade at the muzzle**), cavalry, scout, priest (staff via weaponGrip like villager tools, orb at outward tip), king, **wolf** (quadruped, mule-trot legs, pounce anim keyed on rig==="wolf" gated by u.alive), **barbarian**, **viking/vikingboss** (horned helms, shields on faL, axes; boss 1.45x + cloak), makeUnit (corpse:false init — CRITICAL, see ghosts), setClass (**reloads dragoon ammo**), name tags, animateUnit.
- **05-combat.js** — dealDamage (distress hook skips creep attackers; parry 0.28s window/0.3 block), killUnit (corpse=true lies in state; creep branch → respawnT=Infinity, camp manager owns rebirth; cart branch), respawnUnit (clears corpse/chargeTo, stands body up), **resurrectUnit + RES_CHARGE=2/RES_CD=10/RES_REACH=3.6/RES_PTS=25**, tryAttack (**dragoon pistol rng 15 → musketeer BAYONET branch (steel at arm's length, sword-line counters, 1.5x buildings) → ranged/melee**), tryMeleeAttack/tryRangedAttack (rps applied at every damage callsite incl. projectile/splash paths), **moveUnit clamps to walkable()** (fringe rect fallback), wall routing (_wwp), steerAroundBuildings.
- **06-input.js** — MYTEAM gating, pistol RMB (rng 15, no-regen empty msg), **F=soundCharge, G=toggleRally (both clear chargeTo)**, priest-train tip, inMenu eats hotkeys, build/train menus (market cap 5).
- **07-ai.js** — directors (age buffers B:380/150 R:150/60), findSpot margins, manageBands (kingsguard/missions/rescue/levy), **campStates init** (normal camps roll wolf|barbarian + pack 4-5 with FIXED 5 bodies; bay starts EMPTY, waiting, respawnAt=900, 11 fixed bodies, body 0 = chieftain; posts scale with C.r; st.aggro=C.r−2.5), `_chestShow/_chestHide(st,slotB)`, spawn/clear/collectCampChest (bcast chest events; collect pays stock + score), campNewWave (boss revives all 11 + global announcement; normal rerolls kind/size), **campTick** (host/solo: pickup scan both slots incl. steals → waiting/respawn → wipe drops chest(s); bay drops TWIN food+gold ±2.6x), **updateCreep** (aggro inside st.aggro, hard leash st.r−1.2, calm regen 8%/s), **orderCharge (CHARGE_DIST=85, targets any walkable ground)**, updateBot (creep branch → charge branches [military engages units→buildings→advance→HOLD; siege bombards; healers trail] → rally-follow → bands → citizen).
- **08-ui.js** — msg feed, scoreboard, minimap (window MAP+46/+56, dots CLAMPED to rim, wilds fringe shading, camp nooks, bay sea/sand/wreck, chest markers both slots, neutral creep color), ageUp (restyle waves).
- **09-main.js** — hints (incl. camps/bay/charge/wheel), updatePlayer (priest channel; trader sells at 2.5x), **updatePriestChannel/tryResurrect/ensureResFX** (hold-LMB 2s charge, blue→gold orb/halo/ring, release over corpse, "Not enough faith, wait Xs"), applyLOD (**STRICT boolean visible — `!!(...)`; three.js renders visible=undefined!** corpses stay visible), menuFrame orbit in renderFrame, **towerTarget + updateTowers (castle VOLLEY: 5 arrows @0.15s re-acquired per arrow, then 4.5s cd — DPS-neutral)**, tickBody (guest → inMenu gate → sim: campTick after healTick), corpse topple persists, **dragoon ammo init only (NO regen)**, economyTick, tick heartbeat.
- **10-net.js** — PROTO:10, CLS_KEYS index map, bcast wrappers, hostAdmit (team 0/1 only — creeps can't be possessed), **hostAct: resurrect (priest/corpse/team/reach/cd validated, +2 slack) · charge (orderCharge from guest yaw) · rally (clears chargeTo) · train/build/gate/ageup**, packWorld (+`camps` 2-slot chest state), packSnap DELTA rows (creeps ride free; cls index syncs wave changes), applySnap (corpse set on death transition; cls reconcile), applyWorld (inMenu=false; setClass reconcile; chest slots for late joiners), guestFrame (topple+corpse, priest channel, charge yaw via guestAct, prediction/leash/watchdog), chest event handler (i,k,s), uiSolo/uiHost/uiJoin/uiHowTo (menu wiring; inMenu cleared at all three entries).
- **tools/smoketest.js** — ~140 assertions. **tools/export_stats.js** — the balance CSV generator (keep its hardcoded RULES rows in sync when patching inline scalars!).

## The v84/v85 balance state (the wheel)
anticav 3.8x vs mounted (spearfighter 3-hits scout, 4-hits chariot) · ranged 1.8x vs anticav · sword tiers (NOT musket shot): 1.8x vs ranged, 1.25x vs anticav, 2.0x vs siege, bMult 1.5 vs buildings · cavalry: 1.8x vs ranged, 1.5x vs melee, 1.5x vs siege · scoutline: 1.5x vs ranged, **4.85x vs villager/trader/tradecart** (trader dies in exactly 3), farm trample 4x · projectiles (ranged line + musket ball) 0.15x vs siege engines · artillery FULL damage vs units (uMult removed); ram keeps 0.25 · musketeer bayonet 14dmg/2.6rng/0.8cd with sword-line counters · pistol 6 rounds/life, rng 15, NO regen, reload on re-arm · castle volley 5@0.15s + 4.5s cd · trader 2.5x · respawn max(10,30−houses) · costs: anticav food+wood (v85 FIX — v84 misapplied stone), ranged gold+wood, siege gold+wood, buildings wood-based, tower 250s+100w, castle 500s+150w, fort walls 200s, **fort gate 75s (cheaper than walls — WATCH for gate-spam wall exploit)** · creeps: wolf/barb 155hp, viking 160, chieftain 500 (camps deliberately soloable-ish now).

## Session log (v75→v85)
v75 priest resurrection (hold-LMB 2s channel, 10s faith, corpses persist) · v76 staff re-grip + no siege resurrection · v77 six creep camps (packs, chests, steals, 3-min cycle, PROTO 3) · v78 bazaars onto the Kings Road (roadPoint, mirror-balanced, PROTO 4) · v79 Viking bay raid boss (empty till 15:00, chieftain+10, twin 500 chests, PROTO 5) · v80 CHARGE (F after G rally: attack-move + hold, PROTO 6) · v81 main menu (frozen world, How-to-Play) · v82 ghost fix (visible=undefined!) + camps doubled/recessed (PROTO 7) · v83 walkable fringe to the mountain line (PROTO 8) + chest tests hardened · v84 the great rebalance from John's CSV (wheel/bayonet/volley/pistol/ages/costs, PROTO 9) · v85 anticav cost fix food+wood (PROTO 10).

## Netcode architecture status
HAVE: host-authoritative + validation, client prediction + dead-zone reconciliation + self-healing leash, snapshot interpolation, delta+quantized snaps (15Hz) + reliable events + heartbeat/watchdog, event-based buildings/chests, guest acts for train/build/rally/charge/resurrect/gate/ageup, late-joiner world payload (incl. chest slots), creeps/waves ride the ordinary unit snapshot rows (fixed body counts keep unit ids deterministic).
LACK (deliberate): lag-comp hit rewind; AOI/network LOD (the lever IF battles lag in field tests — battle bursts ~4.5KB×15Hz).

## Open threads / watch list
- **FIELD TEST STILL PENDING**: last real internet session was v67. EVERYTHING since (v68 netcode fixes through v85) is untested between two machines over the internet. First triage: own-body jerks (leash) vs others stuttering (interp) vs hourglass (lane → TURN).
- Host cannot play RED (guest-red works).
- **John's "final major feature" is next (v86).**
- Balance watch: stone pressure (fortifications vs ~3300 map stone), cheap fort gate exploit, camps now soloable (intended), AI directors don't know the new wheel when composing armies, AI ignores camps/charge, bots don't lob-aim catapults.
- Villager mesh count is the render bottleneck if host FPS dips (distance LOD is the fix).
- Menu orbit + How-to-Play text sizes unverified on John's monitor.
- Priest/charge/camp dials all single-line (see Balance + constants above).

## Transcripts
This handoff is the carry-forward; prior-session transcripts are not available in a fresh chat. The "Nutcracker Regicide" project holds this doc (claude/REGICIDE-HANDOFF-v85.md).
