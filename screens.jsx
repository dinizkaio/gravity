// GRAVITY — Screens: Intro, MainMenu, ChapterMap
// All text via t(); chapter data via window.CHAPTERS + i18n keys.

const { useState, useEffect, useRef } = React;

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT STARFIELD — animated background for all menu screens
// ─────────────────────────────────────────────────────────────────────────────

function AmbientBackground({ intensity = 1, chapter = null }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    const stars = [];
    for (let i = 0; i < 220 * intensity; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        r: Math.random() * 1.4 + 0.2,
        a: Math.random() * 0.6 + 0.15,
        v: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2
      });
    }
    const nebulae = [];
    const tint = chapter ? chapter.palette : ['#1a2540', '#3a5a8a', '#f4b860'];
    for (let i = 0; i < 4; i++) {
      nebulae.push({
        x: Math.random(), y: Math.random(),
        r: 300 + Math.random() * 350,
        color: tint[1 + (i % 2)]
      });
    }
    let raf = 0;
    function loop(t) {
      const w = c.clientWidth, h = c.clientHeight;
      ctx.fillStyle = '#02030a';
      ctx.fillRect(0, 0, w, h);
      for (const n of nebulae) {
        const g = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, n.r);
        g.addColorStop(0, hexA(n.color, 0.18));
        g.addColorStop(1, hexA(n.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      for (const s of stars) {
        const a = s.a * (0.6 + 0.4 * Math.sin(t * 0.001 * s.v * 40 + s.phase));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [intensity, chapter]);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTRO — Cinematic opening
// Italic lines marked with leading '*' in i18n.intro.lines
// ─────────────────────────────────────────────────────────────────────────────

function IntroScreen({ onContinue }) {
  const lines = window.t('intro.lines');
  const total = lines.length;
  const [step, setStep] = useState(0);
  // Browser autoplay policy blocks the menu track until the user taps,
  // and the prologue auto-scrolls without needing input. Wait for an
  // explicit first interaction before starting the scroll so the music
  // catches up with the text rather than only kicking in at "Continuar".
  // If the player just stares at the gate for a few seconds we drop it
  // anyway and let the prologue roll — the music stays silent until they
  // tap something later, but the reading flow isn't blocked.
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    const t = setTimeout(() => setStarted(true), 3500);
    return () => clearTimeout(t);
  }, [started]);

  useEffect(() => {
    if (!started) return;
    if (step >= total - 1) return;
    const t = setTimeout(() => setStep(s => s + 1), 2200);
    return () => clearTimeout(t);
  }, [started, step, total]);

  // Orbiting spark on the background
  const sparkRef = useRef(null);
  useEffect(() => {
    if (!sparkRef.current) return;
    const c = sparkRef.current;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    let raf, t0 = performance.now();
    const orbitR = 80;
    function loop(t) {
      const w = c.clientWidth, h = c.clientHeight;
      const ax = w * 0.5, ay = h * 0.5;
      ctx.clearRect(0, 0, w, h);
      const ang = (t - t0) / 2400;
      const x = ax + Math.cos(ang) * orbitR;
      const y = ay + Math.sin(ang) * orbitR;
      ctx.strokeStyle = 'rgba(244, 184, 96, 0.08)';
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(ax, ay, orbitR, 0, Math.PI * 2); ctx.stroke();
      const ag = ctx.createRadialGradient(ax, ay, 0, ax, ay, 60);
      ag.addColorStop(0, 'rgba(60, 90, 130, 0.5)');
      ag.addColorStop(1, 'rgba(60, 90, 130, 0)');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(ax, ay, 60, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a3850';
      ctx.beginPath(); ctx.arc(ax, ay, 10, 0, Math.PI * 2); ctx.fill();
      const sg = ctx.createRadialGradient(x, y, 0, x, y, 30);
      sg.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
      sg.addColorStop(0.4, 'rgba(244, 184, 96, 0.5)');
      sg.addColorStop(1, 'rgba(244, 184, 96, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className="stage">
      <AmbientBackground intensity={0.7} />
      <canvas ref={sparkRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.6 }} />
      <div className="vignette" />
      <div className="letterbox top" />
      <div className="letterbox bottom" />

      {/* Top label */}
      <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center', zIndex: 10 }} className="fade-in">
        <div className="label">— {window.t('intro.label')} —</div>
      </div>

      {/* Narrative — sits inside a top/bottom-anchored flex column so the text never
          overflows under the Continue button on small screens. */}
      <div className="intro-narrative">
        {lines.slice(0, step + 1).map((line, i) => {
          const isItalic = typeof line === 'string' && line.startsWith('*');
          const display = isItalic ? line.slice(1) : line;
          const isEmpty = display === '';
          return (
            <div key={i}
                 className={`serif intro-line${isEmpty ? ' empty' : ''}`}
                 style={{
                   color: i === step ? 'var(--bone)' : 'var(--bone-faint)',
                   animation: 'fadeInLetter 1.6s cubic-bezier(0.22, 1, 0.36, 1) both',
                   fontStyle: isItalic ? 'italic' : 'normal'
                 }}>
              {display}
            </div>
          );
        })}
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'absolute', bottom: 80, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 40, zIndex: 10
      }}>
        {step < total - 1 ? (
          <button className="btn-text" onClick={() => setStep(total - 1)}>{window.t('intro.skip')}</button>
        ) : (
          <button className="btn-ghost primary fade-in" onClick={onContinue}
                  style={{ animation: 'fadeIn 1.8s ease-out both, glow 4s ease-in-out infinite' }}>
            ▸ {window.t('intro.continue')}
          </button>
        )}
      </div>

      {/* Progress dots */}
      <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 10 }}>
        {lines.map((_, i) => (
          <div key={i} style={{
            width: 18, height: 1,
            background: i <= step ? 'var(--amber)' : 'var(--rule)',
            transition: 'background 0.6s'
          }} />
        ))}
      </div>

      {/* First-interaction gate — the audio bus needs a user gesture before
          autoplay is allowed, and this overlay both unlocks it and starts
          the auto-scroll. Any tap on the stage dismisses it. onClick covers
          old iOS Safari that doesn't dispatch pointer events. */}
      {!started && (
        <div
          className="overlay-blur"
          onPointerDown={() => setStarted(true)}
          onClick={() => setStarted(true)}
          style={{ cursor: 'pointer' }}>
          <div className="serif-i fade-in"
               style={{ fontSize: 20, color: 'var(--bone-dim)', letterSpacing: '0.06em', animation: 'glow 4s ease-in-out infinite' }}>
            · {window.t('intro.tap_to_start')} ·
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MENU
// ─────────────────────────────────────────────────────────────────────────────

function MainMenu({ onPlay, onInfinite, onJourney, onBestiary, onSettings, onCredits, hasSave }) {
  const best = window.getBestScore();
  return (
    <div className="stage">
      <AmbientBackground intensity={1.1} />
      <div className="letterbox top" />
      <div className="letterbox bottom" />

      {/* Corners */}
      <div style={{ position: 'absolute', top: 84, left: 48, zIndex: 10 }} className="fade-in">
        <div className="label">— {window.t('game.version')} —</div>
      </div>
      <div style={{ position: 'absolute', top: 84, right: 48, zIndex: 10 }} className="fade-in">
        <div className="label" style={{ textAlign: 'right' }}>
          {window.t('menu.best', { n: best.toLocaleString() })}
        </div>
      </div>

      {/* Center */}
      <div className="abs-center" style={{ textAlign: 'center', zIndex: 10, width: '90%' }}>
        <div className="fade-in-up" style={{ marginBottom: 8 }}>
          <div className="label" style={{ marginBottom: 32, color: 'var(--bone-faint)' }}>
            — {window.t('game.tagline')} —
          </div>
        </div>
        <div className="fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h1 className="title-hero glow-bone">{window.t('game.name')}</h1>
        </div>
        <div className="fade-in-up" style={{ animationDelay: '0.6s', marginTop: 24 }}>
          <div className="subtitle">{window.t('game.subtitle')}</div>
        </div>

        <div className="fade-in-up menu-actions"
             style={{ animationDelay: '1.0s', marginTop: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, margin: '56px auto 0' }}>
          {/* Story mode */}
          <button className="mode-chip" onClick={onPlay} style={{ borderColor: 'var(--amber)' }}>
            <div className="icon" style={{ background: 'radial-gradient(circle at 30% 30%, #f4b860, #a04830)', boxShadow: '0 0 20px rgba(244, 184, 96, 0.5)' }} />
            <div className="body">
              <div className="name">{hasSave ? window.t('menu.story_continue') : window.t('menu.story_begin')}</div>
              <div className="desc">{window.t('menu.story_desc')}</div>
            </div>
            <div className="label" style={{ color: 'var(--amber)' }}>▸</div>
          </button>

          {/* Infinite mode */}
          <button className="mode-chip" onClick={onInfinite}>
            <div className="icon" style={{ background: 'radial-gradient(circle at 30% 30%, #6db8d5, #2a5a78)', boxShadow: '0 0 20px rgba(109, 184, 213, 0.4)' }} />
            <div className="body">
              <div className="name">{window.t('menu.infinite')}</div>
              <div className="desc">{window.t('menu.infinite_desc')}</div>
            </div>
            <div className="label">▸</div>
          </button>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn-ghost" onClick={onJourney} style={{ padding: '10px 18px', fontSize: 10 }}>· {window.t('nav.map')} ·</button>
            <button className="btn-ghost" onClick={onBestiary} style={{ padding: '10px 18px', fontSize: 10 }}>· {window.t('nav.bestiary')} ·</button>
            <button className="btn-ghost" onClick={onCredits} style={{ padding: '10px 18px', fontSize: 10 }}>· {window.t('nav.credits')} ·</button>
          </div>
        </div>
      </div>

      {/* Bottom corners */}
      <div style={{ position: 'absolute', bottom: 84, left: 48, zIndex: 10 }} className="fade-in">
        <div className="label">{window.t('menu.footer', { n: window.CHAPTERS.length })}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 84, right: 48, zIndex: 10 }} className="fade-in">
        <button className="btn-text" onClick={onSettings}>· {window.t('nav.settings')} ·</button>
      </div>

      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER MAP — The Journey
// ─────────────────────────────────────────────────────────────────────────────

function ChapterMap({ onBack, onPlay, onBoss }) {
  const [selected, setSelected] = useState(0);
  const scrollRef = useRef(null);
  const chapters = window.CHAPTERS;
  const sel = chapters[selected];
  const done = window.chaptersDoneCount();

  return (
    <div className="stage">
      <AmbientBackground intensity={0.8} chapter={sel} />
      <div className="letterbox top" />
      <div className="letterbox bottom" />

      {/* Header */}
      <div style={{ position: 'absolute', top: 80, left: 48, right: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <button className="btn-text" onClick={onBack}>← {window.t('nav.back')}</button>
        <div className="label">— {window.t('map.title')} —</div>
        <div className="label" style={{ opacity: 0.4 }}>
          {window.t('map.progress', { done: String(done).padStart(2, '0'), total: String(window.CHAPTERS.length).padStart(2, '0') })}
        </div>
      </div>

      {/* Two-column layout: chapter list + chapter detail */}
      <div className="chapter-map-grid" style={{
        position: 'absolute', top: 130, bottom: 130, left: 48, right: 48,
        display: 'grid', gridTemplateColumns: '380px 1fr',
        gap: 56, zIndex: 10
      }}>
        <div ref={scrollRef} className="no-scrollbar" style={{ overflowY: 'auto', paddingRight: 8 }}>
          {chapters.map((c, i) => {
            const state = window.chapterState(c);
            const isSel = i === selected;
            const locked = state === 'sealed';
            return (
              <div key={c.id}
                   onClick={() => setSelected(i)}
                   style={{
                     padding: '24px 0',
                     borderBottom: '1px solid var(--rule)',
                     opacity: locked ? 0.45 : 1,
                     cursor: 'pointer',
                     transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                     position: 'relative'
                   }}>
                <div style={{
                  position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)',
                  width: 2, height: isSel ? 32 : 0,
                  background: 'var(--amber)',
                  transition: 'height 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                  <div className="serif-i" style={{ fontSize: 32, color: isSel ? 'var(--amber-glow)' : 'var(--bone-faint)', minWidth: 50, lineHeight: 1, marginTop: 4 }}>
                    {c.roman}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="serif" style={{ fontSize: 22, color: isSel ? 'var(--bone)' : 'var(--bone-dim)', letterSpacing: '0.04em', marginBottom: 4 }}>
                      {window.t(`chapters.${c.id}.name`)}
                    </div>
                    <div className="label" style={{ marginBottom: 8 }}>
                      {window.t(`map.status.${state}`)}  ·  {window.t('map.levels_short', { n: c.levels })}
                    </div>
                    {!locked && (
                      <div style={{ height: 1, background: 'var(--rule)', position: 'relative', marginTop: 8 }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: 1,
                          width: state === 'completed' ? '100%' : (state === 'current' ? '50%' : '0%'),
                          background: 'var(--amber)',
                          transition: 'width 0.6s'
                        }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="no-scrollbar" style={{ overflowY: 'auto', position: 'relative', paddingRight: 12 }}>
          <ChapterDetail chapter={sel} onPlay={() => onPlay(sel)} onBoss={() => onBoss(sel)} />
        </div>
      </div>

      {/* Footer rail */}
      <div style={{ position: 'absolute', bottom: 80, left: 48, right: 48, display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
        <div className="label">{window.t('map.chapter_label')}</div>
        <div className="serif-i" style={{ fontSize: 18, color: 'var(--amber-glow)', minWidth: 40 }}>{sel.roman}</div>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {chapters.map((c, i) => {
            const locked = window.chapterState(c) === 'sealed';
            return (
              <div key={c.id} style={{
                flex: 1, height: 2,
                background: i === selected ? 'var(--amber)' : (locked ? 'var(--rule)' : 'var(--rule-strong)'),
                transition: 'background 0.4s'
              }} />
            );
          })}
        </div>
        <div className="label" style={{ minWidth: 80, textAlign: 'right' }}>{window.t('map.ix_label')}</div>
      </div>

      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

function ChapterDetail({ chapter, onPlay, onBoss }) {
  const state = window.chapterState(chapter);
  const locked = state === 'sealed';
  const c = chapter;
  return (
    <div key={c.id} className="fade-in" style={{ animation: 'fadeIn 0.6s ease-out both' }}>
      <div style={{ marginBottom: 32 }}>
        <div className="serif-i" style={{ fontSize: 14, color: 'var(--amber-glow)', letterSpacing: '0.32em', marginBottom: 4 }}>
          {window.t('chapter_label').toUpperCase()} {c.roman}
        </div>
        <h2 className="serif glow-bone" style={{ fontSize: 64, letterSpacing: '0.04em', lineHeight: 1, marginBottom: 8 }}>
          {window.t(`chapters.${c.id}.name`)}
        </h2>
        <div className="serif-i" style={{ fontSize: 22, color: 'var(--bone-dim)' }}>
          {window.t(`chapters.${c.id}.subtitle`)}
        </div>
      </div>

      <blockquote style={{
        borderLeft: '1px solid var(--amber)',
        padding: '8px 0 8px 24px',
        marginBottom: 36,
        maxWidth: 560
      }}>
        <div className="serif-i" style={{ fontSize: 20, color: 'var(--bone)', lineHeight: 1.45, letterSpacing: '0.02em' }}>
          «{window.t(`chapters.${c.id}.quote`)}»
        </div>
      </blockquote>

      <div className="serif" style={{ fontSize: 17, color: 'var(--bone-dim)', maxWidth: 540, marginBottom: 36, lineHeight: 1.6 }}>
        {window.t(`chapters.${c.id}.description`)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 48, maxWidth: 640 }}>
        <Stat label={window.t('map.stats.distance')} value={window.chapterDistance(c)} />
        <Stat label={window.t('map.stats.levels')}   value={c.levels} />
        <Stat label={window.t('map.stats.duration')} value={c.duration} />
        <Stat label={window.t('map.stats.biome')}    value={window.t(`chapters.${c.id}.biome`)} small />
      </div>

      <div
        onClick={!locked ? onBoss : undefined}
        style={{
          border: '1px solid var(--rule)',
          padding: '20px 24px',
          marginBottom: 32,
          maxWidth: 640,
          background: 'rgba(15, 8, 16, 0.5)',
          cursor: locked ? 'default' : 'pointer',
          opacity: locked ? 0.5 : 1,
          transition: 'all 0.4s'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${c.bossColor}, ${c.bossColor}33)`,
            boxShadow: `0 0 30px ${c.bossColor}66`,
            flexShrink: 0
          }} />
          <div style={{ flex: 1 }}>
            <div className="label" style={{ color: 'var(--crimson)', marginBottom: 4 }}>— {window.t('boss.label')} —</div>
            <div className="serif" style={{ fontSize: 26, letterSpacing: '0.06em', marginBottom: 2 }}>
              {window.t(`chapters.${c.id}.boss.name`)}
            </div>
            <div className="serif-i" style={{ fontSize: 15, color: 'var(--bone-dim)' }}>
              {window.t(`chapters.${c.id}.boss.title`)}
            </div>
          </div>
          {!locked && <div className="label" style={{ color: 'var(--amber)' }}>{window.t('boss.view')}</div>}
        </div>
      </div>

      {!locked && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-ghost primary" onClick={onPlay}>
            ▸ {state === 'current'
                ? window.t('map.action_continue')
                : state === 'completed'
                  ? window.t('map.action_replay')
                  : window.t('map.action_begin')}
          </button>
        </div>
      )}
      {locked && (
        <div className="label" style={{ color: 'var(--bone-faint)' }}>
          {window.t('map.locked_hint')}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="serif" style={{ fontSize: small ? 14 : 18, color: 'var(--bone)', letterSpacing: '0.02em' }}>
        {value}
      </div>
    </div>
  );
}

window.IntroScreen        = IntroScreen;
window.MainMenu           = MainMenu;
window.ChapterMap         = ChapterMap;
window.AmbientBackground  = AmbientBackground;
