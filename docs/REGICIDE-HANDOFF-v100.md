# REGICIDE PVP — Handoff v100 (July 2026)

Upload this file at the start of a new chat (or read it from the "Nutcracker Regicide" project) to continue development. Supersedes all prior handoffs. Written at the end of the v99→v100 session (**THE SOUNDSCAPE** — the game finally has sound).

## What the game is
Browser 50v50 third-person medieval war game, nutcracker-soldier aesthetic. The player is ONE unit among ~110 AI (plus 36 neutral creeps). AoE2-style shared team economy, six ages (Stone → Bronze → Iron → Classical → Medieval → Enlightenment), win by regicide (kill the enemy king, +500 pts). Flow: NAME SCREEN → main menu (Solo / Host / Join / How-to-Play / **⚙ Audio Options**) over a frozen cinematic world. Three.js r128 via plain `<script>` tags, NO bundler/modules. Host-authoritative P2P over PeerJS/WebRTC. **NET.PROTO=22** — bump it whenever wire format, world layout, movement rules, placement rules, or balance stats change (all desync mixed versions). Pure-UI/audio changes don't need a bump but keep both machines on the same build anyway. **v100 changed NO wire format — v99 and v100 ARE wire-compatible (a v99 host + v100 guest connect fine), but only v100 clients hear sound.**

## User & workflow (John Thompson)
- Project lives at `Desktop\REGICIDE PVP`. **Cowork device-folder sync**: request the folder with device_request_folder_access at session start, stage all sources to `/home/claude/regicide/`, and when shipping write changed files straight back (SendUserFile → device_commit_files) AND still ship a zip every version. Zips exclude `docs/`, `.git/`, `node_modules/`, and the **`potential sounds/`** working folder (the 1.2 GB raw WAV pack — NEVER zip it).
- **NEW v100 — audio source pack**: `Desktop\REGICIDE PVP\potential sounds\` holds the **Epic Stock Media "Empire Game"** royalty-free SFX library John purchased (618 × 24-bit/96k WAV, 12 categories, ~1.2 GB, indexed by `_Empire_Game_24bit.csv`). It is the SOURCE. Shipped sounds are curated → converted to compressed OGG under **`audio/sfx/*.ogg`** (42 files, ~1.3 MB total). To add/replace a sound: pick a WAV from the pack (grep the CSV by keyword), `ffmpeg -i in.wav -ac 1 -ar 44100 -c:a libvorbis -q:a 5 audio/sfx/<key>.ogg` (mono for SFX, `-ac 2 -q:a 4` for the ambience loop), then register the key in `DEFS` in `js/11-audio.js`.
- Publishes via **Netlify Drop**, **hard-refresh required**. Netlify is NOT in the gameplay path. Status line + host lobby diag as v95+. Field data still pending (last real internet session v67; the whole v95-v100 stack is headless-tested only).
- Iterates via screenshots + playtests with his brother/friend (friend hosts, John often RED guest — **RED-guest playability is a first-class requirement for every feature**; the pattern that works: host-side logic in driveRemote/hostAct, targeted events for guest UI). **v100 audio honors this: guests trigger sound off the same host-driven anim/theatre/snapshot data they already receive — see the guest-parity notes below.**
- Wants: ship a zip EVERY turn, end summaries with a one-line **version log**. Asks design questions when a feature is major — this session he asked for a **full 20-question audio-design interview** before any implementation (answers folded into the SOUNDSCAPE spec below).
- **Balance workflow**: `tools/export_stats.js` dumps every tunable to a sectioned CSV (`node tools/export_stats.js out.csv`; latest at `docs/REGICIDE-STATS-v99.csv`). **v100 added NO balance tunables** (audio is client-side, not in the CSV), so the v99 CSV still stands. Per-sound gains/throttles live in `js/11-audio.js` (`DEFS` gains, `THROTTLE`, `CAPPED`), not the CSV.
- Next version: **v101**.

## Build/verify protocol (EVERY turn, non-negotiable)
Work in `/home/claude/regicide/`. Patch via Edit tool or python heredoc with asserted unique markers.
1. `node --check` every touched file (run from the project dir).
2. `npm install three@0.128.0 --silent`
3. `node tools/smoketest.js` → must print `ALL SMOKE TESTS PASSED` (~290 assertions incl. the v95-v100 sections, ~45s/run). Run 2-3x.
4. `rm -rf node_modules package.json package-lock.json`
5. `zip -qr /mnt/user-data/outputs/REGICIDE-PVP-vNN.zip . -x "docs/*" ".git/*" "node_modules/*" "potential sounds/*"` → SendUserFile + sync changed files (incl. any new `audio/sfx/*.ogg`) to the device folder.
6. Bump `<p class="verstamp">vNN</p>` in index.html, PROTO when demanded, and roll the handoff (project doc `claude/REGICIDE-HANDOFF-vNN.md`, delete the old one, plus device `docs/`).

### Smoketest needs `assets/anims.js`
The headless suite loads `assets/anims.js` (baked Mixamo pools: attack/walk/work) to exercise the retarget path — the **v95 work-pulse** test depends on it (without it `triggerAttackAnim` returns before setting `attackAnimT` and that one test fails). **Stage `assets/anims.js` into the workspace** (it's disabled in the browser build — commented `<script>` in index.html — but the smoketest still needs it). Also stage `libs/` before zipping (the zip must be self-contained for Netlify).

### Known stochastic flakes (pre-existing — do NOT chase)
- "an enclosed courtyard blooms into a garden (0 plantings)" — ~1 in 5.
- "both thrones still stand for the scout test" — rare: a rush AI lands a campaign regicide early.
- "the line HOLDS the far ground (0/3 within 16)" — rare: a sprawled AI town body-blocks the charge line.
- "the militia stands down and returns to the fields" — levy stand-down races lingering foes.
- **A rare run shows a ~12-assert cascade** in the post-campaign combat block — this is a campaign-regicide-early cascade (the block assumes both kings alive), same family as the above, campaign-dependent. A run failing ONLY known flakes + 2 clean runs = green. (v100's audio tests are deterministic and pass every run.)

### Smoketest gotchas (unchanged from v99 — READ before editing tests)
- STRICT-MODE eval bundle: nothing attaches to `global`; every symbol a test touches rides the `__G` export string. **v100 added `Sound,toggleOptions,syncOptionsUI` to `__G` and `"11-audio"` to the `order` array.**
- `Sound.play()` no-ops on the audio graph headless (no AudioContext), but every DECISION helper is pure & asserted (`_decide/_decideKey/_resolve/_panFor/_gainForDist`, plus `_state` for injecting throttle/voice-cap conditions). Spatial `_decideKey` needs `opts._listener={x,z,yaw}` (else it defaults to the live `player`, which may be far → distance-culled).
- gameOver mutes ALL dealDamage; post-campaign combat sections open with `setGameOver(false)`.
- (all other v95-v99 gotchas as before: binary rows via readSnapRows/readBldRows, dodge the full-refresh cadence, isolate buffs, etc.)

## v100 systems (new this session) — THE SOUNDSCAPE
Client-side audio, **NO wire format, PROTO unchanged**. Design from John's 20-question interview: **core subset first, punchy/arcade, hybrid 2D+3D spatial, ~5-8 MB budget** (shipped 1.3 MB), **SFX now / his Suno music later**, ambience bed + per-alert stingers + horn on age-up + cinematic regicide sting, **mute key + per-bus volume (SFX/ambience/music-later/voip-later)**.

- **`js/11-audio.js` — the audio manager** (loads LAST, after 10-net). `const Sound` global (visible to earlier scripts via the shared global lexical env; exported through `__G` for the smoketest). Structure:
  - **4 gain buses**: master → {sfx, ambience, music, voip} → destination. `music`/`voip` buses exist (sliders + persistence) but have no v100 assets — reserved for John's Suno tracks + future voice chat.
  - **`DEFS`** (42 keys): `[busCode, spatial(1=3D), loop, gain]`. **GROUPS**: `play("swing")` picks a random loaded variant (swing1-4, hit1-4, death1-2, bow1-2, arrowhit1-2); single keys are their own group.
  - **Hybrid spatial**: `spatial=1` cues fold in distance rolloff (`gainForDist`: 1 ≤ NEAR 8, 0 ≥ FAR 72) + stereo pan (`panFor`, listener = `player` pos + `camYaw`). `spatial=0` cues (UI/alerts/stingers/ambience) play flat.
  - **Voice-cap + throttle**: combat spam categories (`CAPPED`: swing/hit/death/bow/arrowhit/siege*/march/build/mine/chop/farm/pickup) share a MAXVOICES(24) cap and per-category `THROTTLE` ms; important cues (UI/alerts/signature/deposit/complete/chest/plunder/ageup/regicide) bypass both. So a 50v50 clash never turns to mush, but you always hear the regicide.
  - **Autoplay unlock**: self-wires `pointerdown/keydown/click` → `resume()` (creates the AudioContext, lazy-fetches+decodes all 42 OGGs). **file:// has no `fetch` → silent** (MP needs HTTP anyway; Netlify/http.server are fine).
  - **`Sound.tick(dt)`** (called from tickBody host + guestFrame, beside `tickBoardBang`): keeps the **ambience bed** looping while a game is live (auto-ducks conceptually for future music) and fires a **subtle nearby-march** one-shot when ≥6 moving units are within 34 of you.
  - **Persistence**: mute + per-bus volumes in `localStorage['reg_snd']` (try/catch, node-safe).
- **Options panel** (`#optionsscreen` in index.html, wired by global `toggleOptions/syncOptionsUI/initOptions` in 11-audio): per-bus sliders (Master/SFX/Ambience live; Music/Voice greyed "soon"), a mute button, ⚙ AUDIO OPTIONS button on the start menu, **O** opens it in-game, **M** mutes anywhere (menu, mid-war, end screen).
- **Wired events** (host/solo unless noted; guest parity in parens):
  - Melee **swing** whoosh — `triggerAttackAnim` (04-units), combat lines only (villager/oxen/ranged/siege excluded). *(guest: pulse re-trigger + own attack theatre run this too)*
  - **impact** (melee `hit` / `arrowhit` / `siegehit`) — `dealDamage` (05-combat), keyed by attacker. *(host-only; guest impacts ride swings+deaths)*
  - **death** body-drop — `killUnit` (05-combat, non-king). *(guest: the snapshot alive→dead transition in applySnap)*
  - ranged **bow** / **siegefire** — `shootArrow` (core fn, so host wrapper AND guest fx-theatre both fire it) + `launchLob`.
  - **gather** (chop/mine/farm by resource) — updatePlayer tick (09-main). *(guest: gather-theatre in guestFrame)*
  - **deposit** chime — TC/castle/trader-sale (09-main). *(guest: host-driven — a known small gap, no guest deposit chime yet)*
  - **build** hammer per hit + **complete** chime — `addConstructionHit` (03-buildings). *(guest: `complete` on the bld-row built transition; `build` in guest gather-theatre)*
  - **place** foundation thunk — `confirmPlace` (06-input, host + guest branches).
  - **chest** — `collectCampChest` (07-ai). **plunder** — `killUnit` loot (05-combat).
  - UI **ui_open/ui_confirm/ui_tab** — board/smith/train/build menus + picks (06-input; guests call these via qdraft/smith events → parity).
  - **alert_attack** (your king wounded, 05-combat), **alert_quest** (completeQuest; guest: level-up in the `qst` handler), **alert_buff** (smithPick; guest: `bff` handler, silent on death-wipe).
  - **ageup** horn (your team only, 08-ui `ageUp`; guest: `mineUp` in applySnap). **regicide_win/lose** sting (09-main `endGame`, by MYTEAM; covers guest via the `end` event).

## File map (js/, load order = number order)
- **00-data.js** — CLS (30 classes), rps() v84 wheel, BLD, AGES, MAP/TCPOS/CAMPS, awardPts, QUESTS[25], BUFFS[21], scalars, PERSONALITIES, AI_DIFF.
- **01-engine.js** — texturedMat, terrainHeight.
- **02-world.js** — seeded world gen, bazaars, forests, camps, town boards.
- **03-buildings.js** — buildingMesh, makeBuilding, **addConstructionHit (v100: build + complete SFX)**, damageBuilding.
- **04-units.js** — rigs, makeUnit, setClass, **triggerAttackAnim (v100: swing SFX at top, combat lines)**, animateUnit, name tags, cargo visuals.
- **05-combat.js** — **shootArrow (v100: bow/siegefire)**, launchLob (v100: siegefire), updateProjectiles, **dealDamage (v100: impact + king-attack alert)**, **killUnit (v100: death + plunder SFX)**.
- **06-input.js** — keydown (**v100: M mute, O options**), playerPrimary, **confirmPlace (v100: place)**, board/smith/train/build menus (**v100: ui_open/confirm/tab**), rally/charge.
- **07-ai.js** — directors, **collectCampChest (v100: chest)**, orderCharge, updateBot.
- **08-ui.js** — msg, scoreboard, quest HUD, minimap, **ageUp (v100: ageup horn, MYTEAM)**.
- **09-main.js** — hints, **updatePlayer (v100: gather + deposit SFX)**, quest engine (**completeQuest→alert_quest, smithPick→alert_buff**), **endGame (v100: regicide sting)**, economyTick, tickBody (**v100: Sound.tick**).
- **10-net.js** — **PROTO:22 (unchanged)**. guest handlers (**v100: qst→alert_quest on level-up, bff→alert_buff, ageup, death on alive-flip, complete on bld built, gather/build theatre SFX, Sound.tick in guestFrame**). Everything else as v95-99 (binary snaps, AOI, congestion control, net log, facing relay, guest siege).
- **js/11-audio.js — NEW: the audio manager (see above).**
- **audio/sfx/*.ogg — NEW: 42 curated sounds** (converted from the Empire Game pack).
- **tools/smoketest.js** — ~290 assertions incl. the **v100 SOUNDSCAPE section** (defs/groups/pan/dist/throttle/voice-cap/mute/bus/tick/options, self-calibrating pairs). **tools/export_stats.js** — CSV generator (unchanged; audio not in it).

## Current game systems (quick reference)
- Questing (v87-99), Rally/Charge PERSONAL WARBANDS (v95), Menus/HALL (v92), AI Marshals (v94), Quest Draft/Ox Cart/Plunder (v99). Balance: v84 wheel, farm passive 0.5/s, trader 2.5×, gap 2.2, collection quests 100. **v100 touched NO balance numbers.**

## Session log
… v95 THE NETCODE OVERHAUL · v96 THE FACING RELAY · v97 GUEST SIEGE + BUILDING DIET · v98 THE NET LOG · v99 THE QUEST DRAFT, THE OX CART & THE PLUNDER · **v100 THE SOUNDSCAPE — the game gets sound: a 4-bus client-side audio manager (js/11-audio.js), hybrid 2D+3D positional playback, voice-cap + throttle, 42 curated OGG cues from the Epic Stock Media "Empire Game" pack, wired across combat/economy/building/UI/alerts/age-up/regicide with full RED-guest parity, an options panel + M mute + O menu. SFX now, John's Suno music slots into the reserved `music` bus later. No PROTO bump (client-side).**

## Open threads / watch list
- **AUDIO FIELD TEST PENDING** (all headless): does the 50v50 mix hold up (voice-cap density, throttle values in `THROTTLE`)? positional pan/rolloff feel (NEAR 8 / FAR 72 / PANWIDTH 26)? Does the nearby-march one-shot (≥6 units, 1.3 s) read or annoy? Ambience bed level vs future music.
- **Music (Suno) — deferred**: the `music` bus + slider are wired and ready; drop tracks in and call `Sound.startLoop`-style playback (or add a `music` DEFS entry). Ambience is a nature bed (Temperate Woodland Forest) chosen to sit UNDER a score — duck/lower it when music lands. **Voice chat (voip bus)** also reserved.
- **Known audio gaps (v101 candidates)**: no guest **deposit** chime (host-driven — would need a carry→0 hook on the guest); build-hit SFX on guests only via gather-theatre; no menu-CLOSE (ui_back) or start-menu HTML-button clicks; `file://` solo has no audio (fetch) — fine for Netlify/http.server play.
- **Autoplay**: the AudioContext unlocks on the first click/key; the very first UI clicks before buffers finish decoding are silent (expected).
- Everything from v99's watch list still stands: field-test the whole v95-99 netcode stack, hall registry election, quest balance, v94 AI playtest, host-can't-play-RED.

## Transcripts
This handoff is the carry-forward. The "Nutcracker Regicide" project holds this doc (`claude/REGICIDE-HANDOFF-v100.md`); the device copy is `docs/REGICIDE-HANDOFF-v100.md`. Delete the old v99 handoff.
