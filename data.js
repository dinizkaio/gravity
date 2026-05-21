// GRAVITY — World data, i18n, persistence
// Story: A última fagulha de uma estrela morta atravessa o silêncio do cosmos
// para reacender o sol natal. 9 capítulos, 9 chefões, ~118 fases, ~22h de jogo.
//
// All player-facing strings live in I18N. Gameplay data (palettes, colors,
// level counts) lives in CHAPTERS as language-neutral references.

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE — localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

const LS = {
  locale:   'gravity.locale',
  best:     'gravity.bestScore',
  progress: 'gravity.progress',     // { [chapterId]: completedLevels }
  settings: 'gravity.settings',     // { sound, music, vibration }
};

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function getBestScore() { return lsGet(LS.best, 0) || 0; }
function setBestScore(n) { lsSet(LS.best, Math.max(getBestScore(), n | 0)); }

function getProgress() { return lsGet(LS.progress, {}) || {}; }
function setProgress(chapterId, completedLevels) {
  const p = getProgress();
  p[chapterId] = Math.max(p[chapterId] || 0, completedLevels | 0);
  lsSet(LS.progress, p);
}
function resetProgress() {
  lsSet(LS.progress, {});
  lsSet(LS.best, 0);
}

function getSettings() {
  return Object.assign(
    { sound: 0.6, music: 0.5, vibration: true },
    lsGet(LS.settings, {}) || {}
  );
}
function setSettings(s) { lsSet(LS.settings, Object.assign(getSettings(), s)); }

// ─────────────────────────────────────────────────────────────────────────────
// LOCALE
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = ['pt', 'en', 'es'];

function detectLocale() {
  const saved = lsGet(LS.locale, null);
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  const nav = (navigator.language || 'pt').toLowerCase();
  if (nav.startsWith('en')) return 'en';
  if (nav.startsWith('es')) return 'es';
  return 'pt';
}

let _locale = detectLocale();
const _localeListeners = new Set();

function getLocale() { return _locale; }
function setLocale(loc) {
  if (!SUPPORTED_LOCALES.includes(loc)) return;
  _locale = loc;
  lsSet(LS.locale, loc);
  _localeListeners.forEach(fn => { try { fn(loc); } catch (e) {} });
}
function onLocaleChange(fn) { _localeListeners.add(fn); return () => _localeListeners.delete(fn); }

// t(key, params?) — looks up I18N[locale].<dotted.key>, with {placeholder} substitution.
function t(key, params) {
  const dict = I18N[_locale] || I18N.pt;
  const fallback = I18N.pt;
  const parts = key.split('.');
  let cur = dict, fb = fallback;
  for (const p of parts) {
    cur = cur && cur[p];
    fb  = fb  && fb[p];
  }
  let s = cur != null ? cur : (fb != null ? fb : key);
  if (params && typeof s === 'string') {
    s = s.replace(/\{(\w+)\}/g, (_, k) => params[k] != null ? params[k] : `{${k}}`);
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// I18N DICTIONARIES — PT / EN / ES, verbatim
// All chapter / boss / zone / UI strings live here.
// ─────────────────────────────────────────────────────────────────────────────

const I18N = {
  // ─────────── PORTUGUÊS (PT-BR) ───────────
  pt: {
    game: {
      name: 'GRAVITY',
      tagline: 'a última fagulha sobe ao silêncio',
      subtitle: 'Gravidade. Tempo. Velocidade.',
      version: 'v1.0 · silent run',
    },
    nav: {
      home: 'Início',
      journey: 'Jornada',
      bestiary: 'Bestiário',
      settings: 'Configurações',
      back: 'Voltar',
      map: 'Mapa',
    },
    menu: {
      story_continue: 'Continuar a Jornada',
      story_begin: 'Começar a Jornada',
      story_desc: 'história em 9 capítulos · ≈ 22h',
      infinite: 'Modo Infinito',
      infinite_desc: 'subida sem fim · zonas que mudam',
      best: 'recorde · {n} pts',
      footer: '{n} fases · 9 chefões · ≈ 22h de ascensão',
    },
    intro: {
      label: 'Prólogo',
      skip: 'Pular prólogo',
      continue: 'Continuar',
      lines: [
        'Antes do silêncio, havia luz.',
        'Antes da luz, havia gravidade.',
        '',
        'Quando o sol morreu, restou apenas uma fagulha.',
        'Ela guarda o último calor de um mundo que se apagou.',
        '',
        'Agora precisa subir — atravessar o vazio,',
        'encadear órbitas como quem reza,',
        'ganhar impulso a cada planeta morto.',
        '',
        '*Se chegar ao Coração do Vazio,',
        '*talvez reacenda o que se perdeu.',
      ],
    },
    map: {
      title: 'A Jornada · 9 capítulos',
      progress: 'progresso · {done} / {total}',
      chapter_label: 'capítulo',
      ix_label: 'IX · Aurora',
      status: {
        sealed:    '◇ selado',
        current:   '◆ em curso',
        completed: '✓ completo',
        available: '◇ disponível',
      },
      stats: {
        distance: 'Distância',
        levels: 'Fases',
        duration: 'Duração',
        biome: 'Bioma',
      },
      action_continue: 'Continuar — fase {n}',
      action_begin: 'Começar capítulo',
      action_next_in: '· próxima fase em ≈ 5 min ·',
      locked_hint: '◇ Selado — complete o capítulo anterior para abrir',
      levels_short: '{n} fases',
    },
    boss: {
      label: 'Chefão',
      view: 'ver →',
      meeting: 'Encontro · Capítulo {r}',
      meeting_lower: 'chefão · capítulo {r}',
      final: 'encontro final do capítulo',
      hazards: 'ameaças do capítulo',
      confront: 'Confrontar',
      back_map: 'Voltar ao mapa',
    },
    pause: {
      label: 'pausa',
      title: 'Pausado',
      resume: 'Continuar',
      restart: 'Reiniciar fase',
      quit: 'Sair para o mapa',
      sound: 'som',
      vibration: 'vibração',
      on: 'ligada',
      off: 'desligada',
    },
    gameover: {
      end: 'Fim',
      tail_chapter: 'mas a subida continua.',
      tail_infinite: 'a subida continua sem você.',
      altitude: 'Altitude',
      points: 'Pontos',
      best: 'Recorde',
      new_best: '✦  Novo recorde  ✦',
      retry: 'Tentar de novo',
      back_map: 'Voltar ao mapa',
      back_menu: 'Voltar ao menu',
      death: {
        default:    'a fagulha se apagou',
        regression: 'Caiu ao passado',
        nopush:     'Sem impulso',
        asteroid:   'Asteroide',
        collapse:   'A órbita colapsou',
      },
    },
    bestiary: {
      title: 'Bestiário · nove encontros',
      known: '{n} / 09 conhecidos',
      unknown_name: '· · · · · · ·',
      unknown_title: 'desconhecido',
      unknown_desc: 'Atravesse o capítulo anterior para revelar.',
      sealed: '◇ selado',
    },
    hud: {
      altitude: 'Altitude',
      points: '· pontos · {n}',
      rising_label: 'Subindo',
      rising_hint: 'encadeie órbitas para subir contra a maré vermelha.',
      pause: '‖  Pausar',
      in_orbit: 'em órbita',
      hold_to_orbit: 'segure para orbitar',
      entering: 'entrando em',
      phase_label: 'fase',
      phase_n: 'Fase {n} · {total}',
      chapter_complete: 'capítulo completo',
    },
    settings: {
      title: 'Configurações',
      language: 'Idioma',
      sound: 'Som',
      music: 'Música',
      vibration: 'Vibração',
      reset: 'Apagar progresso',
      reset_confirm: 'Tem certeza? Esta ação não pode ser desfeita.',
      reset_yes: 'Apagar tudo',
      reset_no: 'Cancelar',
      reset_done: 'Progresso apagado.',
      languages: {
        pt: 'Português',
        en: 'Inglês',
        es: 'Espanhol',
      },
      about: 'Sobre',
      about_text: 'GRAVITY — um jogo silencioso sobre subir.\nFeito com cuidado, jogado em silêncio.',
    },
    chapter_label: 'Capítulo',
    zones: {
      blue_void:        'Vazio Azul',
      golden_dust:      'Poeira Dourada',
      violet_nebula:    'Nebulosa Violeta',
      emerald_sea:      'Mar Esmeralda',
      crimson_twilight: 'Crepúsculo Carmim',
      sea_of_shadows:   'Mar de Sombras',
      eye_of_abyss:     'Olho do Abismo',
      aurora:           'Aurora',
    },
    distance_special: {
      heart_of_void: 'Coração do Vazio',
    },
    chapters: {
      1: {
        name: 'Despertar',
        subtitle: 'A fagulha abre os olhos',
        quote: 'A primeira queda é a mais leve. O cosmos ainda não notou.',
        biome: 'Berço da estrela morta',
        description: 'Anchors comportados, restos suaves de uma estrela que um dia foi sol. O tutorial silencioso.',
        boss: { name: 'O Espelho', title: 'guardião da memória', desc: 'O reflexo da própria luz, encarnado num gigante azul. Ele te força a ver o que você foi.' },
        hazards: ['Anchors padrão', 'Asteroides estáticos'],
      },
      2: {
        name: 'Cinturão Quebrado',
        subtitle: 'Onde os mundos morreram primeiro',
        quote: 'Ainda existe órbita nos escombros. Aprenda a ler o que sobrou.',
        biome: 'Cinturão de detritos',
        description: 'Restos planetários em movimento lento. Aprende-se a planejar dois lances à frente.',
        boss: { name: 'Guardião de Pedra', title: 'o que não cai', desc: 'Um asteroide do tamanho de uma lua. Gravidade própria, orbita uma falha no espaço.' },
        hazards: ['Asteroides em rotação', 'Campos de poeira'],
      },
      3: {
        name: 'Marés de Júpiter',
        subtitle: 'O gigante respira',
        quote: 'Sinta o pulso. Cada batida abre uma janela para passar.',
        biome: 'Anéis de gigantes gasosos',
        description: 'Pulsares introduzidos. A gravidade pulsa em ritmo — preciso encontrar a batida certa.',
        boss: { name: 'Coração Pulsar', title: 'metrônomo dos mundos', desc: 'Um pulsar que respira em compasso de cinco segundos. Erre o tempo e sua massa te esmaga.' },
        hazards: ['Pulsares', 'Ventos de plasma'],
      },
      4: {
        name: 'Os Vagantes',
        subtitle: 'Cometas que cantam',
        quote: 'Eles vieram de longe. Atravessam você como se você não existisse.',
        biome: 'Espaço interestelar',
        description: 'Cometas atravessam a tela com trilhas longas. Você precisa antecipar e usá-los a seu favor.',
        boss: { name: 'Cometa Atlas', title: 'o de cauda longa', desc: 'Um cometa do tamanho de um continente, cauda quilométrica. Cruza o céu três vezes — então retorna.' },
        hazards: ['Cometas em trajetória', 'Caudas de plasma frio'],
      },
      5: {
        name: 'Limiar',
        subtitle: 'Onde a luz começa a hesitar',
        quote: 'Você não passa o limiar. O limiar passa por você.',
        biome: 'Fronteira do sistema',
        description: 'Densidade extrema. Campos de detritos densos, anchors mais raros, decisões rápidas.',
        boss: { name: 'O Enxame', title: 'mil pedras com uma só vontade', desc: 'Não é um — são mil. Pequenos asteroides que se movem como cardume. Mate a mente, ou contorne-a.' },
        hazards: ['Campos densos de detritos', 'Anchors anã raros'],
      },
      6: {
        name: 'Mar de Sombras',
        subtitle: 'A escuridão entre estrelas',
        quote: 'Quando não há luz, a gravidade é o único sentido.',
        biome: 'Vácuo profundo',
        description: 'A tela quase escura. Você sente os anchors antes de vê-los. Mecânica de sonar implícita.',
        boss: { name: 'O Nada', title: 'aquele que não foi', desc: 'Não tem corpo. Não tem luz. Apenas uma massa onde nada existe — e gravidade que puxa para sempre.' },
        hazards: ['Visibilidade reduzida', 'Anchors invisíveis'],
      },
      7: {
        name: 'Olho do Abismo',
        subtitle: 'A boca do gigante',
        quote: 'A queda agora é dele. Você só decide o ângulo.',
        biome: 'Horizonte de eventos',
        description: 'Buracos negros. A gravidade dobra a luz, o tempo se distorce. Slingshots gigantescos.',
        boss: { name: 'Gargantua', title: 'o que devora tempo', desc: 'Um buraco negro supermassivo. O combate inteiro é uma única órbita perfeita ao redor do horizonte.' },
        hazards: ['Buracos negros', 'Distorção de tempo', 'Cometas suicidas'],
      },
      8: {
        name: 'Tesserato',
        subtitle: 'Tempo dobrado em si',
        quote: 'Você se encontra do outro lado da queda.',
        biome: 'Interior do horizonte',
        description: 'Geometria impossível. Anchors aparecem fora da grade. O tempo flui em sentidos diferentes.',
        boss: { name: 'O Eco', title: 'você mesmo, antes', desc: 'Uma versão sua de outra linha temporal, encadeando slingshots em direção contrária. Vocês colidem se errarem o ritmo.' },
        hazards: ['Reflexões temporais', 'Gravidade reversa'],
      },
      9: {
        name: 'Aurora',
        subtitle: 'O sol respira de novo',
        quote: 'Você não chegou. Você se tornou o destino.',
        biome: 'O centro',
        description: 'Você atravessa o centro da estrela morta. Cada órbita reacende um filamento. Final emocional.',
        boss: { name: 'Coração da Estrela', title: 'o sol que adormeceu', desc: 'O coração inerte do sol que morreu. Para reacendê-lo, é preciso entregar tudo — distância, velocidade, a si mesmo.' },
        hazards: ['Filamentos solares', 'Reignição'],
      },
    },
  },

  // ─────────── ENGLISH ───────────
  en: {
    game: {
      name: 'GRAVITY',
      tagline: 'the last spark rises to silence',
      subtitle: 'Gravity. Timing. Speed.',
      version: 'v1.0 · silent run',
    },
    nav: {
      home: 'Home',
      journey: 'Journey',
      bestiary: 'Bestiary',
      settings: 'Settings',
      back: 'Back',
      map: 'Map',
    },
    menu: {
      story_continue: 'Continue the Journey',
      story_begin: 'Begin the Journey',
      story_desc: '9-chapter story · ≈ 22h',
      infinite: 'Endless Mode',
      infinite_desc: 'endless ascent · shifting zones',
      best: 'best · {n} pts',
      footer: '{n} levels · 9 bosses · ≈ 22h of ascent',
    },
    intro: {
      label: 'Prologue',
      skip: 'Skip prologue',
      continue: 'Continue',
      lines: [
        'Before silence, there was light.',
        'Before light, there was gravity.',
        '',
        'When the sun died, a single spark remained.',
        'It carries the last warmth of a world gone dark.',
        '',
        'Now it must rise — cross the void,',
        'chain orbits as one might pray,',
        'gather momentum from each dead world.',
        '',
        '*If it reaches the Heart of the Void,',
        '*perhaps it will rekindle what was lost.',
      ],
    },
    map: {
      title: 'The Journey · 9 chapters',
      progress: 'progress · {done} / {total}',
      chapter_label: 'chapter',
      ix_label: 'IX · Aurora',
      status: {
        sealed:    '◇ sealed',
        current:   '◆ in progress',
        completed: '✓ complete',
        available: '◇ available',
      },
      stats: {
        distance: 'Distance',
        levels: 'Levels',
        duration: 'Duration',
        biome: 'Biome',
      },
      action_continue: 'Continue — level {n}',
      action_begin: 'Begin chapter',
      action_next_in: '· next level in ≈ 5 min ·',
      locked_hint: '◇ Sealed — complete the previous chapter to unlock',
      levels_short: '{n} levels',
    },
    boss: {
      label: 'Boss',
      view: 'view →',
      meeting: 'Encounter · Chapter {r}',
      meeting_lower: 'boss · chapter {r}',
      final: 'final encounter of the chapter',
      hazards: 'hazards of the chapter',
      confront: 'Confront',
      back_map: 'Back to map',
    },
    pause: {
      label: 'pause',
      title: 'Paused',
      resume: 'Resume',
      restart: 'Restart level',
      quit: 'Quit to map',
      sound: 'sound',
      vibration: 'vibration',
      on: 'on',
      off: 'off',
    },
    gameover: {
      end: 'End',
      tail_chapter: 'but the ascent continues.',
      tail_infinite: 'the ascent continues without you.',
      altitude: 'Altitude',
      points: 'Points',
      best: 'Best',
      new_best: '✦  New best  ✦',
      retry: 'Try again',
      back_map: 'Back to map',
      back_menu: 'Back to menu',
      death: {
        default:    'the spark went dark',
        regression: 'Fell to the past',
        nopush:     'No impulse',
        asteroid:   'Asteroid',
        collapse:   'The orbit collapsed',
      },
    },
    bestiary: {
      title: 'Bestiary · nine encounters',
      known: '{n} / 09 known',
      unknown_name: '· · · · · · ·',
      unknown_title: 'unknown',
      unknown_desc: 'Cross the previous chapter to reveal.',
      sealed: '◇ sealed',
    },
    hud: {
      altitude: 'Altitude',
      points: '· points · {n}',
      rising_label: 'Rising',
      rising_hint: 'chain orbits to rise against the crimson tide.',
      pause: '‖  Pause',
      in_orbit: 'in orbit',
      hold_to_orbit: 'hold to orbit',
      entering: 'entering',
      phase_label: 'phase',
      phase_n: 'Phase {n} · {total}',
      chapter_complete: 'chapter complete',
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      sound: 'Sound',
      music: 'Music',
      vibration: 'Vibration',
      reset: 'Reset progress',
      reset_confirm: 'Are you sure? This cannot be undone.',
      reset_yes: 'Erase everything',
      reset_no: 'Cancel',
      reset_done: 'Progress erased.',
      languages: {
        pt: 'Portuguese',
        en: 'English',
        es: 'Spanish',
      },
      about: 'About',
      about_text: 'GRAVITY — a quiet game about rising.\nMade with care, played in silence.',
    },
    chapter_label: 'Chapter',
    zones: {
      blue_void:        'Blue Void',
      golden_dust:      'Golden Dust',
      violet_nebula:    'Violet Nebula',
      emerald_sea:      'Emerald Sea',
      crimson_twilight: 'Crimson Twilight',
      sea_of_shadows:   'Sea of Shadows',
      eye_of_abyss:     'Eye of the Abyss',
      aurora:           'Aurora',
    },
    distance_special: {
      heart_of_void: 'Heart of the Void',
    },
    chapters: {
      1: {
        name: 'Awakening',
        subtitle: 'The spark opens its eyes',
        quote: 'The first fall is the lightest. The cosmos has not yet noticed.',
        biome: 'Cradle of the dead star',
        description: 'Gentle anchors, soft remnants of a star that was once a sun. The silent tutorial.',
        boss: { name: 'The Mirror', title: 'guardian of memory', desc: 'Your own light reflected back, embodied in a blue giant. It forces you to see what you were.' },
        hazards: ['Standard anchors', 'Static asteroids'],
      },
      2: {
        name: 'Broken Belt',
        subtitle: 'Where worlds died first',
        quote: 'Orbit still lives in the rubble. Learn to read what remains.',
        biome: 'Debris belt',
        description: 'Slow-drifting planetary remains. You learn to plan two moves ahead.',
        boss: { name: 'Stone Warden', title: 'the one that does not fall', desc: 'An asteroid the size of a moon. Its own gravity, orbiting a flaw in space.' },
        hazards: ['Rotating asteroids', 'Dust fields'],
      },
      3: {
        name: 'Tides of Jupiter',
        subtitle: 'The giant breathes',
        quote: 'Feel the pulse. Each beat opens a window to pass.',
        biome: 'Gas giant rings',
        description: 'Pulsars introduced. Gravity pulses in rhythm — find the right beat.',
        boss: { name: 'Pulsar Heart', title: 'metronome of worlds', desc: 'A pulsar breathing on a five-second beat. Miss the timing and its mass crushes you.' },
        hazards: ['Pulsars', 'Plasma winds'],
      },
      4: {
        name: 'The Wanderers',
        subtitle: 'Comets that sing',
        quote: 'They came from afar. They pass through you as if you were not there.',
        biome: 'Interstellar space',
        description: 'Comets cross the sky with long trails. You must anticipate and turn them to your favor.',
        boss: { name: 'Atlas Comet', title: 'the long-tailed', desc: 'A comet the size of a continent, with a tail miles long. It crosses the sky three times — then returns.' },
        hazards: ['Comets on trajectory', 'Cold plasma tails'],
      },
      5: {
        name: 'Threshold',
        subtitle: 'Where light begins to hesitate',
        quote: 'You do not cross the threshold. The threshold crosses through you.',
        biome: 'System frontier',
        description: 'Extreme density. Dense debris fields, rarer anchors, quick decisions.',
        boss: { name: 'The Swarm', title: 'a thousand stones with one will', desc: 'It is not one — it is a thousand. Small asteroids moving as a shoal. Kill the mind, or skirt it.' },
        hazards: ['Dense debris fields', 'Rare dwarf anchors'],
      },
      6: {
        name: 'Sea of Shadows',
        subtitle: 'The darkness between stars',
        quote: 'When there is no light, gravity is the only sense.',
        biome: 'Deep vacuum',
        description: 'The screen almost black. You feel the anchors before you see them. Implicit sonar.',
        boss: { name: 'The Nothing', title: 'that which was not', desc: 'It has no body. It has no light. Only a mass where nothing exists — and gravity that pulls forever.' },
        hazards: ['Reduced visibility', 'Invisible anchors'],
      },
      7: {
        name: 'Eye of the Abyss',
        subtitle: 'The mouth of the giant',
        quote: 'The fall is his now. You only choose the angle.',
        biome: 'Event horizon',
        description: 'Black holes. Gravity bends light, time distorts. Massive slingshots.',
        boss: { name: 'Gargantua', title: 'the time-devourer', desc: 'A supermassive black hole. The entire fight is a single perfect orbit around the horizon.' },
        hazards: ['Black holes', 'Time distortion', 'Suicide comets'],
      },
      8: {
        name: 'Tesseract',
        subtitle: 'Time folded into itself',
        quote: 'You meet yourself on the other side of the fall.',
        biome: 'Inside the horizon',
        description: 'Impossible geometry. Anchors appear off the grid. Time flows in different directions.',
        boss: { name: 'The Echo', title: 'yourself, before', desc: 'A version of you from another timeline, chaining slingshots in the opposite direction. You collide if either misses the rhythm.' },
        hazards: ['Temporal reflections', 'Reverse gravity'],
      },
      9: {
        name: 'Aurora',
        subtitle: 'The sun breathes again',
        quote: 'You did not arrive. You became the destination.',
        biome: 'The center',
        description: 'You cross the heart of the dead star. Each orbit relights a filament. The emotional finale.',
        boss: { name: 'Heart of the Star', title: 'the sun that fell asleep', desc: 'The inert heart of the sun that died. To rekindle it, you must give everything — distance, velocity, yourself.' },
        hazards: ['Solar filaments', 'Reignition'],
      },
    },
  },

  // ─────────── ESPAÑOL ───────────
  es: {
    game: {
      name: 'GRAVITY',
      tagline: 'la última chispa sube al silencio',
      subtitle: 'Gravedad. Tiempo. Velocidad.',
      version: 'v1.0 · silent run',
    },
    nav: {
      home: 'Inicio',
      journey: 'Jornada',
      bestiary: 'Bestiario',
      settings: 'Ajustes',
      back: 'Volver',
      map: 'Mapa',
    },
    menu: {
      story_continue: 'Continuar la Jornada',
      story_begin: 'Comenzar la Jornada',
      story_desc: 'historia en 9 capítulos · ≈ 22h',
      infinite: 'Modo Infinito',
      infinite_desc: 'ascenso sin fin · zonas cambiantes',
      best: 'récord · {n} pts',
      footer: '{n} fases · 9 jefes · ≈ 22h de ascenso',
    },
    intro: {
      label: 'Prólogo',
      skip: 'Saltar prólogo',
      continue: 'Continuar',
      lines: [
        'Antes del silencio, hubo luz.',
        'Antes de la luz, hubo gravedad.',
        '',
        'Cuando el sol murió, sólo quedó una chispa.',
        'Lleva el último calor de un mundo apagado.',
        '',
        'Ahora debe subir — atravesar el vacío,',
        'encadenar órbitas como quien reza,',
        'ganar impulso de cada planeta muerto.',
        '',
        '*Si alcanza el Corazón del Vacío,',
        '*quizás reavive lo perdido.',
      ],
    },
    map: {
      title: 'La Jornada · 9 capítulos',
      progress: 'progreso · {done} / {total}',
      chapter_label: 'capítulo',
      ix_label: 'IX · Aurora',
      status: {
        sealed:    '◇ sellado',
        current:   '◆ en curso',
        completed: '✓ completo',
        available: '◇ disponible',
      },
      stats: {
        distance: 'Distancia',
        levels: 'Fases',
        duration: 'Duración',
        biome: 'Bioma',
      },
      action_continue: 'Continuar — fase {n}',
      action_begin: 'Comenzar capítulo',
      action_next_in: '· próxima fase en ≈ 5 min ·',
      locked_hint: '◇ Sellado — completa el capítulo anterior para abrir',
      levels_short: '{n} fases',
    },
    boss: {
      label: 'Jefe',
      view: 'ver →',
      meeting: 'Encuentro · Capítulo {r}',
      meeting_lower: 'jefe · capítulo {r}',
      final: 'encuentro final del capítulo',
      hazards: 'amenazas del capítulo',
      confront: 'Enfrentar',
      back_map: 'Volver al mapa',
    },
    pause: {
      label: 'pausa',
      title: 'En pausa',
      resume: 'Continuar',
      restart: 'Reiniciar fase',
      quit: 'Salir al mapa',
      sound: 'sonido',
      vibration: 'vibración',
      on: 'activada',
      off: 'desactivada',
    },
    gameover: {
      end: 'Fin',
      tail_chapter: 'pero el ascenso continúa.',
      tail_infinite: 'el ascenso continúa sin ti.',
      altitude: 'Altitud',
      points: 'Puntos',
      best: 'Récord',
      new_best: '✦  Nuevo récord  ✦',
      retry: 'Intentar de nuevo',
      back_map: 'Volver al mapa',
      back_menu: 'Volver al menú',
      death: {
        default:    'la chispa se apagó',
        regression: 'Cayó al pasado',
        nopush:     'Sin impulso',
        asteroid:   'Asteroide',
        collapse:   'La órbita colapsó',
      },
    },
    bestiary: {
      title: 'Bestiario · nueve encuentros',
      known: '{n} / 09 conocidos',
      unknown_name: '· · · · · · ·',
      unknown_title: 'desconocido',
      unknown_desc: 'Atraviesa el capítulo anterior para revelar.',
      sealed: '◇ sellado',
    },
    hud: {
      altitude: 'Altitud',
      points: '· puntos · {n}',
      rising_label: 'Subiendo',
      rising_hint: 'encadena órbitas para subir contra la marea carmesí.',
      pause: '‖  Pausar',
      in_orbit: 'en órbita',
      hold_to_orbit: 'mantén para orbitar',
      entering: 'entrando en',
      phase_label: 'fase',
      phase_n: 'Fase {n} · {total}',
      chapter_complete: 'capítulo completo',
    },
    settings: {
      title: 'Ajustes',
      language: 'Idioma',
      sound: 'Sonido',
      music: 'Música',
      vibration: 'Vibración',
      reset: 'Borrar progreso',
      reset_confirm: '¿Estás seguro? Esta acción no se puede deshacer.',
      reset_yes: 'Borrar todo',
      reset_no: 'Cancelar',
      reset_done: 'Progreso borrado.',
      languages: {
        pt: 'Portugués',
        en: 'Inglés',
        es: 'Español',
      },
      about: 'Acerca de',
      about_text: 'GRAVITY — un juego silencioso sobre subir.\nHecho con cuidado, jugado en silencio.',
    },
    chapter_label: 'Capítulo',
    zones: {
      blue_void:        'Vacío Azul',
      golden_dust:      'Polvo Dorado',
      violet_nebula:    'Nebulosa Violeta',
      emerald_sea:      'Mar Esmeralda',
      crimson_twilight: 'Crepúsculo Carmesí',
      sea_of_shadows:   'Mar de Sombras',
      eye_of_abyss:     'Ojo del Abismo',
      aurora:           'Aurora',
    },
    distance_special: {
      heart_of_void: 'Corazón del Vacío',
    },
    chapters: {
      1: {
        name: 'Despertar',
        subtitle: 'La chispa abre los ojos',
        quote: 'La primera caída es la más leve. El cosmos aún no lo ha notado.',
        biome: 'Cuna de la estrella muerta',
        description: 'Anchors apacibles, restos suaves de una estrella que un día fue sol. El tutorial silencioso.',
        boss: { name: 'El Espejo', title: 'guardián de la memoria', desc: 'El reflejo de la propia luz, encarnado en un gigante azul. Te obliga a ver lo que fuiste.' },
        hazards: ['Anchors estándar', 'Asteroides estáticos'],
      },
      2: {
        name: 'Cinturón Roto',
        subtitle: 'Donde los mundos murieron primero',
        quote: 'Aún hay órbita en los escombros. Aprende a leer lo que queda.',
        biome: 'Cinturón de detritos',
        description: 'Restos planetarios en movimiento lento. Se aprende a planear dos jugadas adelante.',
        boss: { name: 'Guardián de Piedra', title: 'el que no cae', desc: 'Un asteroide del tamaño de una luna. Gravedad propia, orbita una grieta en el espacio.' },
        hazards: ['Asteroides en rotación', 'Campos de polvo'],
      },
      3: {
        name: 'Mareas de Júpiter',
        subtitle: 'El gigante respira',
        quote: 'Siente el pulso. Cada latido abre una ventana para pasar.',
        biome: 'Anillos de gigantes gaseosos',
        description: 'Púlsares introducidos. La gravedad pulsa en ritmo — encuentra el compás justo.',
        boss: { name: 'Corazón Púlsar', title: 'metrónomo de los mundos', desc: 'Un púlsar que respira en compás de cinco segundos. Yerra el tiempo y su masa te aplasta.' },
        hazards: ['Púlsares', 'Vientos de plasma'],
      },
      4: {
        name: 'Los Errantes',
        subtitle: 'Cometas que cantan',
        quote: 'Vinieron de lejos. Te atraviesan como si no existieras.',
        biome: 'Espacio interestelar',
        description: 'Cometas atraviesan el cielo con largas estelas. Hay que anticiparlos y usarlos a tu favor.',
        boss: { name: 'Cometa Atlas', title: 'el de cola larga', desc: 'Un cometa del tamaño de un continente, con cola de kilómetros. Cruza el cielo tres veces — y vuelve.' },
        hazards: ['Cometas en trayectoria', 'Estelas de plasma frío'],
      },
      5: {
        name: 'Umbral',
        subtitle: 'Donde la luz comienza a vacilar',
        quote: 'No cruzas el umbral. El umbral te cruza a ti.',
        biome: 'Frontera del sistema',
        description: 'Densidad extrema. Campos densos de detritos, anchors más raros, decisiones rápidas.',
        boss: { name: 'El Enjambre', title: 'mil piedras con una sola voluntad', desc: 'No es uno — son mil. Pequeños asteroides que se mueven como cardumen. Mata la mente, o esquívala.' },
        hazards: ['Campos densos de detritos', 'Anchors enanos raros'],
      },
      6: {
        name: 'Mar de Sombras',
        subtitle: 'La oscuridad entre estrellas',
        quote: 'Cuando no hay luz, la gravedad es el único sentido.',
        biome: 'Vacío profundo',
        description: 'La pantalla casi negra. Sientes los anchors antes de verlos. Sonar implícito.',
        boss: { name: 'La Nada', title: 'aquello que no fue', desc: 'Sin cuerpo. Sin luz. Sólo una masa donde nada existe — y gravedad que tira eternamente.' },
        hazards: ['Visibilidad reducida', 'Anchors invisibles'],
      },
      7: {
        name: 'Ojo del Abismo',
        subtitle: 'La boca del gigante',
        quote: 'Ahora la caída es suya. Tú sólo decides el ángulo.',
        biome: 'Horizonte de eventos',
        description: 'Agujeros negros. La gravedad dobla la luz, el tiempo se distorsiona. Hondazos gigantescos.',
        boss: { name: 'Gargantúa', title: 'el que devora tiempo', desc: 'Un agujero negro supermasivo. Todo el combate es una sola órbita perfecta en torno al horizonte.' },
        hazards: ['Agujeros negros', 'Distorsión del tiempo', 'Cometas suicidas'],
      },
      8: {
        name: 'Teseracto',
        subtitle: 'Tiempo plegado sobre sí',
        quote: 'Te encuentras al otro lado de la caída.',
        biome: 'Interior del horizonte',
        description: 'Geometría imposible. Los anchors aparecen fuera de la grilla. El tiempo fluye en sentidos distintos.',
        boss: { name: 'El Eco', title: 'tú mismo, antes', desc: 'Una versión tuya de otra línea temporal, encadenando hondazos en sentido contrario. Chocan si pierden el ritmo.' },
        hazards: ['Reflejos temporales', 'Gravedad reversa'],
      },
      9: {
        name: 'Aurora',
        subtitle: 'El sol respira de nuevo',
        quote: 'No llegaste. Te volviste el destino.',
        biome: 'El centro',
        description: 'Atraviesas el corazón de la estrella muerta. Cada órbita reaviva un filamento. El final emocional.',
        boss: { name: 'Corazón de la Estrella', title: 'el sol que se durmió', desc: 'El corazón inerte del sol que murió. Para reavivarlo, hay que entregar todo — distancia, velocidad, a ti mismo.' },
        hazards: ['Filamentos solares', 'Reignición'],
      },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTERS — language-neutral gameplay data
// All text (name/subtitle/quote/desc/biome/boss/hazards) is in I18N.chapters.<id>.
// Distance is stored as raw range; special chapter 9 uses key 'heart_of_void'.
// ─────────────────────────────────────────────────────────────────────────────

const CHAPTERS = [
  { id: 1, roman: 'I',    distanceRaw: '0 — 2 400 ly',       levels: 12, duration: '≈ 1h 40min', palette: ['#1a2540', '#3a5a8a', '#f4b860'], bossColor: '#6db8d5' },
  { id: 2, roman: 'II',   distanceRaw: '2 400 — 6 800 ly',   levels: 14, duration: '≈ 2h 10min', palette: ['#2a1f1a', '#6a4a35', '#d97744'], bossColor: '#a07050' },
  { id: 3, roman: 'III',  distanceRaw: '6 800 — 14 200 ly',  levels: 14, duration: '≈ 2h 30min', palette: ['#3d2818', '#a55a2a', '#f4b860'], bossColor: '#f4b860' },
  { id: 4, roman: 'IV',   distanceRaw: '14 200 — 24 000 ly', levels: 14, duration: '≈ 2h 40min', palette: ['#0f2438', '#4080a8', '#a8d8e8'], bossColor: '#a8d8e8' },
  { id: 5, roman: 'V',    distanceRaw: '24 000 — 38 000 ly', levels: 14, duration: '≈ 2h 50min', palette: ['#1a1830', '#5a4a7a', '#9a88c0'], bossColor: '#9a88c0' },
  { id: 6, roman: 'VI',   distanceRaw: '38 000 — 56 000 ly', levels: 15, duration: '≈ 3h 00min', palette: ['#080a14', '#1a2030', '#3a4a6a'], bossColor: '#1a2030' },
  { id: 7, roman: 'VII',  distanceRaw: '56 000 — 78 000 ly', levels: 15, duration: '≈ 3h 20min', palette: ['#1a0810', '#5a1a2a', '#d04060'], bossColor: '#d04060' },
  { id: 8, roman: 'VIII', distanceRaw: '78 000 — 96 000 ly', levels: 12, duration: '≈ 2h 50min', palette: ['#0a1a2a', '#3a6890', '#c0e0f0'], bossColor: '#c0e0f0' },
  { id: 9, roman: 'IX',   distanceRaw: null,                 levels:  8, duration: '≈ 1h 20min', palette: ['#2a1a08', '#d97744', '#ffd890'], bossColor: '#ffd890' },
];

const TOTAL_LEVELS = CHAPTERS.reduce((s, c) => s + c.levels, 0);
const TOTAL_HOURS_KEY = '≈ 22h';

// Progression — meters of altitude that count as one cleared level. Tune to taste.
// chapter 1 (12 levels) completes at ~960m; chapter 9 (8 levels) at ~640m.
const LEVEL_DISTANCE_M = 80;

// Distance display — translates the special "Heart of the Void" key for chapter 9.
function chapterDistance(ch) {
  return ch.distanceRaw != null ? ch.distanceRaw : t('distance_special.heart_of_void');
}

// Sum of completed levels across all chapters (for "progress · 03 / 118")
function chaptersDoneCount() {
  const p = getProgress();
  return CHAPTERS.reduce((s, c) => s + Math.min(p[c.id] || 0, c.levels), 0);
}

// State derivation — locked / current / completed / available
function chapterState(ch) {
  const p = getProgress();
  const done = p[ch.id] || 0;
  if (done >= ch.levels) return 'completed';
  if (done > 0) return 'current';
  // ch1 always unlocked; others require previous completion
  if (ch.id === 1) return 'available';
  const prev = CHAPTERS.find(c => c.id === ch.id - 1);
  const prevDone = (p[prev.id] || 0) >= prev.levels;
  return prevDone ? 'available' : 'sealed';
}

function chapterProgress(ch) {
  const p = getProgress();
  return Math.min(p[ch.id] || 0, ch.levels);
}

function bestiaryKnownCount() {
  // A chapter's boss is "known" if it's at least available
  return CHAPTERS.filter(c => chapterState(c) !== 'sealed').length;
}

// First chapter not yet completed — what "Continue the Journey" should resume into.
// Falls back to the last chapter once the whole journey is done.
function currentChapter() {
  return CHAPTERS.find(c => chapterState(c) !== 'completed') || CHAPTERS[CHAPTERS.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// INFINITE_ZONES — endless mode bands. Names reference i18n zone keys.
// ─────────────────────────────────────────────────────────────────────────────

const INFINITE_ZONES = [
  { key: 'blue_void',        palette: ['#0a1530', '#3a5a8a', '#6db8d5'], depth: 1200 },
  { key: 'golden_dust',      palette: ['#2a1f1a', '#a55a2a', '#f4b860'], depth: 1200 },
  { key: 'violet_nebula',    palette: ['#1a0f2a', '#5a3a7a', '#9a78d0'], depth: 1200 },
  { key: 'emerald_sea',      palette: ['#0a2018', '#2a5a48', '#6dd5a8'], depth: 1200 },
  { key: 'crimson_twilight', palette: ['#1a0510', '#5a1a2a', '#d04060'], depth: 1200 },
  { key: 'sea_of_shadows',   palette: ['#040508', '#1a2030', '#3a4a6a'], depth: 1500 },
  { key: 'eye_of_abyss',     palette: ['#10000a', '#3a0820', '#7a1a3a'], depth: 1500 },
  { key: 'aurora',           palette: ['#2a1a08', '#d97744', '#ffd890'], depth: 1500 },
];

// ─────────────────────────────────────────────────────────────────────────────
// PLANET_VARIANTS — visual skins, independent of gameplay function.
// ─────────────────────────────────────────────────────────────────────────────

const PLANET_VARIANTS = {
  barren:    { surface: '#5a544a', spots: '#3a342a', spotCount: 6 },
  ice:       { surface: '#c8e4f0', spots: '#7090a8', spotCount: 4 },
  desert:    { surface: '#c89060', spots: '#8a5a30', spotCount: 5 },
  ocean:     { surface: '#3870a8', spots: '#a8d0e8', spotCount: 4 },
  verdant:   { surface: '#4a8a60', spots: '#2a5a3a', spotCount: 5 },
  gasWarm:   { bands: ['#d97744', '#c8602a', '#a04830', '#e89060'] },
  gasCool:   { bands: ['#4a78a8', '#2a5a8a', '#3a68a0', '#5a88c0'] },
  gasViolet: { bands: ['#7a5aa0', '#5a3a80', '#9a78c0', '#4a2a70'] },
  lava:      { surface: '#5a1a1a', spots: '#ff6030', spotCount: 7, glow: '#ff5020' },
  ringed:    { surface: '#e8c890', ring: '#a89060', spots: '#a08850', spotCount: 3 },
  pulsar:    { surface: '#fff0c0', glow: '#f4b860', pulse: true },
  voidBh:    { surface: '#000000', ring: '#d04060', lensing: true },
  starlit:   { surface: '#f0d090', spots: '#d89060', spotCount: 3, glow: '#ffd890' },
  rust:      { surface: '#8a4a30', spots: '#5a2a18', spotCount: 5 },
};

const TYPE_TO_VARIANTS = {
  dwarf:    ['barren', 'ice', 'desert', 'rust'],
  standard: ['ocean', 'verdant', 'barren', 'desert', 'rust', 'ice'],
  giant:    ['gasWarm', 'gasCool', 'gasViolet', 'ringed', 'lava', 'starlit'],
  pulsar:   ['pulsar'],
  blackhole:['voidBh'],
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — all globals on window for the babel-standalone setup
// ─────────────────────────────────────────────────────────────────────────────

window.CHAPTERS         = CHAPTERS;
window.TOTAL_LEVELS     = TOTAL_LEVELS;
window.TOTAL_HOURS_KEY  = TOTAL_HOURS_KEY;
window.LEVEL_DISTANCE_M = LEVEL_DISTANCE_M;
window.INFINITE_ZONES   = INFINITE_ZONES;
window.PLANET_VARIANTS  = PLANET_VARIANTS;
window.TYPE_TO_VARIANTS = TYPE_TO_VARIANTS;

window.t               = t;
window.getLocale       = getLocale;
window.setLocale       = setLocale;
window.onLocaleChange  = onLocaleChange;
window.SUPPORTED_LOCALES = SUPPORTED_LOCALES;

window.chapterDistance     = chapterDistance;
window.chaptersDoneCount   = chaptersDoneCount;
window.chapterState        = chapterState;
window.chapterProgress     = chapterProgress;
window.bestiaryKnownCount  = bestiaryKnownCount;
window.currentChapter      = currentChapter;

window.getBestScore   = getBestScore;
window.setBestScore   = setBestScore;
window.getProgress    = getProgress;
window.setProgress    = setProgress;
window.resetProgress  = resetProgress;
window.getSettings    = getSettings;
window.setSettings    = setSettings;
