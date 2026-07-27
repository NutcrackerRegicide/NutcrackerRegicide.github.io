# REGICIDE PVP — Handoff v112 (July 2026)

Upload this file at the start of a new chat (or read it from the "Nutcracker Regicide" project) to continue development. Supersedes all prior handoffs. Covers **v107 THE SCORE & THE 90-SECOND ADVANCE** (recap), **v108 THE AUDIT** (recap), **v109 THE MIX FIX & THE VOICES**, **v110 THE WOLVES**, **v111 THE QUIET FIXES**, and this build: **v112 WOLF QUIET + NEW ANTHEMS**. **PROTO stays 23** (v109-v112 are audio-only — v107-v112 clients are wire-compatible).

## v112 WOLF QUIET + NEW ANTHEMS
- **Wolf grounds lose the dark-hiss drone** (John: "loud and kind of weird/not fitting" at wolves). `Sound.tick`'s zone check no longer uses `inCampGround` (static, kind-blind) — it walks `campStates` and arms `wildsdrone` only inside NON-wolf grounds (barbarian/viking keep the dread; wolf camps are carried by the v110 howls). Drone gain also trimmed 0.35→0.26 everywhere.
- **Bronze & Iron anthems REPLACED** with John's new takes (`potential sounds\music\Bronze Age Up2.mp3` / `Iron Age Up2.mp3`) → `audio/music/age1.ogg` (11.4 min) / `age2.ogg` (10.2 min), stereo q3, ~−12 LUFS (MUSTRIM absorbs it). Browser check confirms the new durations load (682 s / 610 s).
- **v111 postscript — the music mystery RESOLVED in the field**: John's `audio\music\` on disk held the raw Suno MP3s under their original names, NOT the age0-5.ogg set the game loads (the v111 missing-files warning caught it). The six OGGs are committed to his disk now. Rule of thumb for John: the game needs `audio\music\age0-5.ogg` next to index.html in WHATEVER copy runs; deploy by dragging the project folder, never a bare zip extract.

## v111 THE QUIET FIXES (field-test feedback: "music not working?", villager grunts)
1. **"Music does not seem to be working"** — root cause is DEPLOYMENT, not code: since v108 the game zip EXCLUDES `audio/music/` (the 30 MB delivery cap), so a fresh zip extract or a zip-dragged **Netlify deploy has NO anthem files** — silent music, no error anywhere. Compounding it: John's saved 10% music slider (tuned against the pre-v109 broken mix) → `0.5 master × 0.1 × 0.6 trim = 0.03` even where files exist. Fixes:
   - **Missing-track diagnostic**: the music `<audio>` element now has an `error` listener → `MU.dead=true` + a one-time feed warning "♪ MUSIC FILES NOT FOUND — this copy has no audio/music/ folder…". Verified in a real music-less Chromium build (error lands ~1 s after the arm; don't panic-debug the first 2 ticks).
   - **Proof-of-life**: when an anthem actually starts, the feed shows "♪ <Age> anthem (M adjusts music volume)".
   - **Autoplay-refusal retry**: a rejected `play()` re-arms up to 3 times on later ticks (`MU.tries`); a hard media error never retries (`MU.dead`).
   - **Prefs key v3→v4** (stale broken-mix sliders reset) + **music default 30%→40%** (el.volume at defaults: 0.8×0.4×0.6=0.192).
   - **DEPLOY RULE for John**: drag the PROJECT FOLDER (which has audio/music/) to Netlify Drop, not a fresh zip extract — or copy audio/music/ into whatever folder gets deployed.
2. **Villager gather grunts REMOVED** (John: they sound like the villagers are being harmed) — the 8% `veffort` on gather ticks is gone on host (09-main) AND guest theatre (10-net). Build-hammer (12%) and garrison-climb (60%) grunts stay.


## v110 THE WOLVES (139 sounds, +2)
John dropped two wolf recordings at `potential sounds\sfx\Wolf SFX\` (Wolf Howl.mp3 7.2s, Wolf Bite.mp3 2.1s). Both ran hot (−14.5/−16.5 LUFS, bite peaking 0 dB) and John asked for them REDUCED → **pre-attenuated −6 dB / −4 dB at conversion** (landing ≈ −21 LUFS, ~5 dB under combat foley) plus modest DEF gains (`wolfhowl` 0.55, `wolfbite` 0.7).
- **`wolfhowl`** — spatial, 6 s category throttle (one howl at a time), deliberately **NOT voice-capped** (atmosphere always lands). Wired in updateCreep for `st.kind==="wolf"` camps: on the hunt a howl every ~10-18 s, at rest a rare idle howl every ~25-60 s per wolf — distance-culled, so it reads as dread when you pass near a wolf camp. Host + `{t:"snd"}` bcast (guests hear it positionally).
- **`wolfbite`** — a wolf-camp creep's melee impact: dealDamage attacker-keying gained a branch (`att.bot.camp.kind==="wolf"` → bite instead of the generic hit). Capped + 300 ms throttle.
- **Human-voice hygiene**: wolf-camp creeps no longer scream like men — v109's pain/death vox now skip `bot.camp.kind==="wolf"` victims on the host; on GUESTS creep replicas carry no `bot`, so the guest death-vox now skips ALL NEUTRAL units (side effect: barbarian death cries are host-audible only — minor, noted). Human growls (vgrowl) now belong to barbarian/viking camps only.
- Smoketest: def count 139 + a v110 wolves check (quiet gains, howl throttle/uncapped, bite capped).

## v109 part 1 — THE MIX FIX (why John's test sounded wrong)
John's field test (master 50 / SFX 50 / music 10): music drowned everything, cannons faint. Two measured causes, both fixed:
1. **v100-era bug: SFX applied bus×master gain TWICE** — once baked into the computed play gain AND once via the live bus/master gain nodes. Sliders were effectively SQUARED for one-shots (50%/50% → −24 dB instead of −12 dB). Loops double-applied the bus slider too. Music (an `<audio>` element outside the graph) applied its volume ONCE — hence "music too loud, cannon quiet." **Fix in 11-audio.js:** `decide`/`decideConcrete` now return BOTH `gain` (full chain — still drives the play/silent DECISION) and `local` (def gain × distance × opts.gain only); `play()` hands the node `dec.local`, `startLoop` hands `d[3]` — the sliders live exclusively on the graph nodes. SFX are now up to 12 dB louder at mid-slider settings; DEF gains unchanged.
2. **Suno masters are hot** (measured ≈ −13.5 LUFS vs −16…−20 for Empire foley) → **`MUSTRIM=0.6`** (−4.4 dB) baked into the anthem volume law: `el.volume = master × music × MUSTRIM × fade`. Music default stays 30%.
- Tests updated: smoketest asserts `local` ignores sliders while `gain` scales (v109 mix check), musVol law includes `A.MUSTRIM`; browsercheck asserts el.volume = master×music×MUSTRIM and now auto-sizes the decode count from `Sound._defs`.

## v109 part 2 — THE VOICES (137 sounds: 79 SFX + 58 human vocals)
From a 24-question interview (6 AskUserQuestion rounds) + the **Gamemaster Audio "Human Vocalizations"** pack John dropped at `potential sounds\sfx\Gamemaster Audio - Human Vocalizations - 24bit 48k\` (NOTE: the WAVs live under a DOUBLED folder of the same name; 1035 files, 7 voices). **Male A is a MODERN soldier voice** (English phrases, mask breathing) — only its wordless grunts are usable; never ship its spoken lines ("go go go" etc — John vetoed).

### Design (John's picks — all implemented)
- **Scope**: death cries + hit/pain reactions + attack shouts + charge war-cries, plus work efforts (garrison/build/gather), civilian voices (mixed male+female), kill-streak growl, creep growls & raid chorus, king's death scream, wounded breathing, block/parry strain. Player = FULL self-voice.
- **Voice identity**: deterministic per unit — soldiers `["b","c","d"][id%3]` (pack Male B/C/D), civilians (line civil/trade) `["a","e","f","g"][id%4]` (Male A grunts + Females A/B/C). Host & guests agree with zero wire bytes. Civilians never war-cry; civilian pain/death is one pool per voice.
- **Deaths**: ~70% of kills cry out (player death ALWAYS), 20% roll the intense variant; LAYERED on the v102 body-drop/gore mix. **King death → `vking` long scream in endGame** beside the regicide sting (2D, uncapped, all clients).
- **Pain**: ~1 in 3 non-lethal hits, graded by damage (<12 mild `vpainm`, <25 `vpain`, else hard `vpainh`) — host-side in dealDamage beside impacts; **guests hear their OWN hits** via an hp-drop hook in applySnap's player row (≥1 hp drop, same 1-in-3 + grading, 2D). Block AND parry add a `veffort` strain grunt.
- **Charges**: `voxChorus(x,z[,n])` — 2-3 distinct soldier voices staggered ~150 ms. Fired in `orderCharge` (covers player F via soundCharge AND AI marshal charges) host-local + `NET.bcast({t:"snd",k:"__chorus",x,z})`; the guest snd handler special-cases `__chorus` → local chorus. Positional, both teams hear charges coming. Viking raid landing adds a 3-voice chorus at the bay + relay.
- **Attack shouts**: ~1 in 4 MELEE-line swings (melee/anticav/royal/cavalry/scoutline gate) in triggerAttackAnim — runs on host AND guest theatre, so parity is free.
- **Efforts**: garrison climb 60%, construction hit 12%, gather tick 8% (host sites + the guest gather-theatre in 10-net) — local-flavor randomness, intentionally not synced.
- **Kill-streak growl**: 3 kills inside 8 s by a human → `vgrowl` (host player local; remote killers get a targeted per-guest `{t:"snd",k:"vgrowl"}`). Creeps growl every 6-10 s while hunting (host + bcast, positional).
- **Wounded breathing**: `vbreath` loop (2D, 0.45) starts under 25% HP in `Sound.tick`, stops on heal/death/menu.
- **Mix**: vocals 0.7-0.9 gains (balanced vs foley), medium density — every vocal category throttled (atk 250 / pain & death 200 / shout 300 / effort 350 / growl 900 ms, PER VOICE since the category is the key-minus-digits) and voice-capped; `vking` bypasses everything.

### Implementation map
- **11-audio.js**: vocal DEFS built by loop right after the literal DEFS (58 keys: `v{atk|painm|pain|painh|death|deathi|shout}_{voice}N`, `vking1`, `veffort1-4`, `vgrowl1-3`, `vbreath` loop); programmatic THROTTLE/CAPPED fill for `v*` cats; `voxVoice/voxKeyFor/vox/voxChorus` (+ exported `_voxVoice/_voxKeyFor`); vbreath in tick. GROUPS folding (strip trailing digits) gives per-voice variant pools — that's why voice ids are LETTERS.
- **05-combat.js**: pain in dealDamage; veffort on block/parry; death vox + kill-streak in killUnit. **04-units.js**: attack shouts in triggerAttackAnim. **09-main.js**: vking in endGame; gather effort. **06-input.js**: garrison efforts. **03-buildings.js**: build effort. **07-ai.js**: chorus in orderCharge + raid; creep hunt growls. **10-net.js**: `__chorus` handler, guest death vox, guest self-pain on hp drop, guest theatre efforts.
- Converted `-vn -ac 1 -ar 44100 -q:a 4`; **audio-data.js regenerated — 137 keys, ~3.9 MB** (regen command unchanged, walks audio/sfx only).

## v107/v108 recaps (still current)
- **v107 THE SCORE**: 6 per-age Suno anthems (`audio/music/age0-5.ogg`, streamed `<audio>`, ~43 MB, NEVER embed), play once per age landing (MYTEAM), ambience ducks to 0.33, anthem fades over the last 15 s of the age-up countdown, music slider live, prefs key `reg_snd_v3`. **THE 90-SECOND ADVANCE**: T pays now, `AGE_RESEARCH_S=90` (stats CSV `age_research_s`), no cancel, HUD countdown bar, AI pays the same toll, `ares` rides snap+world, guests tick display-only. **PROTO 23.**
- **v108 THE AUDIT**: every SFX duration-fingerprinted to its pack source (CSV has ms precision; disambiguate collisions with xcorr — three pack files share 1.692 s). Fixed: spearhit was a horse-filled stables-select (→ Shield_Bash_Knight_2), regicide_lose & cannonhit were both the fiery-treasure-coins sound (→ Dark_1 horn / Cannon_Blast_Heavy_1), hit4 duplicated swinglight1 (→ Sword_Clang_2), 4 files had 27-hour corrupt duration headers (re-encoded). Pack truths: no spears, no predators, no crowd loops in the Empire pack; `Settlement_Select_*` files are ambience-laden building-select beds — never combat foley.

## Workflow / protocol (unchanged core + v109 notes)
Browser 50v50 regicide war game, Three.js r128 no-bundler, PeerJS host-authoritative, **NET.PROTO=23**. John at `Desktop\REGICIDE PVP`; stage sources to `/home/claude/regicide/`; ship a zip EVERY turn (excludes docs/.git/node_modules/"potential sounds"/**audio/music** when the 30 MB delivery cap bites — the v107 music zips remain valid and the device folder holds the tracks); SendUserFile → device_commit_files (**Windows Controlled Folder Access intermittently blocks overwrites of existing files** — when it does, John extracts the zip over the folder; index.html has been the stubborn one). Verify: node --check → npm i three@0.128.0 playwright-core → `node tools/smoketest.js` 2-3× (green = only known flakes + 2 clean; ~310 asserts) → `node tools/browsercheck.js` after ANY audio change (http + file://) → rm node_modules → zip → verstamp/handoff (project doc + docs/). Known flakes: v99-v106 list + rare v107 blacksmith-at-Iron.
- Next version: **v113**.

## Open threads / watch list
- **Music re-test pending** with the v111 diagnostics: John should now either HEAR anthems + see "♪ … anthem" in the feed, or see the missing-files warning that names the fix.
- **WOLF FIELD TEST**: are −6/−4 dB cuts enough (John flagged them loud)? Does the idle-howl cadence (25-60 s per wolf) read as atmosphere or annoyance? Only 2 wolf sources — a second howl/growl variant would help if repetition shows.
- **VOICES FIELD TEST PENDING**: density (1-in-3 pain / 1-in-4 shouts / 70% deaths), per-voice throttles, chorus timing, whether Male D's "attack groan" reads as attack, breathing loop level, MUSTRIM at 0.6, the whole mix post-double-gain-fix (SFX are up to 12 dB louder at mid sliders than every previous test!).
- **Pack depth unused**: 1035 vocal files shipped 58 — screams, chokes, cries, laughs, female intense sets, breath sets all uncurated; easy v110 variety batch if John wants deeper pools.
- Remaining gaps: town crowd walla, pond water zones, guest deposit chime, ui_back, menu-close, start-menu clicks, menu music (Suno).
- Music/advance field test items from v107 still open (duck depth, play-once feel, 90 s pacing per age).
- Older: netcode stack field test, hall registry election, quest balance, v94 AI playtest, host-can't-play-RED.

## Transcripts
Carry-forward: project doc `claude/REGICIDE-HANDOFF-v112.md`, device `docs/REGICIDE-HANDOFF-v112.md`. Delete older handoffs from the project.
