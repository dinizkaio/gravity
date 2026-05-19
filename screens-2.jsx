// GRAVITY — Screens: BossIntro, PauseOverlay, GameOver, Bestiary, SettingsScreen
// All text via t(); chapter strings via i18n keys keyed by chapter.id.

const { useState: useS, useEffect: useE, useRef: useR } = React;

// ─────────────────────────────────────────────────────────────────────────────
// BOSS INTRO — Cinematic title card before the chapter
// ─────────────────────────────────────────────────────────────────────────────

function BossIntro({ chapter, onContinue, onBack }) {
  const c = chapter;
  const canvasRef = useR(null);

  useE(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    const t0 = performance.now();
    function loop(t) {
      const w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const ang = (t - t0) / 4000;
      const cx = w * 0.5, cy = h * 0.5;
      const R = 180;
      const pulseR = R * (2.4 + 0.2 * Math.sin(t / 800));
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
      halo.addColorStop(0, hexA(c.bossColor, 0.35));
      halo.addColorStop(0.4, hexA(c.bossColor, 0.12));
      halo.addColorStop(1, hexA(c.bossColor, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI * 2); ctx.fill();

      const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
      body.addColorStop(0, lighten(c.bossColor, 0.4));
      body.addColorStop(0.7, c.bossColor);
      body.addColorStop(1, darken(c.bossColor, 0.5));
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = hexA(c.bossColor, 0.3);
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.stroke();

      const sx = cx + Math.cos(ang) * R * 1.6;
      const sy = cy + Math.sin(ang) * R * 1.6;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 24);
      sg.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
      sg.addColorStop(0.4, 'rgba(244, 184, 96, 0.5)');
      sg.addColorStop(1, 'rgba(244, 184, 96, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sx, sy, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [c.id]);

  const hazards = window.t(`chapters.${c.id}.hazards`) || [];

  return (
    <div className="stage" style={{ background: '#02030a' }}>
      <window.AmbientBackground intensity={0.5} chapter={c} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div className="letterbox top" />
      <div className="letterbox bottom" />

      <div style={{ position: 'absolute', top: 80, left: 48, right: 48, display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
        <button className="btn-text" onClick={onBack}>← {window.t('nav.back')}</button>
        <div className="label" style={{ color: 'var(--crimson)' }}>— {window.t('boss.meeting', { r: c.roman })} —</div>
        <div style={{ width: 80 }} />
      </div>

      <div style={{
        position: 'absolute',
        left: 64, top: '50%', transform: 'translateY(-50%)',
        maxWidth: 480, zIndex: 10
      }} className="fade-in-up">
        <div className="label" style={{ marginBottom: 16, color: 'var(--crimson)' }}>
          — {window.t('boss.meeting_lower', { r: c.roman })} —
        </div>
        <div className="boss-name fade-in-up" style={{ marginBottom: 16, fontSize: 64, letterSpacing: '0.12em' }}>
          {window.t(`chapters.${c.id}.boss.name`)}
        </div>
        <div className="serif-i" style={{ fontSize: 22, color: 'var(--bone-dim)', marginBottom: 32 }}>
          {window.t(`chapters.${c.id}.boss.title`)}
        </div>
        <div className="serif" style={{ fontSize: 18, color: 'var(--bone)', lineHeight: 1.55, letterSpacing: '0.02em', maxWidth: 440 }}>
          {window.t(`chapters.${c.id}.boss.desc`)}
        </div>
      </div>

      <div style={{ position: 'absolute', right: 64, bottom: 130, textAlign: 'right', zIndex: 10 }}>
        <div className="label" style={{ marginBottom: 12, opacity: 0.7 }}>— {window.t('boss.final')} —</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={onBack}>· {window.t('boss.back_map')} ·</button>
          <button className="btn-ghost primary" onClick={onContinue} style={{ animation: 'glow 4s ease-in-out infinite' }}>
            ▸ {window.t('boss.confront')}
          </button>
        </div>
      </div>

      <div style={{ position: 'absolute', right: 64, top: 140, textAlign: 'right', zIndex: 10 }} className="fade-in">
        <div className="label" style={{ marginBottom: 8 }}>— {window.t('boss.hazards')} —</div>
        {hazards.map((h, i) => (
          <div key={i} className="serif" style={{ fontSize: 16, color: 'var(--bone-dim)', marginBottom: 2 }}>
            · {h}
          </div>
        ))}
      </div>

      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAUSE OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function PauseOverlay({ chapter, onResume, onRestart, onQuit }) {
  const isInfinite = !chapter || chapter.roman === '∞';
  const settings = window.getSettings();
  return (
    <div className="overlay-blur fade-in">
      <div className="label" style={{ marginBottom: 24, color: 'var(--amber-glow)' }}>— {window.t('pause.label')} —</div>
      <div className="serif glow-bone" style={{ fontSize: 64, letterSpacing: '0.16em', marginBottom: 8 }}>
        {window.t('pause.title')}
      </div>
      <div className="serif-i" style={{ fontSize: 18, color: 'var(--bone-dim)', marginBottom: 48 }}>
        {isInfinite
          ? window.t('menu.infinite')
          : `${window.t('chapter_label')} ${chapter.roman} · ${window.t(`chapters.${chapter.id}.name`)}`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button className="btn-ghost primary" onClick={onResume} style={{ minWidth: 280 }}>▸ {window.t('pause.resume')}</button>
        <button className="btn-ghost" onClick={onRestart} style={{ minWidth: 280 }}>· {window.t('pause.restart')} ·</button>
        <button className="btn-ghost" onClick={onQuit} style={{ minWidth: 280 }}>· {window.t('pause.quit')} ·</button>
      </div>

      <div style={{ marginTop: 64, display: 'flex', gap: 32, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="label" style={{ marginBottom: 4 }}>{window.t('pause.sound')}</div>
          <div className="serif" style={{ fontSize: 14 }}>{soundDots(settings.sound)}</div>
        </div>
        <div style={{ height: 24, width: 1, background: 'var(--rule)' }} />
        <div style={{ textAlign: 'center' }}>
          <div className="label" style={{ marginBottom: 4 }}>{window.t('pause.vibration')}</div>
          <div className="serif" style={{ fontSize: 14 }}>{settings.vibration ? window.t('pause.on') : window.t('pause.off')}</div>
        </div>
      </div>
    </div>
  );
}

function soundDots(level) {
  const n = Math.round((level || 0) * 5);
  const on = '●'.repeat(n);
  const off = '○'.repeat(5 - n);
  return (on + '  ' + off).split('').join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME OVER
// ─────────────────────────────────────────────────────────────────────────────

function GameOver({ chapter, mode, score, distance, isNewBest, reason, onRetry, onMap }) {
  const [shown, setShown] = useS(false);
  useE(() => { const t = setTimeout(() => setShown(true), 600); return () => clearTimeout(t); }, []);
  const isInfinite = mode === 'infinite';
  // reason is a death key from death.* (e.g. 'asteroid'); 'default' is fallback
  const reasonKey = (reason && window.t(`gameover.death.${reason}`) !== `gameover.death.${reason}`)
    ? reason : 'default';
  const reasonText = window.t(`gameover.death.${reasonKey}`);
  const best = window.getBestScore();

  return (
    <div className="stage" style={{ background: '#02030a' }}>
      <window.AmbientBackground intensity={0.4} chapter={chapter} />
      <div className="letterbox top" />
      <div className="letterbox bottom" />

      <div className="abs-center" style={{ textAlign: 'center', zIndex: 10, width: '92%', maxWidth: 720 }}>
        <div className="fade-in-up" style={{ marginBottom: 32 }}>
          <div className="label" style={{ marginBottom: 16, color: 'var(--crimson)' }}>
            — {reasonText} —
          </div>
          <div className="serif" style={{ fontSize: 72, letterSpacing: '0.12em', color: 'var(--bone)', marginBottom: 6 }}>
            {window.t('gameover.end')}
          </div>
          <div className="serif-i" style={{ fontSize: 18, color: 'var(--bone-dim)' }}>
            {isInfinite ? window.t('gameover.tail_infinite') : window.t('gameover.tail_chapter')}
          </div>
        </div>

        {shown && (
          <div className="fade-in-up gameover-stats" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 32, marginBottom: 40 }}>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>{window.t('gameover.altitude')}</div>
              <div className="serif" style={{ fontSize: 40, color: 'var(--bone)', letterSpacing: '0.04em' }}>
                {distance}<span style={{ fontSize: 18, color: 'var(--bone-dim)', marginLeft: 4 }}>m</span>
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--rule)' }} />
            <div>
              <div className="label" style={{ marginBottom: 8 }}>{window.t('gameover.points')}</div>
              <div className="serif" style={{ fontSize: 40, color: 'var(--amber-glow)', letterSpacing: '0.04em' }}>
                {score}
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--rule)' }} />
            <div>
              <div className="label" style={{ marginBottom: 8 }}>{window.t('gameover.best')}</div>
              <div className="serif" style={{ fontSize: 40, color: isNewBest ? 'var(--amber-glow)' : 'var(--bone-dim)', letterSpacing: '0.04em' }}>
                {Math.max(score, best)}
              </div>
            </div>
          </div>
        )}

        {isNewBest && shown && (
          <div className="fade-in" style={{ marginBottom: 36 }}>
            <div className="serif-i glow-amber" style={{ fontSize: 26, animation: 'pulse-soft 2s ease-in-out infinite' }}>
              {window.t('gameover.new_best')}
            </div>
          </div>
        )}

        {shown && (
          <div className="fade-in-up" style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn-ghost" onClick={onMap}>
              · {isInfinite ? window.t('gameover.back_menu') : window.t('gameover.back_map')} ·
            </button>
            <button className="btn-ghost primary" onClick={onRetry}>▸ {window.t('gameover.retry')}</button>
          </div>
        )}
      </div>

      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BESTIARY
// ─────────────────────────────────────────────────────────────────────────────

function Bestiary({ onBack }) {
  const chapters = window.CHAPTERS;
  const [hover, setHover] = useS(0);
  const knownCount = window.bestiaryKnownCount();

  return (
    <div className="stage">
      <window.AmbientBackground intensity={0.6} chapter={chapters[hover]} />
      <div className="letterbox top" />
      <div className="letterbox bottom" />

      <div style={{ position: 'absolute', top: 80, left: 48, right: 48, display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
        <button className="btn-text" onClick={onBack}>← {window.t('nav.back')}</button>
        <div className="label">— {window.t('bestiary.title')} —</div>
        <div className="label" style={{ opacity: 0.4 }}>
          {window.t('bestiary.known', { n: String(knownCount).padStart(2, '0') })}
        </div>
      </div>

      <div className="bestiary-grid" style={{
        position: 'absolute', top: 130, bottom: 80, left: 48, right: 48,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, zIndex: 10,
        overflowY: 'auto'
      }}>
        {chapters.map((c, i) => {
          const state = window.chapterState(c);
          const known = state !== 'sealed';
          const distance = window.chapterDistance(c);
          const distanceShort = distance.includes(' — ') ? distance.split(' — ')[0] : distance;
          return (
            <div key={c.id}
                 onMouseEnter={() => setHover(i)}
                 onClick={() => setHover(i)}
                 style={{
                   border: '1px solid var(--rule)',
                   padding: '24px 22px',
                   background: hover === i ? 'rgba(15, 22, 38, 0.7)' : 'rgba(10, 15, 26, 0.4)',
                   backdropFilter: 'blur(8px)',
                   transition: 'all 0.5s',
                   borderColor: hover === i ? hexA(c.bossColor, 0.5) : 'var(--rule)',
                   display: 'flex', flexDirection: 'column'
                 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: known
                    ? `radial-gradient(circle at 30% 30%, ${lighten(c.bossColor, 0.4)}, ${darken(c.bossColor, 0.5)})`
                    : '#1a1f2a',
                  boxShadow: known ? `0 0 24px ${c.bossColor}55` : 'none',
                  filter: known ? 'none' : 'blur(2px)',
                  flexShrink: 0
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="label" style={{ marginBottom: 2 }}>{window.t('chapter_label')} {c.roman}</div>
                  <div className="serif" style={{ fontSize: 22, letterSpacing: '0.04em', color: known ? 'var(--bone)' : 'var(--bone-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {known ? window.t(`chapters.${c.id}.boss.name`) : window.t('bestiary.unknown_name')}
                  </div>
                </div>
              </div>
              <div className="serif-i" style={{ fontSize: 14, color: 'var(--bone-dim)', marginBottom: 12 }}>
                {known ? window.t(`chapters.${c.id}.boss.title`) : window.t('bestiary.unknown_title')}
              </div>
              <div className="serif" style={{ fontSize: 13.5, color: 'var(--bone-dim)', lineHeight: 1.55, flex: 1 }}>
                {known ? window.t(`chapters.${c.id}.boss.desc`) : window.t('bestiary.unknown_desc')}
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="label">{known ? window.t(`chapters.${c.id}.biome`) : window.t('bestiary.sealed')}</div>
                <div className="serif-i" style={{ fontSize: 13, color: 'var(--bone-dim)' }}>{distanceShort}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — language, sound/music/vibration, reset progress, about
// ─────────────────────────────────────────────────────────────────────────────

function SettingsScreen({ onBack }) {
  const [, force] = useS(0);
  const [confirm, setConfirm] = useS(false);
  const [toast, setToast] = useS(null);
  const s = window.getSettings();
  const locale = window.getLocale();

  // Auto-dismiss the toast after 2.4s; cleaned up if the screen unmounts in between.
  useE(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function refresh() { force(n => n + 1); }
  function changeLocale(loc) { window.setLocale(loc); refresh(); }
  function update(k, v) { window.setSettings({ [k]: v }); refresh(); }
  function doReset() {
    window.resetProgress();
    setConfirm(false);
    setToast(window.t('settings.reset_done'));
  }

  return (
    <div className="stage">
      <window.AmbientBackground intensity={0.5} />
      <div className="letterbox top" />
      <div className="letterbox bottom" />

      <div style={{ position: 'absolute', top: 80, left: 48, right: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <button className="btn-text" onClick={onBack}>← {window.t('nav.back')}</button>
        <div className="label">— {window.t('settings.title')} —</div>
        <div style={{ width: 80 }} />
      </div>

      <div className="abs-center" style={{ width: '90%', maxWidth: 560, zIndex: 10 }}>
        {/* Language */}
        <Section label={window.t('settings.language')}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {window.SUPPORTED_LOCALES.map(loc => (
              <button key={loc}
                      className={'btn-ghost' + (loc === locale ? ' primary' : '')}
                      onClick={() => changeLocale(loc)}
                      style={{ padding: '10px 22px', fontSize: 10 }}>
                {window.t(`settings.languages.${loc}`)}
              </button>
            ))}
          </div>
        </Section>

        {/* Sound */}
        <Section label={window.t('settings.sound')}>
          <DotsControl value={s.sound} onChange={(v) => update('sound', v)} />
        </Section>

        {/* Music */}
        <Section label={window.t('settings.music')}>
          <DotsControl value={s.music} onChange={(v) => update('music', v)} />
        </Section>

        {/* Vibration */}
        <Section label={window.t('settings.vibration')}>
          <ToggleControl value={s.vibration} onChange={(v) => update('vibration', v)}
                         labels={[window.t('pause.on'), window.t('pause.off')]} />
        </Section>

        {/* Reset */}
        <Section label={window.t('settings.reset')}>
          {!confirm ? (
            <button className="btn-ghost" onClick={() => setConfirm(true)} style={{ padding: '10px 22px', fontSize: 10, color: 'var(--crimson)', borderColor: 'rgba(181,74,74,0.4)' }}>
              · {window.t('settings.reset')} ·
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="serif-i" style={{ fontSize: 14, color: 'var(--bone-dim)' }}>
                {window.t('settings.reset_confirm')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" onClick={() => setConfirm(false)} style={{ padding: '10px 22px', fontSize: 10 }}>
                  · {window.t('settings.reset_no')} ·
                </button>
                <button className="btn-ghost" onClick={doReset}
                        style={{ padding: '10px 22px', fontSize: 10, color: 'var(--crimson)', borderColor: 'var(--crimson)' }}>
                  ▸ {window.t('settings.reset_yes')}
                </button>
              </div>
            </div>
          )}
          {toast && (
            <div className="serif-i fade-in" style={{ marginTop: 12, fontSize: 14, color: 'var(--amber-glow)' }}>
              {toast}
            </div>
          )}
        </Section>

        {/* About */}
        <Section label={window.t('settings.about')}>
          <div className="serif-i" style={{ fontSize: 14, color: 'var(--bone-dim)', whiteSpace: 'pre-line', lineHeight: 1.55 }}>
            {window.t('settings.about_text')}
          </div>
        </Section>
      </div>

      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ padding: '20px 0', borderBottom: '1px solid var(--rule)' }}>
      <div className="label" style={{ marginBottom: 14 }}>— {label} —</div>
      {children}
    </div>
  );
}

function DotsControl({ value, onChange }) {
  // 0..5 dots
  const n = Math.round((value || 0) * 5);
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i}
                onClick={() => onChange(i / 5)}
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: i <= n ? 'var(--amber-glow)' : 'transparent',
                  border: i <= n ? 'none' : '1px solid var(--rule-strong)',
                  boxShadow: i <= n ? '0 0 8px rgba(244, 184, 96, 0.5)' : 'none',
                  cursor: 'pointer', padding: 0
                }} />
      ))}
      <button onClick={() => onChange(0)} className="btn-text" style={{ marginLeft: 12, padding: 0, fontSize: 9 }}>
        · 0 ·
      </button>
    </div>
  );
}

function ToggleControl({ value, onChange, labels }) {
  return (
    <button onClick={() => onChange(!value)} className="btn-ghost"
            style={{ padding: '10px 22px', fontSize: 10, borderColor: value ? 'var(--amber)' : 'var(--rule-strong)', color: value ? 'var(--amber-glow)' : 'var(--bone-dim)' }}>
      {value ? labels[0] : labels[1]}
    </button>
  );
}

// helpers
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

window.BossIntro      = BossIntro;
window.PauseOverlay   = PauseOverlay;
window.GameOver       = GameOver;
window.Bestiary       = Bestiary;
window.SettingsScreen = SettingsScreen;
