# Lottie Studio

A web-based **Lottie animation creator** — build motion from scratch in the browser, then export a player-ready Lottie JSON.

You add shape layers, keyframe their transform on a timeline, drop in animation presets, and preview everything live (rendered by `lottie-web`).

## Features (v0.1)

- **Stage** with live `lottie-web` preview and a draggable selection overlay.
- **Layers** — rectangles and ellipses, reorder / duplicate / hide / rename.
- **Timeline** — scrubbable ruler, per-layer rows that expand into property tracks, draggable keyframes.
- **Keyframes** for position, scale, rotation, opacity and fill color, with linear / ease in / ease out / ease in-out easing.
- **Auto-key** — edits to an animated property drop a keyframe at the playhead.
- **Presets** — Fade In/Out, Pop In, Slide In ← / →, Spin, Pulse, Drop In.
- **Undo / redo** with a clean history (drags commit as one step).
- **Export Lottie** JSON, plus **Save / Open** for the editor project.

## Keyboard

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Step one frame |
| `Delete` | Remove selected keyframe (or layer) |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl + Y` | Redo |

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Architecture

The **editor model** (`src/core/model.ts`) is the source of truth — a friendly,
JSON-serializable shape of compositions, layers and animatable properties.
Everything else hangs off it:

- `core/builder.ts` — turns the model into valid Lottie (bodymovin) JSON for preview + export.
- `core/interpolate.ts` — evaluates a property's value at any frame (cubic-bezier easing).
- `core/presets.ts` — ready-made keyframe sets.
- `store/editorStore.ts` — Zustand store: state, mutations, undo/redo, live-drag commits.
- `components/*` — Toolbar, Stage, LayerPanel, PropertiesPanel, Timeline.

Stack: **Vite + React + TypeScript + Zustand + lottie-web**.

## Roadmap

- Import existing `.json` / `.lottie` files (reverse-map into the model).
- `.lottie` (dotLottie) export.
- More shapes: path/pen tool, polygon/star, text.
- Spatial bezier paths for position, motion blur.
- Color keyframe picker on the timeline, copy/paste keyframes.
