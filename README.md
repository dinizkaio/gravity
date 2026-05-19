# GRAVITY

> a última fagulha sobe ao silêncio

Um jogo silencioso sobre subir. Toque para entrar em órbita, solte para se lançar. Encadeie órbitas e suba contra a maré vermelha que avança atrás de você.

— campanha narrativa em 9 capítulos · 9 chefões · ~118 fases · ≈22h
— modo infinito com 8 zonas que se transformam
— PT-BR · EN · ES

## Como rodar localmente

```bash
# qualquer servidor HTTP estático serve — os scripts são carregados como módulos
python3 -m http.server 8000
# então abra http://localhost:8000/Gravity.html
```

Não há build step. Babel-standalone transforma o JSX no navegador. Para deploy, basta servir os arquivos estáticos a partir de qualquer host (Vercel, Netlify, GitHub Pages, etc).

## Estrutura

```
Gravity.html       # entry point — carrega React, Babel, e os scripts na ordem
data.js            # i18n PT/EN/ES, persistência (localStorage), CHAPTERS, ZONES
game-engine.jsx    # GameCanvas — física, render, input, HUD
screens.jsx        # IntroScreen, MainMenu, ChapterMap, ChapterDetail, AmbientBackground
screens-2.jsx      # BossIntro, PauseOverlay, GameOver, Bestiary, SettingsScreen
app.jsx            # App router (state machine de telas) + NavHint
styles.css         # tipografia (Cormorant Garamond + Inter + JetBrains Mono), tokens, animações
```

## i18n

Todas as strings visíveis ao jogador estão em `data.js` sob `I18N.{pt,en,es}`. Acessadas por `t('caminho.da.chave', { params })`. O idioma é detectado do `navigator.language` na primeira visita e persistido em `localStorage` (`gravity.locale`). Pode ser trocado em **Configurações**.

Convenções:
- Linhas em itálico no prólogo são marcadas com `*` no início (ex: `'*Se chegar ao Coração do Vazio,'`). O marker é removido na renderização.
- Strings com placeholders usam chaves entre chaves: `'progresso · {done} / {total}'`.
- Strings específicas de capítulo ficam em `chapters.<id>.{name,subtitle,quote,description,biome,hazards,boss.{name,title,desc}}`.

**Regra**: ao adicionar uma string nova, ela precisa existir nas três línguas. O fallback é PT — se a chave faltar em EN/ES, o PT aparece no lugar.

## Persistência

Chaves de `localStorage`:

| chave | conteúdo |
|---|---|
| `gravity.locale`    | `'pt'` \| `'en'` \| `'es'` |
| `gravity.bestScore` | número (recorde global do jogador) |
| `gravity.progress`  | `{ [chapterId]: completedLevels }` |
| `gravity.settings`  | `{ sound, music, vibration }` |

Helpers expostos em `window`: `getBestScore`, `setBestScore`, `getProgress`, `setProgress`, `resetProgress`, `getSettings`, `setSettings`.

## Mecânica (resumida)

- O jogador é uma fagulha lançada para cima com velocidade inicial.
- Gravidade puxa para baixo. Sem orbitar, a fagulha desacelera, para, e cai.
- Toque/segure: a fagulha trava em órbita ao redor do anchor mais próximo.
- Solte: a fagulha se lança na tangente, levando a velocidade angular.
- A "regression horizon" é uma linha vermelha que sobe a cada órbita capturada. Se o jogador cair abaixo dela, morre.

Cada capítulo introduz um tipo novo de anchor/perigo (pulsares, cometas, buracos negros, etc.). O modo infinito faz crossfade contínuo entre zonas com paletas distintas.

## Notas para quem for evoluir o código

- **Locale reativo**: componentes que usam `t()` precisam re-renderizar quando o idioma muda. O `App.jsx` faz isso via `onLocaleChange` + force-tick. Componentes filhos herdam por re-render do pai. O `GameCanvas` também tem seu próprio listener para o HUD.
- **Pausa**: a flag `paused` é uma prop do `GameCanvas`, lida por `useRef` dentro do loop de rAF. Quando `true`, `update()` é pulado mas `render()` continua. **Não remontar** o `GameCanvas` para pausar — isso reinicia toda a partida.
- **Restart**: incrementar `runKey` no `App` e usar como `key` no `GameCanvas` — força remount limpo sem flicker.
- **Death reasons**: passar a **chave** (`'asteroid'`, `'regression'`, `'nopush'`, `'default'`) para `onDeath`, não a string traduzida. A tela de game over olha em `gameover.death.<key>`.
- **Cores de chefões**: `chapter.bossColor` (no top-level do CHAPTERS, não em `boss.color` — toda a string do boss vive no i18n).
- **Zone names**: `INFINITE_ZONES[i].key` referencia `zones.<key>` no i18n.

## Próximos passos sugeridos

- Áudio (atualmente os toggles de Som/Música existem mas não tocam nada — placeholders).
- Vibração via `navigator.vibrate` ao orbitar/morrer.
- Tela de vitória de capítulo (`onVictory` separado de `onDeath`).
- Implementar progressão real (fase a fase) — hoje o `progress` é incrementado só por morte/recorde.
- PWA: manifest + service worker para jogar offline.
