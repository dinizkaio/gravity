// GRAVITY — Audio
//
// Music plays via HTML5 <audio> elements (much more permissive across
// sandbox iframes than Web Audio decode + buffer source — preview hosts
// often refuse to hand raw bytes to fetch() but happily stream to a media
// element). SFX still use Web Audio so we can synthesize them on the fly.
//
// Tracks are referenced by SLOT, not by chapter id, so adding new music
// is just an edit to the TRACKS map below. Each slot holds a PLAYLIST
// (array of filenames). The bus shuffles the order on first entry,
// crossfades between tracks as one ends, and resumes where it left off
// if the player leaves and returns to the same slot. A null/empty slot
// fades out and stays silent.
//
//   menu           : intro, main menu, map, bestiary, settings, boss intro
//   gameover       : death screen
//   credits        : end credits screen
//   ch1…ch9        : chapter mode chapters 1–9 (one slot per chapter)
//   chase          : Red Tide pursuit (no trigger yet — call playTrack('chase'))
//   infinite-early : infinite mode, zones 0–3 (lighter palettes)
//   infinite-late  : infinite mode, zones 4–7 (denser palettes)

(function () {
  // ── Manifest. Each slot is an array of filenames under audio/. ───────────
  // A single string is also accepted (treated as a 1-track playlist) so old
  // single-track entries keep working. null or [] = silence.
  // sourcesFor() below assembles the actual URLs with a relative path first
  // and CDN fallbacks for sandbox previews that don't serve binary assets.
  const TRACKS = {
    menu:     ['measured-by-the-dark.mp3'],
    gameover: ['a-curva-da-espera.mp3'],
    credits:  ['brillamos-al-final.mp3'],
    ch1: ['against-the-crimson-tide.mp3'],
    ch2: ['timing-the-blink.mp3'],
    ch3: ['punto-de-fuga.mp3'],
    ch4: ['where-the-weight-settles.mp3'],
    ch5: ['the-phantom-sign.mp3'],
    ch6: ['danza-fatal.mp3'],
    ch7: ['kinetic-burn.mp3'],
    ch8: ['limite-cero.mp3'],
    ch9: ['gravity-and-bone.mp3'],
    chase:           ['contra-a-mare-vermelha-alt.mp3'],
    'infinite-early': ['contra-a-mare-vermelha.mp3'],
    'infinite-late':  ['mare-sem-peso.mp3'],
  };

  // Seconds of overlap when one track in a playlist ends and the next begins.
  // The fade-out on the outgoing track is timed to finish right at its end.
  const PLAYLIST_CROSSFADE_S = 4;
  // Fade duration when the SLOT changes (menu → act1, etc.). Longer fades
  // feel right between scenes; shorter ones between sibling tracks.
  const SLOT_CROSSFADE_S = 2;

  // Each filename gets multiple candidate URLs and the <audio> element walks
  // them in order until one streams. Local serves come first (instant on
  // GitHub Pages / localhost / any static host). The jsdelivr CDN backstop
  // covers preview sandboxes whose servers drop binary requests with
  // ERR_EMPTY_RESPONSE — both @main (the canonical post-merge URL) and the
  // current branch (so the very PR that adds this fallback can be tested
  // before being merged).
  const CDN_PREFIXES = [
    'https://cdn.jsdelivr.net/gh/dinizkaio/gravity@main/audio/',
    'https://cdn.jsdelivr.net/gh/dinizkaio/gravity@claude/review-gravity-game-hJ9WJ/audio/',
  ];
  function sourcesFor(filename) {
    return ['audio/' + filename, ...CDN_PREFIXES.map(p => p + filename)];
  }

  // ── Music (HTML5 <audio>) ────────────────────────────────────────────────
  const audioPool = new Map();   // url → HTMLAudioElement (reused on revisits)
  let currentAudio = null;       // element actually playing right now
  let currentKey = null;         // slot that audio belongs to
  let pendingKey = null;         // most recently requested slot
  let musicVolume = 0.5;
  let unlockInstalled = false;
  // Monotonic counter that lets a later tryPlay supersede the async onStarted
  // of an earlier one — otherwise a slow play() promise can resolve after a
  // newer call, leak its audio into the pool still playing, and overwrite
  // currentAudio with stale state.
  let playToken = 0;

  // Per-slot playlist state. Lazily built on first request, invalidated and
  // rebuilt if TRACKS[slot] is edited at runtime (handy for live tweaks via
  // the dev console). `cursor` survives slot changes so revisiting `menu`
  // continues the playlist instead of restarting it.
  //   slot → { order: [filename], cursor: int, source: string, lastPlayed: filename|null }
  const playlists = {};

  function normalizeTracks(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return [value];
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function ensurePlaylist(slot) {
    const files = normalizeTracks(TRACKS[slot]);
    const sig = files.join('|');
    let st = playlists[slot];
    if (!st || st.source !== sig) {
      const order = shuffleInPlace(files.slice());
      // If the first up is the same track that just finished playing in this
      // slot, rotate so the listener never hears the same song back-to-back.
      const lastPlayed = st && st.lastPlayed;
      if (order.length > 1 && order[0] === lastPlayed) {
        order.push(order.shift());
      }
      st = { order, cursor: 0, source: sig, lastPlayed: lastPlayed || null };
      playlists[slot] = st;
    }
    return st;
  }

  function currentFilename(slot) {
    const st = ensurePlaylist(slot);
    return st.order.length ? st.order[st.cursor] : null;
  }

  function advanceCursor(slot) {
    const st = ensurePlaylist(slot);
    if (st.order.length <= 1) return;       // single-track slot — nothing to do
    st.lastPlayed = st.order[st.cursor];
    st.cursor = (st.cursor + 1) % st.order.length;
    // Completed a full pass — reshuffle for the next cycle, but keep the
    // next-up track different from the one we just played.
    if (st.cursor === 0 && st.order.length > 2) {
      shuffleInPlace(st.order);
      if (st.order[0] === st.lastPlayed) st.order.push(st.order.shift());
    }
  }

  function log(...args) {
    if (window.__AUDIO_DEBUG__) console.info('[audio]', ...args);
  }

  function getAudio(filename) {
    if (audioPool.has(filename)) return audioPool.get(filename);
    const a = document.createElement('audio');
    // `loop` is set per-play by attachPlaylistHandler: true for 1-track
    // playlists, false for multi-track (so we can crossfade to the next).
    a.loop = false;
    a.preload = 'auto';
    a.volume = 0;
    // Add every candidate URL as a <source>; the browser drops to the next
    // one on network or decode failure.
    for (const src of sourcesFor(filename)) {
      const s = document.createElement('source');
      s.src = src; s.type = 'audio/mpeg';
      a.appendChild(s);
    }
    a.addEventListener('error', () => {
      const err = a.error;
      console.warn('[audio] all sources exhausted for', filename, err && err.code, err && err.message);
    });
    a.addEventListener('stalled', () => log('stalled', filename));
    a.addEventListener('canplay',  () => log('canplay', filename, '→', a.currentSrc));
    a.load();  // process the source list
    audioPool.set(filename, a);
    return a;
  }

  // Animate audio.volume from `from` to `to` over `duration` seconds.
  // A token guards against overlapping fades on the same element.
  function fadeAudio(audio, from, to, duration) {
    if (!audio) return;
    audio.__fadeToken = (audio.__fadeToken || 0) + 1;
    const token = audio.__fadeToken;
    const start = performance.now();
    function tick() {
      if (audio.__fadeToken !== token) return;       // newer fade superseded us
      const t = duration > 0 ? Math.min(1, (performance.now() - start) / (duration * 1000)) : 1;
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) requestAnimationFrame(tick);
      else if (to <= 0.0001) { try { audio.pause(); } catch (e) {} }
    }
    requestAnimationFrame(tick);
  }

  function ensureUnlockListeners() {
    if (unlockInstalled) return;
    unlockInstalled = true;
    // Never remove these — autoplay policy can revoke at any moment when the
    // tab is backgrounded, and we want to be ready to retry forever.
    const handler = () => {
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
      tryPlay();
    };
    document.addEventListener('pointerdown', handler, { passive: true });
    document.addEventListener('keydown',     handler, { passive: true });
    document.addEventListener('touchstart',  handler, { passive: true });
  }

  // Wire up the timeupdate + ended handlers that drive auto-advance through
  // a multi-track playlist. For single-track playlists we just enable native
  // looping and skip the handlers entirely.
  function attachPlaylistHandler(audio, slot) {
    detachPlaylistHandler(audio);
    const st = ensurePlaylist(slot);
    if (st.order.length <= 1) {
      audio.loop = true;
      return;
    }
    audio.loop = false;
    audio.__pl_slot = slot;
    audio.__pl_advanced = false;

    const tick = () => {
      if (audio.__pl_slot !== slot || audio.__pl_advanced) return;
      const d = audio.duration;
      if (!d || !isFinite(d)) return;
      if (d - audio.currentTime <= PLAYLIST_CROSSFADE_S) {
        audio.__pl_advanced = true;
        advanceCursor(slot);
        if (pendingKey === slot) tryPlay();
      }
    };
    const onEnded = () => {
      if (audio.__pl_slot !== slot || audio.__pl_advanced) return;
      audio.__pl_advanced = true;
      advanceCursor(slot);
      if (pendingKey === slot) tryPlay();
    };
    audio.__pl_tick = tick;
    audio.__pl_onended = onEnded;
    audio.addEventListener('timeupdate', tick);
    audio.addEventListener('ended', onEnded);
  }

  function detachPlaylistHandler(audio) {
    if (!audio) return;
    if (audio.__pl_tick) {
      audio.removeEventListener('timeupdate', audio.__pl_tick);
      audio.__pl_tick = null;
    }
    if (audio.__pl_onended) {
      audio.removeEventListener('ended', audio.__pl_onended);
      audio.__pl_onended = null;
    }
    audio.__pl_slot = null;
    audio.__pl_advanced = false;
  }

  // Fade out every track in the pool except `keep`. Used by tryPlay and
  // stopMusic to silence audios that were abandoned mid-promise — without
  // this sweep, a play() that resolved late stays in the pool playing
  // forever because currentAudio moved on without ever pausing it.
  function silenceAllExcept(keep, fadeS) {
    for (const audio of audioPool.values()) {
      if (audio === keep) continue;
      detachPlaylistHandler(audio);
      if (!audio.paused || audio.volume > 0.001) {
        fadeAudio(audio, audio.volume, 0, fadeS);
      }
    }
  }

  function tryPlay() {
    if (pendingKey == null) return;
    const filename = currentFilename(pendingKey);

    // Slot intentionally silent (null or []) — fade out everything.
    if (!filename) {
      ++playToken;
      silenceAllExcept(null, 1);
      currentAudio = null;
      currentKey = pendingKey;
      return;
    }

    const a = getAudio(filename);

    // Already this track and audibly playing — nothing to do.
    if (a === currentAudio && !a.paused && a.volume > 0.001) {
      currentKey = pendingKey;
      return;
    }

    // Pick the right fade duration: longer when crossing into a different
    // slot, shorter when chaining to the next track inside the same slot.
    const slotChange = currentKey !== pendingKey;
    const fadeS = slotChange ? SLOT_CROSSFADE_S : PLAYLIST_CROSSFADE_S;

    // Bump the play token before we kick off the async play(). Any in-flight
    // onStarted from a previous tryPlay sees the mismatch and bails.
    const myToken = ++playToken;

    // Fade out every other audible track in the pool (not just the previous
    // currentAudio) so anything abandoned by a prior race is silenced too.
    silenceAllExcept(a, fadeS);

    // Invalidate any in-flight fade on `a` itself before we reset its volume.
    // Without this, a fade tick from an earlier silenceAllExcept (when `a`
    // was being faded out as a non-keep audio) keeps running on rAF and
    // overwrites the `a.volume = 0` below on its next frame — the new play()
    // then starts at the old fade's interpolated volume and produces an
    // audible blip until onStarted finally resolves and installs its own fade.
    a.__fadeToken = (a.__fadeToken || 0) + 1;
    a.volume = 0;
    let result;
    try { result = a.play(); } catch (e) { result = Promise.reject(e); }

    const onStarted = () => {
      if (myToken !== playToken) {
        // A newer tryPlay already took over — pause this one so it doesn't
        // keep playing silently in the background.
        try { a.pause(); } catch (e) {}
        return;
      }
      fadeAudio(a, 0, musicVolume, fadeS);
      currentAudio = a;
      currentKey = pendingKey;
      attachPlaylistHandler(a, pendingKey);
      log('playing', pendingKey, '→', a.currentSrc);
    };

    if (result && typeof result.then === 'function') {
      result.then(onStarted).catch(err => {
        if (myToken !== playToken) return;
        console.warn('[audio] play() rejected — waiting for next user gesture.', err && err.message);
        ensureUnlockListeners();
      });
    } else {
      onStarted();
    }
  }

  function playTrack(key) {
    pendingKey = key;
    ensureUnlockListeners();
    tryPlay();
  }

  function stopMusic(fadeOut = 1) {
    pendingKey = null;
    ++playToken;
    silenceAllExcept(null, fadeOut);
    currentAudio = null;
    currentKey = null;
  }

  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, v));
    if (currentAudio) fadeAudio(currentAudio, currentAudio.volume, musicVolume, 0.15);
  }

  // ── SFX (Web Audio) ──────────────────────────────────────────────────────
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let sfxVolume = 0.6;

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain(); masterGain.connect(ctx.destination);
      sfxGain    = ctx.createGain(); sfxGain.connect(masterGain);
      sfxGain.gain.value = sfxVolume;
      if (ctx.state === 'suspended') ensureUnlockListeners();
    } catch (e) {
      ctx = null;
      console.warn('[audio] AudioContext unavailable', e);
    }
    return ctx;
  }

  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    sfxGain.gain.cancelScheduledValues(now);
    sfxGain.gain.setValueAtTime(sfxGain.gain.value, now);
    sfxGain.gain.linearRampToValueAtTime(sfxVolume, now + 0.1);
  }

  function applySettings() {
    const s = window.getSettings ? window.getSettings() : { sound: 0.6, music: 0.5 };
    setMusicVolume(s.music);
    setSfxVolume(s.sound);
  }

  // One slot per chapter. ch1 is also the fallback for unknown/missing ids.
  function trackKeyForChapter(id) {
    if (id === 2) return 'ch2';
    if (id === 3) return 'ch3';
    if (id === 4) return 'ch4';
    if (id === 5) return 'ch5';
    if (id === 6) return 'ch6';
    if (id === 7) return 'ch7';
    if (id === 8) return 'ch8';
    if (id === 9) return 'ch9';
    return 'ch1';
  }
  // Infinite mode has 8 zones (see INFINITE_ZONES in data.js). The first
  // half (blue void → emerald sea, lighter palettes) gets the early track;
  // the second half (crimson twilight → aurora, denser palettes) gets the
  // late one, matching the climb in visual intensity.
  function trackKeyForZone(zoneIndex) {
    const i = Math.max(0, zoneIndex | 0);
    return i < 4 ? 'infinite-early' : 'infinite-late';
  }

  // SFX helpers ──────────────────────────────────────────────────────────────
  function ramp(gain, peak, attack, release) {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  }

  function noiseBuffer(durationS, fade = true) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * durationS));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * (fade ? (1 - t) : 1);
    }
    return buf;
  }

  function sfxCapture() {
    ensureCtx(); if (!ctx || ctx.state !== 'running') return;
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 320;
    const g = ctx.createGain();
    o.connect(g); g.connect(sfxGain);
    ramp(g, 0.22, 0.005, 0.18);
    const now = ctx.currentTime;
    o.start(now); o.stop(now + 0.2);
  }

  function sfxRelease(speed) {
    ensureCtx(); if (!ctx || ctx.state !== 'running') return;
    const dur = 0.18;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700 + Math.min(2000, (speed || 0) * 0.6);
    bp.Q.value = 2;
    const g = ctx.createGain();
    src.connect(bp); bp.connect(g); g.connect(sfxGain);
    ramp(g, 0.22, 0.005, dur);
    src.start(ctx.currentTime);
  }

  function sfxBoostTurn(turn) {
    ensureCtx(); if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const base = 440 * Math.pow(2, ((turn || 1) - 1) / 6);
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = base;
    const g = ctx.createGain();
    o.connect(g); g.connect(sfxGain);
    ramp(g, 0.24, 0.004, 0.35);
    o.start(now); o.stop(now + 0.4);
    const o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = base * 2;
    const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(sfxGain);
    ramp(g2, 0.08, 0.004, 0.25);
    o2.start(now); o2.stop(now + 0.3);
  }

  function sfxCollapse() {
    ensureCtx(); if (!ctx || ctx.state !== 'running') return;
    const dur = 0.7;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, now);
    o.frequency.exponentialRampToValueAtTime(45, now + dur);
    const g = ctx.createGain();
    o.connect(g); g.connect(sfxGain);
    ramp(g, 0.3, 0.02, dur);
    o.start(now); o.stop(now + dur + 0.05);
  }

  function sfxDeath() {
    ensureCtx(); if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, now);
    o.frequency.exponentialRampToValueAtTime(38, now + 1.2);
    const g = ctx.createGain();
    o.connect(g); g.connect(sfxGain);
    ramp(g, 0.38, 0.01, 1.3);
    o.start(now); o.stop(now + 1.4);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.7);
    const gn = ctx.createGain();
    src.connect(gn); gn.connect(sfxGain);
    ramp(gn, 0.18, 0.005, 0.65);
    src.start(now);
  }

  function sfxPhase() {
    ensureCtx(); if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [600, 1200, 1800].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = freq;
      const g = ctx.createGain();
      o.connect(g); g.connect(sfxGain);
      ramp(g, 0.22 / (i + 1), 0.005, 1.4);
      o.start(now); o.stop(now + 1.5);
    });
  }

  function debug() {
    const out = {
      TRACKS,
      playlists: JSON.parse(JSON.stringify(playlists)),
      currentKey, pendingKey,
      currentAudioSrc: currentAudio ? currentAudio.currentSrc : null,
      currentAudioPaused: currentAudio ? currentAudio.paused : null,
      currentAudioVolume: currentAudio ? currentAudio.volume : null,
      currentAudioReadyState: currentAudio ? currentAudio.readyState : null,
      ctxState: ctx ? ctx.state : 'not created',
      musicVolume, sfxVolume,
      unlockInstalled,
    };
    console.table(out);
    return out;
  }

  // Pre-install unlock listeners so even the first SFX call after the user
  // taps wakes up the audio context.
  ensureUnlockListeners();

  window.AudioBus = {
    playTrack, stopMusic,
    setMusicVolume, setSfxVolume, applySettings,
    trackKeyForChapter, trackKeyForZone,
    sfxCapture, sfxRelease, sfxBoostTurn, sfxCollapse, sfxDeath, sfxPhase,
    TRACKS, playlists,
    debug,
  };
})();
