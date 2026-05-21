// GRAVITY — Audio
// Web Audio API bus with crossfade music tracks + procedural SFX.
// Lazy init: AudioContext is created on first call, but the browser may keep
// it suspended until the user interacts. A one-shot pointer/key listener
// resumes it and plays any queued track.
//
// Tracks are referenced by SLOT, not by chapter id, so adding new music is
// just an edit to the TRACKS map below. A null slot means "no music here yet"
// — the bus fades out and stays silent.
//
//   menu : intro, main menu, map, bestiary, settings, boss intro, game over
//   act1 : chapter mode chapters 1–3 (Awakening / Broken Belt / Tides of Jupiter)
//   act2 : chapter mode chapters 4–6 (Wanderers / Threshold / Sea of Shadows)
//   act3 : chapter mode chapters 7–9 (Eye of the Abyss / Tesseract / Aurora)
//   In infinite mode the bus cycles act1 → act2 → act3 by zone index.

(function () {
  // ── Manifest. Replace null with a file path under audio/ as tracks arrive. ──
  const TRACKS = {
    menu: 'audio/measured-by-the-dark.mp3',
    act1: 'audio/measured-by-the-dark.mp3',
    act2: null,
    act3: null,
  };

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let currentSrc = null;     // BufferSourceNode currently playing
  let currentKey = null;     // slot key of the currently playing track
  let pendingKey = null;     // slot key the caller most recently asked for
  let muted = { music: false, sfx: false };
  const bufferCache = new Map();

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain(); masterGain.connect(ctx.destination);
      musicGain  = ctx.createGain(); musicGain.connect(masterGain);
      sfxGain    = ctx.createGain(); sfxGain.connect(masterGain);
      applySettings();

      // Autoplay policy: most browsers leave the context suspended until the
      // user interacts. Hook a one-shot listener to resume and flush any
      // queued track the moment the player touches the page.
      if (ctx.state === 'suspended') {
        const resume = () => {
          ctx.resume().then(() => {
            document.removeEventListener('pointerdown', resume, true);
            document.removeEventListener('keydown', resume, true);
            if (pendingKey != null && pendingKey !== currentKey) {
              actuallyPlay(pendingKey);
            }
          }).catch(() => {});
        };
        document.addEventListener('pointerdown', resume, true);
        document.addEventListener('keydown', resume, true);
      }
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function applySettings() {
    if (!ctx) return;
    const s = window.getSettings ? window.getSettings() : { sound: 0.6, music: 0.5 };
    musicGain.gain.value = muted.music ? 0 : s.music;
    sfxGain.gain.value   = muted.sfx   ? 0 : s.sound;
  }

  async function loadBuffer(url) {
    if (!ctx) return null;
    if (bufferCache.has(url)) return bufferCache.get(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      bufferCache.set(url, buf);
      return buf;
    } catch (e) {
      console.warn('[audio] failed to load', url, e);
      bufferCache.set(url, null);
      return null;
    }
  }

  function fadeOutCurrent(duration) {
    if (!currentSrc || !ctx) return;
    const src = currentSrc;
    const g = src.__gain;
    const now = ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + duration);
    } catch (e) {}
    const ms = (duration + 0.1) * 1000;
    setTimeout(() => {
      try { src.stop(); } catch (e) {}
      try { src.disconnect(); g.disconnect(); } catch (e) {}
    }, ms);
    currentSrc = null;
  }

  async function actuallyPlay(key, fadeIn = 2) {
    if (!ctx || ctx.state !== 'running') return;
    if (currentKey === key) return;
    const url = TRACKS[key];

    if (!url) {
      // No track for this slot — just fade the current one out and stay silent.
      fadeOutCurrent(fadeIn);
      currentKey = key;
      return;
    }

    const buf = await loadBuffer(url);
    if (!buf) { currentKey = key; return; }
    // Caller might have changed the request while we were decoding.
    if (pendingKey !== key) return;

    fadeOutCurrent(fadeIn);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    const now = ctx.currentTime;
    g.gain.linearRampToValueAtTime(1, now + fadeIn);
    src.connect(g);
    g.connect(musicGain);
    src.start(now);
    src.__gain = g;
    currentSrc = src;
    currentKey = key;
  }

  function playTrack(key) {
    pendingKey = key;
    ensureCtx();
    if (ctx && ctx.state === 'running') actuallyPlay(key);
  }

  function stopMusic(fadeOut = 1) {
    pendingKey = null;
    if (currentSrc) { fadeOutCurrent(fadeOut); currentKey = null; }
  }

  function setMusicVolume(v) {
    ensureCtx(); if (!ctx) return;
    muted.music = false;
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)), now + 0.1);
  }
  function setSfxVolume(v) {
    ensureCtx(); if (!ctx) return;
    muted.sfx = false;
    const now = ctx.currentTime;
    sfxGain.gain.cancelScheduledValues(now);
    sfxGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, v)), now + 0.1);
  }

  function trackKeyForChapter(id) {
    if (!id || id <= 3) return 'act1';
    if (id <= 6) return 'act2';
    return 'act3';
  }
  function trackKeyForZone(zoneIndex) {
    const i = Math.max(0, zoneIndex | 0);
    return ['act1', 'act2', 'act3'][i % 3];
  }

  // ── Procedural SFX ────────────────────────────────────────────────────────
  // All sfx return immediately if the context isn't ready. They share sfxGain
  // so the Settings slider scales them in one place.

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
    const base = 440 * Math.pow(2, ((turn || 1) - 1) / 6);   // ~one whole tone per turn
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = base;
    const g = ctx.createGain();
    o.connect(g); g.connect(sfxGain);
    ramp(g, 0.24, 0.004, 0.35);
    o.start(now); o.stop(now + 0.4);
    // Octave shimmer
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

  window.AudioBus = {
    playTrack, stopMusic,
    setMusicVolume, setSfxVolume, applySettings,
    trackKeyForChapter, trackKeyForZone,
    sfxCapture, sfxRelease, sfxBoostTurn, sfxCollapse, sfxDeath, sfxPhase,
    TRACKS,
  };
})();
