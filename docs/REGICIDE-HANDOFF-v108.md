# REGICIDE PVP — Handoff v108 (July 2026)

Upload this file at the start of a new chat (or read it from the "Nutcracker Regicide" project) to continue development. Supersedes all prior handoffs (v107 covered THE SCORE + the 90s advance; that section is reproduced in brief below since v107's doc is superseded).

## v108 THE AUDIT (79 SFX, 8 files rebuilt — audio-only, **PROTO stays 23**)
A full QA/QC pass over every SFX shipped in v100-v106, prompted by John hearing a HORSE when re-arming as anti-cavalry. Method (now reusable): the Empire pack CSV has **millisecond-precision durations**, and vorbis conversion preserves duration to <1 ms — so every shipped OGG was **fingerprinted back to its true pack source** by duration match, disambiguated with normalized cross-correlation (numpy, decode via ffmpeg), and spectrally sanity-checked (centroid / low-mid ratio / t90 decay). 15 candidate WAVs were staged from the device pack to settle collisions.

### Defects found & fixed (all shipped in v108)
1. **`spearhit.ogg` was a STABLES SELECT sound** (`Settlement_Select_Military_Stables_Bass_Wood_Hit_Accent_1.wav` — despite the name, it's a stables ambience full of horse; centroid 3 kHz, no bass). The pack contains **zero spear sounds** — v102 keyword-matched into the wrong family. It fired on every anticav impact AND as the v106 anticav arm-up signature → John's horse. **Rebuilt from `Warfare_Shield_Bash_Wood_Metal_Weapon_Impact_Fight_Knight_2.wav`** (punchy wood/metal weapon impact, 1.35 s, t90 0.23 s). The arm-up ROUTING was verified correct all along (`armupFor`→infantry cheer, `armupSig`→spearhit).
2. **`regicide_lose.ogg` was the FIERY TREASURE COINS sound** (xcorr 0.998 vs `Collect_Explosion_Upgrade_Fiery_Treasure_Coins_1.wav`) — losing the game played a treasure jingle. **Rebuilt from `Settlement_Alert_Government_Attacked_Destroyed_Horn_Alert_Tone_Dark_1.wav`** (4.8 s dark cinematic horn, low-heavy).
3. **`cannonhit.ogg` was ALSO the fiery treasure coins** (xcorr 0.973) — cannonball impacts jingled. **Rebuilt from `Warfare_Cannon_Blast_Explosion_Impact_Heavy_1.wav`.** (Three pack files share the 1.692 s duration — that collision is how v102 shipped the wrong one. `bighaul` intentionally IS the fiery-treasure sound and stays.)
4. **`hit4.ogg` was byte-identical to `swinglight1.ogg`** (xcorr 1.000, both `Warfare_Dagger_1`) — a swing slash sat in the impact rotation. **Rebuilt from `Warfare_Sword_Swoosh_Clang_2`.**
5. **`blacksmith/pickup/swing2/swing4.ogg` had corrupted container durations (~27 HOURS)** — broken ogg granule headers, probably from the v101 theora-strip `-c:a copy`. Playback was unaffected (decodeAudioData reads packets) but tooling choked. **Re-encoded from decoded PCM; content verified correct.**

### Verified CLEAN (so nobody re-audits these)
All other 71 files fingerprint to sensible sources: stonecrumble=UI_Building_Crumble ✓, deathheavy=Armor_Plate_Chainmail ✓ (NOT the same-duration Foley_Tool_Slide), gore1/2=Blood_Squirt_1/2 ✓, swinglight1/2=Dagger_1/2 ✓, farm=Herbalism_Twig_Grab ✓ (NOT the same-duration catapult creak), raze=Demolish_Crumble ✓, complete=Production_Bell ✓, ambience=Woodland_Forest ✓ ≠ water=Ocean ✓ (xcorr 0.014), hooves/march=Group_Footsteps ✓, armup_infantry/cavalry/civilian=the three Warfare_Unit_UI cheer/recruit files ✓, neigh=Horse_Noise_1 ✓, block=Bow_Release_Ping_Twang ✓, parry=Metal_Sword_Shing ✓, gun/cannonfire/siegefire/siegehit ✓, all UI/alerts ✓.
- Rebuilt-file identity confirmed by xcorr vs intended sources: 0.993-0.999 across all four; new spearhit vs the old stables sound: 0.097.
- **After ANY future sample change: regenerate `js/audio-data.js`** (done for v108; still 79 keys, ~2.7 MB) — the audit tooling lives in this handoff's method description; the duration-fingerprint one-liner is trivial to rebuild.

### Pack truths learned (don't relearn them)
- The pack has **NO spear/polearm sounds, NO wolves/predators (Animals = cow/pig/sheep/birds/horse only), NO human vocals beyond the 3 Unit_UI cheer/recruit files, NO crowd walla loops** (tavern/market exist only as one-shot "select" stingers). Wolf/barbarian/viking vocals and death grunts require an external pack — John must source one.
- Three pack files share duration 1.692 s (Fiery_Treasure, Sacked_Treasure_Horn_Dark_3, Cannon_Blast_Heavy_1); duration-matching alone cannot distinguish them — xcorr required.
- `Settlement_Select_*` files are RTS building-select beds (often with animal/ambience content) — never use them as combat foley.

## v107 recap (still current, see superseded v107 doc for detail)
**THE SCORE**: 6 per-age Suno anthems (`audio/music/age0-5.ogg`, ~43 MB, streamed `<audio>` NOT embedded — works file://), play ONCE per age landing (Stone at match start, MYTEAM only), ambience ducks to 0.33 while playing, anthem fades out over the last 15 s of the age-up countdown, music slider live @ 30% default, prefs key `reg_snd_v3`. **THE 90-SECOND ADVANCE**: T pays now, `AGE_RESEARCH_S=90` (in stats CSV), no cancel, HUD countdown bar, AI pays the same toll, `ares:[b,r]` rides snap+world payloads, guests tick display-only. **PROTO 23.** `tools/browsercheck.js` = real-Chromium audio verification (http + file://; run after ANY audio change; game globals are lexical — use bare names in page.evaluate).

## What the game is / workflow / protocol
Unchanged from v106/v107: browser 50v50 regicide war game, Three.js r128 no-bundler, PeerJS host-authoritative, **NET.PROTO=23**. John at `Desktop\REGICIDE PVP` (Cowork device-folder sync; zips exclude docs/.git/node_modules/"potential sounds"; music adds ~43 MB so the game zip ships WITHOUT `audio/music/` when the 30 MB delivery cap bites — the two v107 music zips remain valid, and the device folder holds the tracks). Build protocol: node --check → npm i three@0.128.0 → smoketest 2-3× (green = only known flakes + 2 clean) → browsercheck after audio changes → rm node_modules → zip → SendUserFile + device_commit_files → verstamp/handoff. **Windows Controlled Folder Access has been BLOCKING overwrites of existing files via device_commit_files** (new files write fine) — John either allowlists the Claude app (Windows Security → Ransomware protection) or extracts the shipped zip over the folder himself. Known flakes: the v99-v106 list + the rare v107 blacksmith-at-Iron campaign flake.
- Next version: **v109**.

## Open threads / watch list
- **Creature/voice pack — the biggest remaining audio gap** (John asked; confirmed the Empire pack cannot cover it): wolf/creep camp vocals, barbarian/viking war-cries for raids & camps, human death grunts/battle shouts. Needs John to buy/source a pack; wire points already exist (killUnit death mix, campTick/campNewWave, updateCreep aggro).
- Second tier of gaps: town/market crowd bed near own base (pack lacks walla), pond water zones (only the bay is zoned), guest deposit chime, ui_back/menu-close cues, start-menu button clicks, menu music (Suno, "eventually").
- Music & advance field test pending (30% level, duck depth, play-once feel, 90 s pacing per age).
- Everything older: netcode stack field test, hall registry election, quest balance, v94 AI playtest, host-can't-play-RED.

## Transcripts
Carry-forward: project doc `claude/REGICIDE-HANDOFF-v108.md`, device `docs/REGICIDE-HANDOFF-v108.md`. Delete the v107 project doc.
