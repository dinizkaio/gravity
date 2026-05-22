# GRAVITY — Audio

Music tracks live in this folder. The bus loads them on demand and crossfades
between slots as the player moves through the game. Each slot holds a
**playlist** (an array of filenames) — drop in extras and the bus shuffles
them, auto-advances when one ends, and crossfades into the next.

## Slots

The bus is migrating from 3 act-buckets to one slot per chapter as the
14-track soundtrack lands. Chapters that don't have a dedicated track yet
fall back to their act bucket so the music never goes silent.

| Slot   | Used in                                                                 | Currently                       |
|--------|-------------------------------------------------------------------------|---------------------------------|
| `menu` | intro, main menu, map, bestiary, settings, boss intro, game over        | measured-by-the-dark.mp3        |
| `act1` | chapter mode chapter 1 (Awakening)                                      | against-the-crimson-tide.mp3    |
| `ch2`  | chapter mode chapter 2 (Broken Belt — pulsars)                          | timing-the-blink.mp3            |
| `ch3`  | chapter mode chapter 3 (Tides of Jupiter — comets)                      | punto-de-fuga.mp3               |
| `ch4`  | chapter mode chapter 4 (Wanderers — black holes)                        | where-the-weight-settles.mp3    |
| `ch5`  | chapter mode chapter 5 (Threshold — radiation)                          | the-phantom-sign.mp3            |
| `ch7`  | chapter mode chapter 7 (Eye of the Abyss — binary pulsars)              | kinetic-burn.mp3                |
| `act2` | chapter mode chapter 6 (Sea of Shadows)                                 | contra-a-mare-vermelha.mp3      |
| `act3` | chapter mode chapters 8–9 (Tesseract / Aurora)                          | contra-a-mare-vermelha-alt.mp3  |

In **infinite mode** the bus cycles `act1 → act2 → act3` by zone index, so
filling those slots also colours the endless run.

## Adding tracks

1. Drop the file(s) in this folder (`.mp3` / `.ogg` / `.wav` — whatever the
   browser will stream through an `<audio>` element).
2. Open `../audio.js` and add the filename(s) to the slot's array:

   ```js
   const TRACKS = {
     menu: ['menu-loop.mp3'],
     act1: [
       'measured-by-the-dark.mp3',
       'awakening-variation.mp3',     // <- new sibling for act1
     ],
     act2: ['your-new-track.mp3'],
     act3: null,                       // null or [] = silence
   };
   ```

3. Reload. The bus crossfades to the slot's playlist the next time the
   player enters it.

### Playlist behavior

- **Shuffle**: each slot's order is shuffled on first entry. After playing
  through every track once it reshuffles, guaranteeing the next-up isn't
  the one that just finished.
- **Resume**: leaving and returning to the same slot continues the playlist
  where it left off (cursor survives slot changes).
- **Auto-advance + crossfade**: tracks aren't `loop`ed; ~4 s before a track
  ends the bus starts the next one and fades the outgoing one to zero so
  the overlap lands right at its end.
- **Single-track slot**: with just one filename in the array, native `loop`
  takes over — same behavior as before playlists existed.
- **Slot change**: switching slots (e.g. menu → act1) uses a 2 s crossfade,
  shorter than the intra-playlist 4 s, so scene transitions feel snappier.

A slot set to `null` (or `[]`) plays silence — useful while you're still
composing.

## Why filenames and not full paths?

`audio.js` builds a list of candidate URLs for each track: `audio/<file>`
first (works on any normal static host), then jsdelivr CDN URLs as a
backstop. Some preview sandboxes don't serve binary assets reliably —
`ERR_EMPTY_RESPONSE` — and the CDN fallback covers that without needing
any extra configuration.

If you fork or rename the repo, update the `CDN_PREFIXES` array near the
top of `audio.js` accordingly.

## Notes

- **Length**: aim for ~2–4 minute tracks. With a multi-track playlist the
  loop seam is hidden by the crossfade, so the track doesn't have to end
  on the same beat it started.
- **Fade-out at end**: master so the last ~4 seconds can fade naturally —
  the bus already brings the volume to zero on its own (4 s overlap), so
  if your track also has a hard fade-out at the end you'll get a double
  dip. Either leave the last 4 s sustained or accept the deeper dip.
- **Volume**: handled by the bus (Settings → Sound / Music). Master tracks
  at moderate level (peaks around -6 dBFS) so the slider has room to work.
- **Procedural SFX**: orbit capture, boost, collapse, death, phase banner
  are all synthesized in `audio.js` — no sample files needed.
