# Handoff / log sesji

Notatka, żeby z każdego urządzenia (też telefon) było widać, co ustaliliśmy i gdzie jesteśmy.
Czytelna w aplikacji GitHub albo w sesji Claude w chmurze podpiętej do tego repo.

## Sesja: 2026-06-12 (start projektu)

### Decyzje
- **Cel projektu:** webowy **kreator animacji Lottie od zera** (timeline, warstwy, keyframe'y, presety),
  nie tylko edytor istniejących plików.
- **Stack:** Vite + React + TypeScript + Zustand + lottie-web. Wybrane pod zaawansowane funkcje
  (dużo stanu: warstwy + keyframe'y per property + playhead + undo/redo).
- **Repo:** PUBLIC na GitHubie (jak grid-blob / typestorm / wiredraft), konto `vod123qwe`.
- **Hosting:** GitHub Pages przez GitHub Actions, auto-deploy na push do `main`.

### Gdzie to jest
- **Live:** https://vod123qwe.github.io/lottie-studio/
- **Repo:** https://github.com/vod123qwe/lottie-studio
- **Lokalnie:** `F:\AI - Tests\lottie-studio\`, dev `npm run dev` (w preview na porcie 5181).

### Stan v0.1 (zweryfikowane, działa)
- Scena z podglądem na żywo (lottie-web) + overlay zaznaczenia, drag kształtu = zmiana pozycji.
- Warstwy: prostokąty i elipsy; reorder / duplikuj / ukryj / zmień nazwę.
- Timeline: ruler ze scrubem, wiersz na warstwę, rozwinięcie w ścieżki property, draggable keyframe.
- Keyframe'y dla position / scale / rotation / opacity / fill + easing (linear, ease in/out/in-out).
- Auto-key, undo/redo (drag = jeden wpis historii).
- Presety: Fade In/Out, Pop In, Slide ←/→, Spin, Pulse, Drop In.
- Export Lottie JSON + Save/Open własnego projektu.
- `tsc --noEmit` czysto, brak błędów w konsoli. Sprawdzone: Spin → 2 keyframe rotacji
  (macierz ~164° przy klatce 41 = poprawnie), Pop In → 3 keyframe scale, transport działa.

### Mapa plików (gdzie czego szukać)
- `src/core/model.ts` — model edytora (źródło prawdy, nie surowy Lottie).
- `src/core/builder.ts` — model → poprawny Lottie (bodymovin) JSON.
- `src/core/interpolate.ts` — wartość property w danej klatce (cubic-bezier).
- `src/core/presets.ts` — presety animacji.
- `src/store/editorStore.ts` — Zustand: stan, mutacje, undo/redo, live-drag.
- `src/components/` — Stage, Toolbar, LayerPanel, PropertiesPanel, Timeline.
- `.github/workflows/deploy.yml` — build + deploy na Pages.

### Pętla pracy z telefonu (przez Claude w chmurze)
1. W Claude (chmura) wybierz repo `vod123qwe/lottie-studio`, zrób zmiany, zmerguj PR do `main`.
2. Push do `main` sam odpala deploy (~1 min).
3. Odśwież https://vod123qwe.github.io/lottie-studio/ na telefonie i zobacz efekt.

### Roadmap / następne kroki
- [ ] Import istniejących `.json` / `.lottie` (reverse-map do modelu edytora).
- [ ] Export `.lottie` (dotLottie).
- [ ] Więcej kształtów: pen/path tool, polygon/star, tekst.
- [ ] Spatial bezier dla pozycji (krzywe ruchu), motion blur.
- [ ] Color picker keyframe na timeline, copy/paste keyframe'ów.

## Sesja: 2026-06-12 (redesign UI — jasny motyw „Arcade")

### Decyzje
- **Kierunek:** polish UI/UX. Inspiracja: Arcade (czysty jasny SaaS).
- **Motyw:** pełny **light** (białe/szare panele, hairline ramki, miękkie low-opacity cienie).
- **Akcent:** kobaltowy `#2F5BF6` (primary, aktywne stany), koralowy `#F5365C` na playhead + kropkę w logo.
- **Typografia:** Inter (Google Fonts). **Ikony:** line-style SVG zamiast emoji.

### Co zrobione (zweryfikowane na zbudowanej wersji, screenshoty)
- Nowy system designu w `src/index.css`: tokeny kolorów/odstępów/promieni/cieni, kontrolki
  (primary/ghost/icon-btn, toggle `.switch`, segmented `.seg`, `.num` z jednostką w polu).
- `src/components/Icons.tsx` — jeden komponent `<Icon name=… />`, ~30 ikon (toolbar, panele, presety).
- Toolbar: ikony + separatory, primary „Export Lottie", Auto-key jako pill z rec-dotem.
- LayerPanel: ikony (eye/eye-off, reorder, duplicate, trash), stan „hidden", licznik warstw.
- PropertiesPanel: **zwijane sekcje** (Composition/Shape/Transform/Presets/Selected keyframe),
  easing jako **segmented** (Linear/In/Out/In·Out), presety z ikonami.
- Timeline: caret-ikona, subtelna pionowa siatka zsynchronizowana z linijką, koralowy playhead z grotem,
  niebieskie romby keyframe (zaznaczony = pusty z ringiem).
- Stage: jasne tło z delikatnym gradientem, artboard z miękkim cieniem + checkerboard transparencji.
- `factory.ts`: domyślny `comp.bg` → `#ffffff` (pasuje do light). `index.html`: Inter + theme-color.
  Favicon przerobiony na jasny (niebieski ring + koralowa kropka).
- `tsc --noEmit` czysto, `vite build` OK.

### Następne kroki (UI/ficzery)
- Można ruszyć z funkcjami z roadmapy (import Lottie / kształty / timeline power-features).
- Drobiazgi do rozważenia: resizable panele, ikona „Fade Out" (sunset) czyta się trochę jak upload.

## Sesja: 2026-06-12 (resizable panele + import SVG per-element)

### Zrobione
- **Resizable panele** (`App.tsx`): przeciągane krawędzie lewego/prawego panelu i wysokości
  timeline, zapis w localStorage; splitter podświetla akcent. Min szer. inspektora podniesiona,
  pola liczbowe odchudzone — 3-cyfrowe wartości nie obcinają się (zweryfikowane pomiarem).
- **Import SVG → natywne warstwy (per-element)** — wybrana opcja B:
  - `core/svgImport.ts` — DOMParser + `svgpath` (arki→cubic, shorthand, transformy przez
    `.transform()`); każdy `<path/rect/circle/ellipse/line/poly*>` → osobna **warstwa** z geometrią
    beziera względem środka bboxa. Grupy `<g>` i transformy spłaszczane, fill/stroke/opacity
    dziedziczone, kolory hex/rgb/named. Całość dopasowana i wyśrodkowana w kompozycji.
  - Model: `ShapeType += 'path'`, `Layer.path?: SubPath[]`, `Layer.stroke?`, `Layer.fillEnabled?`.
  - `builder.ts`: emisja `sh` per kontur + warunkowy fill + `st` (stroke).
  - `factory.createPathLayer`, store: `addLayers`, `setFillEnabled/StrokeColor/StrokeWidth`.
  - Toolbar: przycisk **Import SVG**. Inspektor: dla `path` chowa W/H/R, pokazuje Fill (z toggle)
    + Stroke (kolor + grubość). Każdy element ma własny transform + presety.
  - Zależność: `svgpath`. Limity v1: bez gradientów/CSS-klas/`<text>`/`<use>`/`<image>` (pomijane,
    z ostrzeżeniem); fill-opacity uproszczone do opacity warstwy.
- `tsc --noEmit` czysto, `vite build` OK; przetestowane headless (4 warstwy z testowego SVG, render OK).

## Sesja: 2026-06-12 (rozbudowa presetów + easingi)

### Zrobione
- **Presety** (`core/presets.ts`): dodane pole `category` ('in'|'out'|'emphasis'|'loop') + ~20 nowych.
  Wejścia: Zoom In, Bounce In, Slide ↑/↓, Roll In, Fly In. Wyjścia: Zoom/Slide Out, Fall Out.
  Emphasis: Shake, Wobble, Heartbeat, Flash, Tada, Rubber Band. Pętle: Float, Breathe, Swing.
- **Filtr segmentowy** w sekcji Presets (In/Out/Emphasis/Loop) zamiast jednej długiej listy.
- **Easingi** rozszerzone (`model.ts` + `interpolate.ts`): smoothIn/Out/InOut + backIn/Out/InOut
  (overshoot — y poza 0..1, eksport Lottie OK). Picker keyframe'a zmieniony z segmented na
  `select` z grupami (Basic/Smooth/Overshoot).
- Ikony presetów dorzucone (arrow-up, maximize, minimize, heart, zap, move).
- `tsc --noEmit` czysto, `vite build` OK; headless: In=11 presetów, Emphasis=6, Heartbeat→6 kf, 10 easingów.

### Auto-merge
- Ustalone: po każdej przetestowanej zmianie robię fast-forward na `main` (deploy live sam rusza).

## Sesja: 2026-06-12 (motion library — etap 1: Motion + FX)
- Preset system: `build` może zwrócić `PresetResult { changes?, addLayers? }` — preset może dokładać
  warstwy. `store.applyPreset` wstawia je tuż za targetem (z-order), undo jako 1 krok.
- Kategoria **Motion** (transform): Ride, Hover, Jump, Wheelie, Sway, Walk Bob.
- Kategoria **FX** (dokłada warstwy): Speed Lines, Dust, Sparkle, Glow Pulse.
- `factory.createSolidLayer`; pasek kategorii przerobiony na przewijane chipy `.cat-tabs` (7 kategorii).
- Następne etapy: animowane ścieżki → Flag/Wave (kat. Path), potem Morph; potem multi-select; preview.

## Sesja: 2026-06-12 (druga fala presetów + testy)
- Dodane ~21 presetów (łącznie **65**): in (Spiral/Expand/Unfold/Back↑), out (Spiral/Slide↓/Collapse),
  emphasis (Bounce/Jiggle/Squash/Buzz/Head Shake), loop (Orbit/Tick Tock/Blink),
  motion (Run/Drift), fx (Shockwave/Confetti/Motion Trail), path (Morph→Hexagon/Heart).
- `pathSample`: cele morphu rozszerzone o hexagon i serce.
- **Testy**: `/tmp/ptest.ts` (esbuild→node) sprawdza każdy preset — skończone wartości, czasy
  w zakresie/posortowane, realna animacja, spójna liczba wierzchołków w morph/wave (wymóg Lottie),
  czysty JSON buildera, brak duplikatów ID. + smoke przez UI (klik wszystkich 65, brak błędów).
  Wynik: 65/65 PASS.
## Sesja: 2026-06-12 (edycja wektorów + gradient na stroke + IDEAS)
- **Edycja wektorów** (`Stage.tsx` + store): przycisk „Edit points" na warstwie `path` → overlay
  z wierzchołkami i uchwytami beziera. Drag wierzchołka/uchwytu (live, 1 undo), **dbl-click na
  segmencie dodaje punkt**, Delete usuwa zaznaczony. Store: `pathEditId`, `selectedPoint`,
  `setPathEdit`, `selectPoint`, `addPathPoint`, `removePathPoint`. Edycja w bazowym transformie
  (scale 100 / rot 0); boxy innych warstw wyłączone (pointer-events) w trybie edycji.
- **Gradient na stroke** (Lottie `gs`); wspólny payload z fill.
- **IDEAS.md** — log pomysłów (animowane gradienty, trim paths, copy/paste kf, repeater, ...).
- Fix Ctrl+Z, playhead pod linijką, panel warstw (grip + PPM) — wcześniej w tej sesji.

## Sesja: 2026-06-12 (color picker w stylu Figmy + gradienty)
- `ColorPicker.tsx`: pole SV + suwak barwy + hex + próbki; zakładki Solid/Linear/Radial; edytor
  gradientu (pasek ze stopami: dodaj klikiem, przeciągaj, usuń; alfa per-stop; kąt dla linear).
  Popover `position:fixed` liczony od swatcha (nie obcina go overflow panelu). `ColorSwatch` trigger.
- Live-edycja przez `setPropertyLive`/`setGradientLive`/`setStrokeColorLive`/`setCompLive` +
  begin/endInteractive → jeden wpis undo na otwarcie pickera.
- Użyte dla Fill (z gradientem), Stroke i Canvas. Gradient renderuje się w podglądzie (`gf` → lottie-web).
- NASTĘPNE (ostatnie z dużej listy): edycja wektorów/punktów ścieżki jak w Figmie.

## Sesja: 2026-06-12 (panel warstw + fixy + zaczątek gradientu)
- **Panel warstw**: strzałki/duplikacja usunięte; **chwytak (grip) po lewej** = drag-reorder
  (`moveLayerTo`), wskaźnik upuszczenia. Akcje przeniesione do menu PPM: **Rename** (fokusuje pole,
  `renameRequest`/`requestRename`), Duplicate, Reset layer, Hide, Delete.
- **Fix undo (Ctrl+Z/Ctrl+Shift+Z)**: `endInteractive` zatwierdza historię tylko przy realnej zmianie
  (kliknięcie kształtu/keyframe'a bez ruchu nie tworzy już pustego wpisu). Zweryfikowane 2→1→2.
- **Playhead**: linia zaczyna się pod linijką (nie nachodzi na liczby), wyśrodkowana (-1px).
- **Zaczątek gradientu** (jeszcze bez UI): `model.Gradient/GradientStop` + `Layer.gradient`,
  `core/color.ts` (hsv<->rgb), builder emituje `gf`, store `setGradient`. Color picker UI w toku.

## Sesja: 2026-06-12 (nawigator zoomu timeline — styl AE)
- Pływający klaster zoomu zastąpiony **paskiem-nawigatorem na dole** timeline: okno (środek =
  pan, krawędzie = zoom 1×–24×), double-click = fit. Zsynchronizowane ze scrollem (scrollX) i Ctrl+scroll.
- TODO (życzenia usera, duże): edycja wektorów/punktów (Figma); color picker Figma + gradienty.

## Sesja: 2026-06-12 (multi-expand timeline + menu kontekstowe)
- **Wiele warstw rozwiniętych naraz** na timeline (lokalny `Set` expanded; zaznaczenie warstwy
  ją rozwija, caret toggluje; inne zostają). Marquee/uchwyt keyframe'ów uogólnione na układ
  wierszy → działają też **między warstwami**.
- **Menu pod prawym przyciskiem** na warstwie (panel + timeline): Reset layer / Duplicate /
  Hide / Delete (`ContextMenu.tsx`, store `contextMenu` + `openLayerMenu/closeMenu`).
- **Reset layer** (`resetLayer`): zdejmuje animacje (de-animate), zeruje scale/rotation/opacity,
  zostawia pozycję w miejscu, usuwa pathKeyframes. Zweryfikowane (2 warstwy = 10 wierszy, reset 2kf→0).
- TODO (życzenia usera): edycja wektorów/punktów jak Figma; color picker Figma + gradienty;
  lepsze umiejscowienie zoomu timeline (nawigator jak AE).

## Sesja: 2026-06-12 (multi-select keyframe'ów na timeline)
- Store: `selectedKeyframes[]` (+ primary), `toggleKeyframe`, `selectKeyframes`,
  `removeSelectedKeyframes`, `setKeyframeTimesLive` (live, re-sortuje dotknięte property).
- Timeline jak na canvasie: shift-klik romba = toggle; **marquee** po ścieżkach property
  zaznacza keyframe'y w prostokącie (po czasie i wierszach); klik (bez ruchu) = scrub.
- Przeciąganie zaznaczonego romba rusza **całą grupą**. **Uchwyt zaznaczenia** (bracket) nad
  wierszami z bokami **lewo/prawo do ściskania/rozciągania** czasu (skala wokół przeciwległej
  krawędzi), środek = przesuń. Delete kasuje całą grupę. Jeden wpis undo na gest.
- Zweryfikowane: Tada=14 kf, marquee→6, squeeze 520→375px, Delete 14→8; bracket wyrównany do
  wierszy (delta 0–1px).

## Sesja: 2026-06-12 (chwytak playheada + biblioteka ikon)
- **Playhead handle**: przeciągany koralowy „chwytak" z numerem klatki w linijce (sticky), pointer
  capture → scrub działa też dotykiem; usunięty stary trójkąt, linia 2px. Ruler 34px.
- **Biblioteka ikon** (`core/iconLibrary.ts`, 18 ikon): heart/star/bolt/cloud/drop/moon/bookmark/pin/
  play/chat/sun/bell/arrow/check/smiley/flag/bike/rocket. Przycisk **Icons** w toolbarze → popover
  z siatką; klik wstawia ikonę przez `importSvg` → **osobne warstwy ścieżek** (np. rower = 2 koła +
  rama), gotowe pod presety/morph/flagę. Zweryfikowane (18 ikon, Bike→5 warstw, handle 0→12).

## Sesja: 2026-06-12 (wariant mobilny)
- Breakpoint **≤820px** → osobny układ (`useIsMobile` w `App.tsx`): scena na pełną szerokość,
  przewijalny w poziomie toolbar, dolny pasek zakładek **Layers / Design / Animate** otwierający
  panel jako bottom-sheet (46vh; ponowny tap zwija → scena na pełno). Dotyk działa (pointer events).
- Reużywa LayerPanel/PropertiesPanel/Timeline/Stage; nowe ikony layers/sliders/film. Zweryfikowane
  na viewportcie 390×844 (zakładki przełączają, sheet zwija, brak błędów).

## Sesja: 2026-06-12 (animowane ścieżki, morph, multi-select, preview)
- **Animowane ścieżki**: `Layer.pathKeyframes`, builder emituje animowany `sh` per kontur.
  Preset **Flag Wave** (kat. Path) — falowanie ścieżki (traveling wave, zakotwiczone z lewej).
- **Morph** (`core/pathSample.ts`): resampling konturu do N punktów (arc-length) + ringi prymitywów;
  presety Morph → Circle/Square/Triangle/Star (shape↔target, pętla).
- **Multi-select** na artboardzie: `selectedLayerIds` (+ primary), shift/ctrl-klik, marquee, drag całej
  selekcji razem, Delete usuwa wszystkie, presety przez `applyPresetToSelected` na całą selekcję.
- **Preview mode** (`Preview.tsx`): pełny modal, zapętlone odtwarzanie, transport, tła
  (transparent/light/dark/canvas), Esc/klik-tło zamyka, Spacja play/pause.
- Wszystko: `tsc` czysto, build OK, zweryfikowane headless. Cała lista życzeń usera zrobiona.

## Sesja: 2026-06-12 (zoom timeline)
- **Timeline zoom 1×–24×** (`Timeline.tsx`): sticky etykiety, scroll poziomy, kontrolki −/suwak/+/fit
  + readout, Ctrl/Cmd+scroll z kotwiczeniem na kursorze. Zweryfikowane (ticks 19→91, content rośnie).
- Następne w kolejce (życzenia usera): multi-select na artboardzie; preview mode; oraz **duża baza
  „motion" presetów pod ikony** — wymaga: animowanych ścieżek (flaga/wave + morph) i presetów,
  które dokładają warstwy FX (kreski prędkości, kurz, iskry). Do uzgodnienia zakres/kolejność.
