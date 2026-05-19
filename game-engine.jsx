// GRAVITY — Game Engine
// Mode-aware: 'chapter' (story) or 'infinite' (endless w/ background zones).
// Rising mechanic: player launches up, gravity pulls down, orbits boost altitude.
// Lose by falling below the regression horizon.
//
// Props:
//   chapter  — CHAPTERS entry (story mode) or null (infinite)
//   mode     — 'chapter' | 'infinite'
//   paused   — when true, update() is skipped (render continues)
//   onPause  — () => void, called when player taps the HUD pause button
//   onDeath  — (score, distance, reasonKey) => void; reasonKey ∈ {'asteroid','regression','nopush','default'}

const { useEffect, useRef, useState } = React;

function GameCanvas({ chapter, mode, paused, onPause, onDeath }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [zoneKey, setZoneKey] = useState('');
  const [zoneJustChanged, setZoneJustChanged] = useState(false);

  // Keep latest paused flag readable inside the rAF closure without re-running the engine effect
  const pausedRef = useRef(!!paused);
  useEffect(() => { pausedRef.current = !!paused; }, [paused]);

  // Force re-render when locale changes so HUD strings refresh
  const [, setLocaleTick] = useState(0);
  useEffect(() => window.onLocaleChange(() => setLocaleTick(n => n + 1)), []);

  const isInfinite = mode === 'infinite';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.clientWidth;
    const H = () => canvas.clientHeight;

    const ZONES = window.INFINITE_ZONES;
    const TYPE_TO_VARIANTS = window.TYPE_TO_VARIANTS;
    const VARIANTS = window.PLANET_VARIANTS;

    const basePalette = chapter ? chapter.palette : ZONES[0].palette;
    const chapterId = chapter ? chapter.id : 1;

    // Player — launches UPWARD; gravity constantly pulls down.
    const player = {
      x: W() / 2,
      y: H() * 0.74,
      vx: 0,
      vy: -560,
      r: 4,
      trail: []
    };
    const startingY = player.y;

    let worldY = 0;
    let cameraY = startingY - H() * 0.62;

    let anchors = [];
    let asteroids = [];
    let particles = [];
    let currentZoneIndex = 0;

    let orbitAnchor = null;
    let orbitRadius = 0;
    let orbitAngle = 0;
    let orbitOmega = 0;
    let orbitDir = 1;

    let holding = false;
    let alive = true;
    let scoreVal = 0;
    let maxAltitude = 0;
    let lastAltitude = 0;
    let regressionY = startingY + 220;
    let regressionTargetY = startingY + 220;
    let regressionRevealed = false;

    function rand(a, b) { return a + Math.random() * (b - a); }
    function chance(p) { return Math.random() < p; }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function difficulty() {
      if (isInfinite) {
        const meters = maxAltitude / 5;
        const km = meters / 1000;
        return Math.min(9, 1 + Math.floor(km * 2));
      }
      return chapterId;
    }

    function anchorType() {
      const d = difficulty();
      const r = Math.random();
      if (d <= 1) return r < 0.85 ? 'standard' : 'dwarf';
      if (d <= 2) return r < 0.7  ? 'standard' : (r < 0.9 ? 'dwarf' : 'giant');
      if (d <= 3) return r < 0.5  ? 'standard' : (r < 0.75 ? 'pulsar' : (r < 0.9 ? 'giant' : 'dwarf'));
      if (d <= 4) return r < 0.5  ? 'standard' : (r < 0.8 ? 'pulsar' : 'giant');
      if (d <= 5) return r < 0.3  ? 'dwarf'    : (r < 0.7 ? 'standard' : 'pulsar');
      if (d <= 6) return r < 0.4  ? 'standard' : (r < 0.7 ? 'dwarf' : 'pulsar');
      if (d <= 7) return r < 0.4  ? 'giant'    : (r < 0.7 ? 'blackhole' : 'pulsar');
      if (d <= 8) return r < 0.4  ? 'standard' : (r < 0.7 ? 'giant' : 'pulsar');
      return r < 0.5 ? 'giant' : (r < 0.85 ? 'pulsar' : 'blackhole');
    }

    function makeAnchor(x, y, t) {
      const type = t || anchorType();
      let radius, mass;
      if (type === 'dwarf')         { radius = 14; mass = 12000; }
      else if (type === 'standard') { radius = 24; mass = 28000; }
      else if (type === 'giant')    { radius = 42; mass = 65000; }
      else if (type === 'pulsar')   { radius = 22; mass = 35000; }
      else if (type === 'blackhole'){ radius = 28; mass = 95000; }
      else                          { radius = 24; mass = 28000; }

      const variant = pick(TYPE_TO_VARIANTS[type] || ['barren']);

      return {
        x, y, r: radius, mass, type, variant,
        phase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: rand(-0.15, 0.15),
        ringTilt: rand(-0.5, 0.5),
        orbited: false,
        starOrbit: chance(0.7) ? {
          count: 3,
          radius: radius + 28,
          angle: Math.random() * Math.PI * 2,
          collected: [false, false, false]
        } : null
      };
    }

    function spawnAhead() {
      const highestY = anchors.length ? anchors.reduce((y, a) => Math.min(y, a.y), Infinity) : startingY;
      const baseY = Math.min(highestY - rand(280, 380), cameraY - 200);
      const x = rand(W() * 0.18, W() * 0.82);
      anchors.push(makeAnchor(x, baseY));
      const d = difficulty();
      if (d >= 2 && chance(0.55)) {
        const cnt = 1 + Math.floor(Math.random() * (d >= 5 ? 4 : 2));
        for (let i = 0; i < cnt; i++) {
          asteroids.push({
            x: rand(W() * 0.1, W() * 0.9),
            y: baseY + rand(-180, 80),
            r: rand(6, 14),
            vx: d >= 3 ? rand(-30, 30) : 0,
            rot: Math.random() * Math.PI,
            spin: rand(-0.5, 0.5)
          });
        }
      }
    }

    function seedWorld() {
      anchors = [];
      asteroids = [];
      anchors.push(makeAnchor(W() * 0.50, startingY - H() * 0.30, 'standard'));
      anchors.push(makeAnchor(W() * 0.32, startingY - H() * 0.85, 'standard'));
      anchors.push(makeAnchor(W() * 0.70, startingY - H() * 1.40, 'standard'));
      anchors.push(makeAnchor(W() * 0.42, startingY - H() * 1.95, 'dwarf'));
      for (let i = 0; i < 6; i++) spawnAhead();
    }

    seedWorld();

    // ─── Input ─────────────────────────────────────────────────────────────
    function onDown(e) {
      if (e && e.target && e.target.tagName === 'BUTTON') return;
      if (pausedRef.current) return;  // ignore input while paused
      holding = true;
      setIsHolding(true);
    }
    function onUp() {
      if (pausedRef.current) return;
      holding = false;
      setIsHolding(false);
      releaseOrbit();
    }
    function onTouchStart(e) { e.preventDefault(); onDown(); }
    function onTouchEnd(e) { e.preventDefault(); onUp(); }

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onUp);

    function findNearestAnchor() {
      let best = null;
      let bestD = Math.min(220, W() * 0.35);
      for (const a of anchors) {
        if (a.y < cameraY - 200) continue;
        if (a.y > cameraY + H() + 200) continue;
        const dx = a.x - player.x;
        const dy = a.y - player.y;
        const d = Math.hypot(dx, dy);
        if (d < bestD && d > a.r + 8) { best = a; bestD = d; }
      }
      return best;
    }

    function captureOrbit(a) {
      orbitAnchor = a;
      a.orbited = true;
      const dx = player.x - a.x;
      const dy = player.y - a.y;
      orbitRadius = Math.hypot(dx, dy);
      orbitAngle = Math.atan2(dy, dx);
      const tx = -Math.sin(orbitAngle);
      const ty = Math.cos(orbitAngle);
      const v_tan = player.vx * tx + player.vy * ty;
      orbitDir = v_tan >= 0 ? 1 : -1;
      const speed = Math.hypot(player.vx, player.vy);
      orbitOmega = (Math.max(speed, 180) / orbitRadius) * orbitDir;
      orbitOmega *= 1 + (a.mass / 100000);

      const newTarget = a.y + 280;
      if (newTarget < regressionTargetY) regressionTargetY = newTarget;
      regressionRevealed = true;
    }

    function releaseOrbit() {
      if (!orbitAnchor) return;
      const tx = -Math.sin(orbitAngle) * orbitDir;
      const ty = Math.cos(orbitAngle) * orbitDir;
      const speed = Math.abs(orbitOmega) * orbitRadius;
      player.vx = tx * speed;
      player.vy = ty * speed;
      for (let i = 0; i < 14; i++) {
        particles.push({
          x: player.x, y: player.y,
          vx: rand(-60, 60) - tx * 60,
          vy: rand(-60, 60) - ty * 60,
          life: 0.8, max: 0.8, color: '#f4b860'
        });
      }
      orbitAnchor = null;
    }

    function die(reasonKey) {
      if (!alive) return;
      alive = false;
      for (let i = 0; i < 50; i++) {
        particles.push({
          x: player.x, y: player.y,
          vx: rand(-220, 220), vy: rand(-220, 220),
          life: 1.4, max: 1.4,
          color: i % 3 === 0 ? '#fff' : '#f4b860'
        });
      }
      setTimeout(() => onDeath && onDeath(scoreVal, Math.floor(maxAltitude / 5), reasonKey), 1300);
    }

    let last = performance.now();
    let raf = 0;
    let loopErrLogged = false;
    function loop(now) {
      try {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        if (alive && !pausedRef.current) update(dt, now);
        render(now);
      } catch (e) {
        if (!loopErrLogged) { console.error('[GAME] loop error:', e); loopErrLogged = true; }
      }
      raf = requestAnimationFrame(loop);
    }

    function update(dt, now) {
      if (holding && !orbitAnchor) {
        const a = findNearestAnchor();
        if (a) captureOrbit(a);
      }

      if (orbitAnchor) {
        const massMod = orbitAnchor.type === 'pulsar'
          ? 1 + 0.3 * Math.sin(now / 600 + orbitAnchor.phase)
          : 1;
        orbitAngle += orbitOmega * dt * massMod;
        player.x = orbitAnchor.x + Math.cos(orbitAngle) * orbitRadius;
        player.y = orbitAnchor.y + Math.sin(orbitAngle) * orbitRadius;
        const tx = -Math.sin(orbitAngle) * orbitDir;
        const ty = Math.cos(orbitAngle) * orbitDir;
        const speed = Math.abs(orbitOmega) * orbitRadius;
        player.vx = tx * speed;
        player.vy = ty * speed;

        if (orbitAnchor.starOrbit) {
          const so = orbitAnchor.starOrbit;
          for (let i = 0; i < so.count; i++) {
            if (so.collected[i]) continue;
            const ang = so.angle + (i / so.count) * Math.PI * 2 + now / 2000;
            const sx = orbitAnchor.x + Math.cos(ang) * so.radius;
            const sy = orbitAnchor.y + Math.sin(ang) * so.radius;
            const d = Math.hypot(sx - player.x, sy - player.y);
            if (d < 14) {
              so.collected[i] = true;
              scoreVal += 25;
              setScore(scoreVal);
              for (let k = 0; k < 8; k++) particles.push({ x: sx, y: sy, vx: rand(-80, 80), vy: rand(-80, 80), life: 0.6, max: 0.6, color: '#f4b860' });
            }
          }
        }
      } else {
        // FREE FLIGHT — gravity pulls downward (positive y).
        player.vy += 180 * dt;
        player.x += player.vx * dt;
        player.y += player.vy * dt;

        // Wall bounce
        if (player.x < player.r) {
          player.x = player.r;
          player.vx = Math.abs(player.vx) * 0.6 + 30;
          for (let i = 0; i < 4; i++) particles.push({ x: player.x, y: player.y, vx: rand(20, 80), vy: rand(-40, 40), life: 0.4, max: 0.4, color: '#6db8d5' });
        }
        if (player.x > W() - player.r) {
          player.x = W() - player.r;
          player.vx = -Math.abs(player.vx) * 0.6 - 30;
          for (let i = 0; i < 4; i++) particles.push({ x: player.x, y: player.y, vx: rand(-80, -20), vy: rand(-40, 40), life: 0.4, max: 0.4, color: '#6db8d5' });
        }
      }

      // Trail
      player.trail.push({ x: player.x, y: player.y, t: now });
      if (player.trail.length > 40) player.trail.shift();

      // Camera follow
      const targetCamY = player.y - H() * 0.62;
      cameraY += (targetCamY - cameraY) * Math.min(1, dt * 6);
      worldY = Math.min(worldY, cameraY);

      // Altitude
      const altitude = Math.max(0, startingY - player.y);
      if (altitude > maxAltitude) maxAltitude = altitude;
      const d = Math.floor(maxAltitude / 5);
      setDistance(d);
      if (d > lastAltitude) {
        scoreVal += (d - lastAltitude);
        setScore(scoreVal);
        lastAltitude = d;
      }

      // Regression line animation
      regressionY += (regressionTargetY - regressionY) * Math.min(1, dt * 1.2);

      // Regression death check
      if (player.y > regressionY + 60 && !orbitAnchor) {
        die(regressionRevealed ? 'regression' : 'nopush');
        return;
      }

      // Closest approach
      for (const a of anchors) {
        if (a.y > cameraY + H() + 100 || a.y < cameraY - 100) continue;
        const dst = Math.hypot(a.x - player.x, a.y - player.y);
        if (a._closest === undefined || dst < a._closest) a._closest = dst;
      }

      // Cleanup off-screen
      anchors = anchors.filter(a => a.y < cameraY + H() + 600);
      asteroids = asteroids.filter(a => a.y < cameraY + H() + 600);

      // Ensure enough anchors ahead
      let topMost = anchors.length ? anchors.reduce((y, a) => Math.min(y, a.y), Infinity) : startingY;
      while (topMost > cameraY - 600 || anchors.length < 12) {
        spawnAhead();
        topMost = anchors.reduce((y, a) => Math.min(y, a.y), Infinity);
        if (anchors.length > 40) break;
      }

      // Asteroids motion
      for (const a of asteroids) {
        a.x += a.vx * dt;
        a.rot += a.spin * dt;
        if (a.x < 10 || a.x > W() - 10) a.vx *= -1;
      }

      // Asteroid collisions
      for (const a of asteroids) {
        const d2 = Math.hypot(a.x - player.x, a.y - player.y);
        if (d2 < a.r + player.r + 2) {
          die('asteroid');
          break;
        }
      }

      // Planet rotation
      for (const a of anchors) a.rotation += a.rotSpeed * dt;

      // Particles
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter(p => p.life > 0);

      // Infinite-mode zone tracking
      if (isInfinite) {
        const meters = maxAltitude / 5;
        let cum = 0;
        let zIdx = 0;
        for (let i = 0; i < ZONES.length; i++) {
          cum += ZONES[i].depth;
          if (meters < cum) { zIdx = i; break; }
          zIdx = (i + 1) % ZONES.length;
        }
        if (zIdx !== currentZoneIndex) {
          currentZoneIndex = zIdx;
          setZoneKey(ZONES[zIdx].key);
          setZoneJustChanged(true);
          setTimeout(() => setZoneJustChanged(false), 3200);
        }
      }
    }

    // ─── Planet rendering ──────────────────────────────────────────────────
    function renderPlanet(a, now) {
      const v = a.variant;
      const def = VARIANTS[v] || VARIANTS.barren;

      const haloPulse = a.type === 'pulsar' ? (3.8 + 0.7 * Math.sin(now / 600 + a.phase)) : 3.2;
      const haloColor = def.glow || (def.bands && def.bands[0]) || def.surface || '#6db8d5';
      const haloR = a.r * haloPulse;
      const halo = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, haloR);
      halo.addColorStop(0, hexA(haloColor, a.type === 'pulsar' ? 0.45 : 0.28));
      halo.addColorStop(0.5, hexA(haloColor, 0.06));
      halo.addColorStop(1, hexA(haloColor, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(a.x, a.y, haloR, 0, Math.PI * 2); ctx.fill();

      // Black hole
      if (v === 'voidBh') {
        const accR = a.r * 3.2;
        const acc = ctx.createRadialGradient(a.x, a.y, a.r, a.x, a.y, accR);
        acc.addColorStop(0, hexA('#d04060', 0.0));
        acc.addColorStop(0.3, hexA('#d04060', 0.35));
        acc.addColorStop(0.6, hexA('#7a1a3a', 0.25));
        acc.addColorStop(1, hexA('#000', 0));
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(a.x, a.y, accR, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.ringTilt);
        ctx.strokeStyle = hexA('#ff7090', 0.55);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, a.r * 2.4, a.r * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = hexA('#ffb070', 0.3);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, a.r * 2.8, a.r * 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexA('#ff5070', 0.4);
        ctx.lineWidth = 0.6;
        ctx.stroke();
        return;
      }

      // Pulsar
      if (v === 'pulsar') {
        const flicker = 0.7 + 0.3 * Math.sin(now / 200 + a.phase);
        const aura = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r * 2);
        aura.addColorStop(0, hexA('#ffd890', flicker));
        aura.addColorStop(0.5, hexA('#f4b860', 0.4 * flicker));
        aura.addColorStop(1, hexA('#f4b860', 0));
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 2, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(now / 1200 + a.phase);
        ctx.fillStyle = hexA('#fff0c0', 0.18 * flicker);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(a.r * 4, -a.r * 0.6);
        ctx.lineTo(a.r * 4, a.r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-a.r * 4, -a.r * 0.6);
        ctx.lineTo(-a.r * 4, a.r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        const core = ctx.createRadialGradient(a.x - a.r * 0.2, a.y - a.r * 0.2, 0, a.x, a.y, a.r);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(0.5, '#fff0c0');
        core.addColorStop(1, '#f4b860');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
        return;
      }

      // Gas giants — horizontal bands
      if (def.bands) {
        ctx.save();
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.clip();
        const bands = def.bands;
        const bandH = (a.r * 2) / (bands.length + 1);
        for (let i = 0; i < bands.length + 1; i++) {
          ctx.fillStyle = bands[i % bands.length];
          ctx.fillRect(a.x - a.r, a.y - a.r + i * bandH, a.r * 2, bandH * 1.05);
        }
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation * 0.3);
        for (let i = 0; i < 3; i++) {
          const ang = i * 2.1;
          const sx = Math.cos(ang) * a.r * 0.6;
          const sy = Math.sin(ang + a.phase) * a.r * 0.5;
          ctx.fillStyle = hexA(bands[i % bands.length], 0.5);
          ctx.beginPath();
          ctx.ellipse(sx, sy, a.r * 0.18, a.r * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        const sh = ctx.createRadialGradient(a.x - a.r * 0.4, a.y - a.r * 0.4, 0, a.x, a.y, a.r);
        sh.addColorStop(0, 'rgba(255,255,255,0.25)');
        sh.addColorStop(0.6, 'rgba(255,255,255,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = sh;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexA(bands[0], 0.6);
        ctx.lineWidth = 0.8;
        ctx.stroke();
        return;
      }

      // Surface planets
      const base = def.surface || '#5a544a';
      const body = ctx.createRadialGradient(a.x - a.r * 0.35, a.y - a.r * 0.35, 0, a.x, a.y, a.r);
      body.addColorStop(0, lighten(base, 0.3));
      body.addColorStop(0.7, base);
      body.addColorStop(1, darken(base, 0.5));
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();

      if (def.spots && def.spotCount) {
        ctx.save();
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.clip();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation * 0.4);
        for (let i = 0; i < def.spotCount; i++) {
          const ang = (i / def.spotCount) * Math.PI * 2 + a.phase;
          const dist = a.r * (0.2 + ((i * 17) % 5) * 0.12);
          const sx = Math.cos(ang) * dist;
          const sy = Math.sin(ang) * dist;
          const sr = a.r * (0.12 + ((i * 23) % 4) * 0.05);
          if (v === 'lava') {
            const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.5);
            cg.addColorStop(0, def.spots);
            cg.addColorStop(1, hexA(def.spots, 0));
            ctx.fillStyle = cg;
            ctx.beginPath(); ctx.arc(sx, sy, sr * 1.5, 0, Math.PI * 2); ctx.fill();
          } else if (v === 'ocean') {
            ctx.fillStyle = hexA(def.spots, 0.55);
            ctx.beginPath();
            ctx.ellipse(sx, sy, sr * 1.4, sr * 0.6, ang, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = def.spots;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Ring
      if (v === 'ringed') {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.ringTilt);
        ctx.strokeStyle = hexA(def.ring, 0.5);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, a.r * 1.9, a.r * 0.45, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = hexA(def.ring, 0.75);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, a.r * 2.2, a.r * 0.5, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(0, 0, a.r, Math.PI, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexA(def.ring, 0.75);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, a.r * 1.9, a.r * 0.45, 0, 0, Math.PI);
        ctx.stroke();
        ctx.strokeStyle = hexA(def.ring, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, a.r * 2.2, a.r * 0.5, 0, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      // Sphere shading
      const sh = ctx.createRadialGradient(a.x - a.r * 0.4, a.y - a.r * 0.4, 0, a.x, a.y, a.r);
      sh.addColorStop(0, 'rgba(255,255,255,0.22)');
      sh.addColorStop(0.6, 'rgba(255,255,255,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }

    function currentPalette(now) {
      if (!isInfinite) return basePalette;
      const meters = maxAltitude / 5;
      let cum = 0;
      let i = 0;
      for (; i < ZONES.length; i++) {
        if (meters < cum + ZONES[i].depth) break;
        cum += ZONES[i].depth;
      }
      const zIdx = i % ZONES.length;
      const next = (zIdx + 1) % ZONES.length;
      const depth = ZONES[zIdx].depth;
      const into = (meters - cum) / depth;
      const t = into < 0.75 ? 0 : (into - 0.75) / 0.25;
      const A = ZONES[zIdx].palette;
      const B = ZONES[next].palette;
      return [
        lerpColor(A[0], B[0], t),
        lerpColor(A[1], B[1], t),
        lerpColor(A[2], B[2], t)
      ];
    }

    function render(now) {
      const w = W(), h = H();
      const palette = currentPalette(now);

      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, palette[0]);
      g.addColorStop(1, '#02030a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const neb = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.7);
      neb.addColorStop(0, hexA(palette[1], 0.18));
      neb.addColorStop(1, hexA(palette[1], 0));
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);

      // Parallax star fields
      const sfOff = cameraY * 0.1;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 137) % w);
        const sy = (((i * 91 + sfOff * 0.3) % h) + h) % h;
        const a = 0.15 + ((i * 17) % 8) * 0.08;
        ctx.globalAlpha = a;
        ctx.fillRect(sx, sy, 1, 1);
      }
      const sfOff2 = cameraY * 0.4;
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 211) % w);
        const sy = (((i * 73 + sfOff2 * 0.6) % h) + h) % h;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(0, -cameraY);

      // Regression horizon
      if (regressionRevealed && regressionY !== null) {
        const y = regressionY;
        const pulse = 0.7 + 0.3 * Math.sin(now / 600);
        const grad = ctx.createLinearGradient(0, y - 40, 0, y + 40);
        grad.addColorStop(0, hexA('#d04060', 0));
        grad.addColorStop(0.5, hexA('#d04060', 0.18 * pulse));
        grad.addColorStop(1, hexA('#d04060', 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - 40, w, 80);
        ctx.strokeStyle = hexA('#ff5070', 0.55 + 0.2 * pulse);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(w, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Anchors
      for (const a of anchors) {
        if (a.y < cameraY - 80 || a.y > cameraY + h + 80) continue;
        renderPlanet(a, now);

        if (a.starOrbit) {
          const so = a.starOrbit;
          for (let i = 0; i < so.count; i++) {
            if (so.collected[i]) continue;
            const ang = so.angle + (i / so.count) * Math.PI * 2 + now / 2000;
            const sx = a.x + Math.cos(ang) * so.radius;
            const sy = a.y + Math.sin(ang) * so.radius;
            ctx.fillStyle = '#f4b860';
            ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = hexA('#f4b860', 0.3);
            ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
          }
        }

        if (orbitAnchor === a) {
          ctx.strokeStyle = hexA('#f4b860', 0.55);
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 6]);
          ctx.beginPath(); ctx.arc(a.x, a.y, orbitRadius, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Asteroids
      for (const a of asteroids) {
        if (a.y < cameraY - 80 || a.y > cameraY + h + 80) continue;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.fillStyle = '#3a3530';
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * Math.PI * 2;
          const rr = a.r * (0.8 + ((i * 31) % 5) * 0.05);
          ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#5a5048';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }

      // Player trail
      for (let i = 0; i < player.trail.length - 1; i++) {
        const t = player.trail[i];
        const t2 = player.trail[i + 1];
        const alpha = i / player.trail.length;
        ctx.strokeStyle = `rgba(244, 184, 96, ${alpha * 0.6})`;
        ctx.lineWidth = alpha * 3 + 0.5;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.stroke();
      }

      // Player
      if (alive) {
        const glow = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 24);
        glow.addColorStop(0, 'rgba(255, 240, 200, 0.85)');
        glow.addColorStop(0.4, 'rgba(244, 184, 96, 0.5)');
        glow.addColorStop(1, 'rgba(244, 184, 96, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(player.x, player.y, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
      }

      // Particles
      for (const p of particles) {
        const a = Math.max(0, p.life / p.max);
        ctx.fillStyle = hexA(p.color, a);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 * a, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }

    // Helpers
    function hexA(hex, a) {
      const h = hex.replace('#', '');
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    function lighten(hex, amt) {
      const h = hex.replace('#', '');
      const r = Math.min(255, parseInt(h.substring(0, 2), 16) + 255 * amt);
      const g = Math.min(255, parseInt(h.substring(2, 4), 16) + 255 * amt);
      const b = Math.min(255, parseInt(h.substring(4, 6), 16) + 255 * amt);
      return `rgb(${r|0},${g|0},${b|0})`;
    }
    function darken(hex, amt) {
      const h = hex.replace('#', '');
      const r = Math.max(0, parseInt(h.substring(0, 2), 16) * (1 - amt));
      const g = Math.max(0, parseInt(h.substring(2, 4), 16) * (1 - amt));
      const b = Math.max(0, parseInt(h.substring(4, 6), 16) * (1 - amt));
      return `rgb(${r|0},${g|0},${b|0})`;
    }
    function lerpColor(a, b, t) {
      const ah = a.replace('#', '');
      const bh = b.replace('#', '');
      const ar = parseInt(ah.substring(0,2), 16);
      const ag = parseInt(ah.substring(2,4), 16);
      const ab = parseInt(ah.substring(4,6), 16);
      const br = parseInt(bh.substring(0,2), 16);
      const bg = parseInt(bh.substring(2,4), 16);
      const bb = parseInt(bh.substring(4,6), 16);
      const rr = Math.round(ar + (br - ar) * t);
      const rg = Math.round(ag + (bg - ag) * t);
      const rb = Math.round(ab + (bb - ab) * t);
      return `#${rr.toString(16).padStart(2,'0')}${rg.toString(16).padStart(2,'0')}${rb.toString(16).padStart(2,'0')}`;
    }

    raf = requestAnimationFrame(loop);

    // ─── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onUp);
    };
  }, [chapter, mode]);

  // ─── HUD ─────────────────────────────────────────────────────────────────
  const title = isInfinite
    ? window.t('menu.infinite')
    : (chapter ? window.t(`chapters.${chapter.id}.name`) : window.t('chapters.1.name'));
  const subtitle = isInfinite
    ? (zoneKey ? window.t(`zones.${zoneKey}`) : window.t('zones.blue_void'))
    : (chapter ? `${window.t('chapter_label')} ${chapter.roman}` : `${window.t('chapter_label')} I`);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: isHolding ? 'grabbing' : 'pointer' }}
      />

      {/* HUD top-left: chapter / zone */}
      <div className="hud-corner hud-tl">
        <div className="label" style={{ marginBottom: 8 }}>{subtitle}</div>
        <div className="serif hud-title" style={{ letterSpacing: '0.04em' }}>{title}</div>
      </div>

      {/* HUD top-right: altitude + score */}
      <div className="hud-corner hud-tr">
        <div className="label" style={{ marginBottom: 6 }}>{window.t('hud.altitude')}</div>
        <div className="score-display hud-distance">
          {distance}<span style={{ fontSize: 18, color: 'var(--bone-dim)', marginLeft: 4 }}>m</span>
        </div>
        <div className="distance-display" style={{ marginTop: 12 }}>{window.t('hud.points', { n: score })}</div>
      </div>

      {/* HUD bottom-left: rising hint + pause */}
      <div className="hud-corner hud-bl" style={{ pointerEvents: 'auto' }}>
        <div className="label" style={{ marginBottom: 6 }}>{window.t('hud.rising_label')}</div>
        <div className="serif-i" style={{ fontSize: 14, color: 'var(--bone-dim)', maxWidth: 220, lineHeight: 1.4 }}>
          {window.t('hud.rising_hint')}
        </div>
        <button className="btn-text" onClick={onPause} style={{ marginTop: 14, padding: 0 }}>
          {window.t('hud.pause')}
        </button>
      </div>

      {/* HUD bottom-right: orbit hint */}
      <div className="hud-corner hud-br" style={{ opacity: isHolding ? 1 : 0.45, transition: 'opacity 0.4s' }}>
        <div className="label">
          {isHolding ? `— ${window.t('hud.in_orbit')} —` : window.t('hud.hold_to_orbit')}
        </div>
      </div>

      {/* Zone change banner (infinite mode) */}
      {isInfinite && zoneJustChanged && zoneKey && (
        <div className="zone-banner fade-in">
          <div className="label" style={{ marginBottom: 6, color: 'var(--amber-glow)' }}>— {window.t('hud.entering')} —</div>
          <div className="serif" style={{ fontSize: 36, letterSpacing: '0.16em', color: 'var(--bone)' }}>
            {window.t(`zones.${zoneKey}`)}
          </div>
        </div>
      )}

      <div className="letterbox top" />
      <div className="letterbox bottom" />
      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

window.GameCanvas = GameCanvas;
