# GRAVITY — Audio

Music tracks live in this folder. The bus loads them on demand and crossfades
between slots as the player moves through the game.

## Slots

| Slot   | Used in                                                                 | Currently                       |
|--------|-------------------------------------------------------------------------|---------------------------------|
| `menu` | intro, main menu, map, bestiary, settings, boss intro, game over        | measured-by-the-dark.mp3        |
| `act1` | chapter mode chapters 1–3 (Awakening / Broken Belt / Tides of Jupiter)  | against-the-crimson-tide.mp3    |
| `act2` | chapter mode chapters 4–6 (Wanderers / Threshold / Sea of Shadows)      | contra-a-mare-vermelha.mp3      |
| `act3` | chapter mode chapters 7–9 (Eye of the Abyss / Tesseract / Aurora)       | contra-a-mare-vermelha-alt.mp3  |

In **infinite mode** the bus cycles `act1 → act2 → act3` by zone index, so
filling those two slots also colours the endless run.

## Adding a new track

1. Drop the file in this folder (`.mp3` / `.ogg` / `.wav` — anything the
   browser decodes via Web Audio API).
2. Open `../audio.js` and update the `TRACKS` map at the top:

   ```js
   const TRACKS = {
     menu: 'audio/menu-loop.mp3',
     act1: 'audio/measured-by-the-dark.mp3',
     act2: 'audio/your-new-track.mp3',   // <- here
     act3: null,
   };
   ```

3. Reload. The bus crossfades to the new track automatically the next time
   the player enters that slot.

A slot set to `null` plays silence — useful while you're still composing.

## Notes

- Tracks loop. Aim for ~2–4 minute loops that fade in and out cleanly so the
  seam is invisible.
- Volume control is handled by the bus (Settings → Sound / Music). Master
  your tracks at moderate level (peaks around -6 dBFS) so the slider has
  room to work.
- All SFX (orbit capture, boost, collapse, death, phase banner) are
  generated procedurally in `audio.js` — no sample files needed.
