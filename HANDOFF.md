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

### Następne kroki
- Rozbudowa presetów: wszystkie rodziny (Wejścia/Wyjścia/Emphasis/Pętle) + **filtr segmentowy**
  w panelu + rozszerzony zestaw easingów (smooth + lekki overshoot „back"). ← następne w kolejce.
