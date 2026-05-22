// GRAVITY — Main App Router
// State machine: intro → menu → (map → boss → game | infinite-game)
//                                       └─ pause ─┘
//                                  → gameover → (retry | map/menu)
//                          → bestiary | settings (from menu)
//
// Pause is a flag on the GameCanvas, NOT a separate render — preserves session.
// All player-facing text comes from t() (data.js).

const { useState, useEffect, useCallback } = React;

function App() {
  const [screen, setScreen] = useState('intro');     // intro|menu|map|boss|game|gameover|bestiary|settings
  const [chapter, setChapter] = useState(null);
  const [mode, setMode] = useState('chapter');       // 'chapter' | 'infinite'
  const [paused, setPaused] = useState(false);
  const [runKey, setRunKey] = useState(0);           // bump to force fresh GameCanvas
  const [lastRun, setLastRun] = useState({ score: 0, distance: 0, isNewBest: false, reason: '' });

  // Re-render when locale changes (so all t() calls refresh)
  const [, setLocaleTick] = useState(0);
  useEffect(() => window.onLocaleChange(() => setLocaleTick(n => n + 1)), []);

  // Apply screen-label attr for QA tooling / debug
  useEffect(() => { document.body.setAttribute('data-screen', screen); }, [screen]);

  // Music: the prologue and game-over screens have their own contemplative
  // slots; every other out-of-game screen uses the 'menu' slot. While the
  // game runs the engine drives the track (it knows the live chapter/zone).
  useEffect(() => {
    if (!window.AudioBus) return;
    if (screen === 'game') return;
    if (screen === 'intro')         window.AudioBus.playTrack('prologue');
    else if (screen === 'gameover') window.AudioBus.playTrack('gameover');
    else                            window.AudioBus.playTrack('menu');
  }, [screen]);

  // ── Navigation ──────────────────────────────────────────────────────────
  const goMenu     = useCallback(() => { setPaused(false); setScreen('menu'); }, []);
  const goMap      = useCallback(() => setScreen('map'), []);
  const goBestiary = useCallback(() => setScreen('bestiary'), []);
  const goSettings = useCallback(() => setScreen('settings'), []);

  const goPlay = useCallback((ch) => {
    setMode('chapter');
    setChapter(ch || window.CHAPTERS[0]);
    setPaused(false);
    setRunKey(k => k + 1);
    setScreen('game');
  }, []);

  const goInfinite = useCallback(() => {
    setMode('infinite');
    setChapter(null);
    setPaused(false);
    setRunKey(k => k + 1);
    setScreen('game');
  }, []);

  const goBoss   = useCallback((ch) => { setChapter(ch); setScreen('boss'); }, []);
  const goPause  = useCallback(() => setPaused(true), []);
  const goResume = useCallback(() => setPaused(false), []);

  const goDeath = useCallback((score, distance, reason) => {
    const prevBest = window.getBestScore();
    const isNewBest = score > prevBest;
    if (isNewBest) window.setBestScore(score);

    // The engine writes setProgress as the spark crosses each threshold, but if
    // anything keeps it from firing for the highest one the player actually
    // reached (paused right on the edge, render frame skip, etc.), resolve it
    // from the final distance here so retry always opens the right chapter.
    if (mode === 'chapter' && distance > 0) {
      const reached = window.chapterFromMeters(distance);
      if (reached) window.setProgress(reached.id, 1);
    }

    setLastRun({ score, distance, isNewBest, reason: reason || 'default' });
    setPaused(false);
    setScreen('gameover');
  }, [mode]);

  const restartRun = useCallback(() => {
    setPaused(false);
    // Match retry semantics: if the player crossed into a later chapter
    // before pausing, restart should reopen there, not back at the start.
    if (mode === 'chapter') setChapter(window.currentChapter());
    setRunKey(k => k + 1);  // force GameCanvas remount cleanly
  }, [mode]);

  const quitToMap = useCallback(() => {
    setPaused(false);
    setScreen(mode === 'infinite' ? 'menu' : 'map');
  }, [mode]);

  const hasSave = window.chaptersDoneCount() > 0;

  return (
    <>
      {screen === 'intro' && (
        <window.IntroScreen onContinue={goMenu} />
      )}

      {screen === 'menu' && (
        <window.MainMenu
          onPlay={() => goPlay(window.currentChapter())}
          onInfinite={goInfinite}
          onJourney={goMap}
          onBestiary={goBestiary}
          onSettings={goSettings}
          hasSave={hasSave}
        />
      )}

      {screen === 'map' && (
        <window.ChapterMap
          onBack={goMenu}
          onPlay={(ch) => goPlay(ch)}
          onBoss={(ch) => goBoss(ch)}
        />
      )}

      {screen === 'boss' && chapter && (
        <window.BossIntro
          chapter={chapter}
          onContinue={() => goPlay(chapter)}
          onBack={goMap}
        />
      )}

      {screen === 'game' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <window.GameCanvas
            key={runKey}
            chapter={chapter}
            mode={mode}
            paused={paused}
            onPause={goPause}
            onDeath={goDeath}
          />
          {paused && (
            <window.PauseOverlay
              chapter={mode === 'infinite'
                ? { roman: '∞', name: window.t('menu.infinite') }
                : window.currentChapter()}
              onResume={goResume}
              onRestart={restartRun}
              onQuit={quitToMap}
            />
          )}
        </div>
      )}

      {screen === 'gameover' && (
        <window.GameOver
          chapter={mode === 'infinite' ? null : window.currentChapter()}
          mode={mode}
          score={lastRun.score}
          distance={lastRun.distance}
          isNewBest={lastRun.isNewBest}
          reason={lastRun.reason}
          // If the spark crossed into a new chapter before dying, retry resumes
          // from the highest one reached (currentChapter reads the latest unlock).
          onRetry={() => mode === 'infinite' ? goInfinite() : goPlay(window.currentChapter())}
          onMap={() => setScreen(mode === 'infinite' ? 'menu' : 'map')}
        />
      )}

      {screen === 'bestiary' && (
        <window.Bestiary onBack={goMenu} />
      )}

      {screen === 'settings' && (
        <window.SettingsScreen onBack={goMenu} />
      )}

      {/* Persistent top-center nav (hidden during gameplay, intro, gameover) */}
      {!['game', 'intro', 'gameover'].includes(screen) && (
        <NavHint screen={screen} onMenu={goMenu} onMap={goMap} onBestiary={goBestiary} />
      )}
    </>
  );
}

function NavHint({ screen, onMenu, onMap, onBestiary }) {
  const items = [
    { id: 'menu',     label: window.t('nav.home'),     fn: onMenu },
    { id: 'map',      label: window.t('nav.journey'),  fn: onMap },
    { id: 'bestiary', label: window.t('nav.bestiary'), fn: onBestiary },
  ];
  const active =
    screen === 'map' || screen === 'boss' ? 'map' :
    screen === 'bestiary' ? 'bestiary' :
    screen === 'menu' ? 'menu' : null;

  return (
    <div style={{
      position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 4, padding: 4, border: '1px solid var(--rule)',
      background: 'rgba(2, 3, 10, 0.6)', backdropFilter: 'blur(12px)', zIndex: 200,
      pointerEvents: 'auto'
    }}>
      {items.map(it => (
        <button
          key={it.id}
          className="btn-text"
          onClick={it.fn}
          style={{
            padding: '8px 16px',
            color: active === it.id ? 'var(--amber-glow)' : 'var(--bone-dim)',
            background: active === it.id ? 'rgba(244, 184, 96, 0.06)' : 'transparent'
          }}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
