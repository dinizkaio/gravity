// GRAVITY — Audio
//
// Music plays via HTML5 <audio> elements (much more permissive across
// sandbox iframes than Web Audio decode + buffer source — preview hosts
// often refuse to hand raw bytes to fetch() but happily stream to a media
// element). SFX still use Web Audio so we can synthesize them on the fly.
//
// Tracks are referenced by SLOT, not by chapter id, so adding new music
// is just an edit to the TRACKS map below. A null slot fades out and
// stays silent.
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
    act1: 'audio/against-the-crimson-tide.mp3',
    act2: 'audio/contra-a-mare-vermelha.mp3',
    act3: 'audio/contra-a-mare-vermelha-alt.mp3',
  };

  // ── Music (HTML5 <audio>) ────────────────────────────────────────────────
  const audioPool = new Map();   // url → HTMLAudioElement (reused on revisits)
  let currentAudio = null;       // element actually playing right now
  let currentKey = null;         // slot that audio belongs to
  let pendingKey = null;         // most recently requested slot
  let musicVolume = 0.5;
  let unlockInstalled = false;

  function log(...args) {
    if (window.__AUDIO_DEBUG__) console.info('[audio]', ...args);
  }

  function getAudio(url) {
    if (audioPool.has(url)) return audioPool.get(url);
    const a = new Audio(url);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    a.addEventListener('error', () => {
      const err = a.error;
      console.warn('[audio] element error for', url, err && err.code, err && err.message);
    });
    a.addEventListener('stalled', () => log('stalled', url));
    a.addEventListener('canplay',  () => log('canplay', url));
    audioPool.set(url, a);
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

  function tryPlay() {
    if (pendingKey == null) return;
    const url = TRACKS[pendingKey];

    // Slot intentionally silent — fade out whatever is playing.
    if (!url) {
      if (currentAudio) {
        fadeAudio(currentAudio, currentAudio.volume, 0, 1);
        currentAudio = null;
      }
      currentKey = pendingKey;
      return;
    }

    const a = getAudio(url);

    // Already this track and audibly playing — nothing to do.
    if (a === currentAudio && !a.paused && a.volume > 0.001) {
      currentKey = pendingKey;
      return;
    }

    // Crossfade out the previous track if it's a different element.
    const old = currentAudio;
    if (old && old !== a) fadeAudio(old, old.volume, 0, 2);

    // Start at silent and play; bail to the unlock listener if autoplay refuses.
    a.volume = 0;
    let result;
    try { result = a.play(); } catch (e) { result = Promise.reject(e); }

    const onStarted = () => {
      fadeAudio(a, 0, musicVolume, 2);
      currentAudio = a;
      currentKey = pendingKey;
      log('playing', pendingKey, url);
    };

    if (result && typeof result.then === 'function') {
      result.then(onStarted).catch(err => {
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
    if (currentAudio) {
      fadeAudio(currentAudio, currentAudio.volume, 0, fadeOut);
      currentAudio = null;
    }
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

  function trackKeyForChapter(id) {
    if (!id || id <= 3) return 'act1';
    if (id <= 6) return 'act2';
    return 'act3';
  }
  function trackKeyForZone(zoneIndex) {
    const i = Math.max(0, zoneIndex | 0);
    return ['act1', 'act2', 'act3'][i % 3];
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
    TRACKS,
    debug,
  };
})();
